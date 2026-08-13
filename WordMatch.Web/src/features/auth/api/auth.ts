import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const authUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  username: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export type RegisterRequest = {
  email: string;
  username: string;
  password: string;
};

export async function fetchAuthSession(signal?: AbortSignal) {
  return apiRequest("/api/auth/session", authUserSchema, { signal });
}

export async function login(identifier: string, password: string) {
  return apiRequest("/api/auth/login", authUserSchema, {
    method: "POST",
    body: { identifier, password },
  });
}

export async function register(request: RegisterRequest) {
  return apiRequest("/api/auth/register", authUserSchema, {
    method: "POST",
    body: request,
  });
}

export async function logout() {
  await apiRequest("/api/auth/logout", z.void(), {
    method: "POST",
    body: {},
  });
}
