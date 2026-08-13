import { z } from "zod";

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export const authUnauthorizedEvent = "wordmatch:auth-unauthorized";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiOptions = {},
): Promise<T> {
  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-XSRF-TOKEN", await fetchAntiforgeryToken());
  }

  const response = await fetch(path, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAntiforgeryToken();
      window.dispatchEvent(new Event(authUnauthorizedEvent));
    }

    throw await createApiError(response);
  }

  if (response.status === 204) {
    return schema.parse(undefined);
  }

  return schema.parse(await response.json());
}

let cachedAntiforgeryTokenPromise: Promise<string> | null = null;

function fetchAntiforgeryToken() {
  cachedAntiforgeryTokenPromise ??= requestAntiforgeryToken().catch(
    (error: unknown) => {
      cachedAntiforgeryTokenPromise = null;
      throw error;
    },
  );

  return cachedAntiforgeryTokenPromise;
}

export function clearAntiforgeryToken() {
  cachedAntiforgeryTokenPromise = null;
}

const antiforgeryTokenSchema = z.object({ token: z.string() });

async function requestAntiforgeryToken() {
  const response = await fetch("/api/auth/antiforgery", {
    credentials: "include",
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  const result = antiforgeryTokenSchema.parse(await response.json());
  return result.token;
}

async function createApiError(response: Response) {
  let message = `İstek ${response.status} durum koduyla başarısız oldu.`;
  let errors: Record<string, string[]> = {};

  try {
    const body = (await response.json()) as {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };
    message = body.message ?? body.title ?? message;
    errors = body.errors ?? {};
  } catch {
    // Some framework responses intentionally have no JSON body.
  }

  return new ApiError(message, response.status, errors);
}
