import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAuthSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type AuthUser,
  type RegisterRequest,
} from "@/features/auth/api/auth";
import { authUnauthorizedEvent, clearAntiforgeryToken } from "@/lib/api/client";

type AuthContextValue = {
  isLoading: boolean;
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const authSessionQueryKey = ["auth", "session"] as const;

function clearUserScopedCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "auth",
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: authSessionQueryKey,
    queryFn: ({ signal }) => fetchAuthSession(signal),
    refetchOnReconnect: false,
  });

  useEffect(() => {
    const clearExpiredSession = () => {
      clearUserScopedCache(queryClient);
      queryClient.setQueryData(authSessionQueryKey, null);
    };
    window.addEventListener(authUnauthorizedEvent, clearExpiredSession);

    return () =>
      window.removeEventListener(authUnauthorizedEvent, clearExpiredSession);
  }, [queryClient]);

  const loginMutation = useMutation({
    mutationFn: ({
      identifier,
      password,
    }: {
      identifier: string;
      password: string;
    }) => loginRequest(identifier, password),
    onSuccess: (authenticatedUser) => {
      clearAntiforgeryToken();
      clearUserScopedCache(queryClient);
      queryClient.setQueryData(authSessionQueryKey, authenticatedUser);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (request: RegisterRequest) => registerRequest(request),
    onSuccess: (authenticatedUser) => {
      clearAntiforgeryToken();
      clearUserScopedCache(queryClient);
      queryClient.setQueryData(authSessionQueryKey, authenticatedUser);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearAntiforgeryToken();
      clearUserScopedCache(queryClient);
      queryClient.setQueryData(authSessionQueryKey, null);
    },
  });

  const login = useCallback(
    async (identifier: string, password: string) => {
      await loginMutation.mutateAsync({ identifier, password });
    },
    [loginMutation],
  );

  const register = useCallback(
    async (request: RegisterRequest) => {
      await registerMutation.mutateAsync(request);
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Client-side sign-out should still succeed even if the server request fails.
    }
  }, [logoutMutation]);

  const value = useMemo(
    () => ({
      isLoading: sessionQuery.isLoading,
      user: sessionQuery.data ?? null,
      login,
      register,
      logout,
    }),
    [sessionQuery.isLoading, sessionQuery.data, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
