/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

function emptyResponse(status: number) {
  return {
    ok: status < 400,
    status,
    json: async () => {
      throw new Error("no body");
    },
  } as unknown as Response;
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch an antiforgery token for GET requests", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/words", z.unknown());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.has("X-XSRF-TOKEN")).toBe(false);
  });

  it("fetches the antiforgery token once and reuses it across mutating requests", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => {
      if (path === "/api/auth/antiforgery") {
        return Promise.resolve(jsonResponse({ token: "csrf-token" }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/words", z.unknown(), {
      body: { name: "x" },
      method: "POST",
    });
    await apiRequest("/api/words", z.unknown(), {
      body: { name: "y" },
      method: "POST",
    });

    const antiforgeryCalls = fetchMock.mock.calls.filter(
      ([path]) => path === "/api/auth/antiforgery",
    );
    expect(antiforgeryCalls).toHaveLength(1);

    const mutatingCalls = fetchMock.mock.calls.filter(
      ([path]) => path === "/api/words",
    );
    expect(mutatingCalls).toHaveLength(2);
    for (const [, options] of mutatingCalls) {
      const headers = new Headers((options as RequestInit).headers);
      expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token");
    }
  });

  it("clears the cached antiforgery token and dispatches the unauthorized event on a 401 response", async () => {
    const { apiRequest, authUnauthorizedEvent } =
      await import("@/lib/api/client");
    let antiforgeryCallCount = 0;
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => {
      if (path === "/api/auth/antiforgery") {
        antiforgeryCallCount += 1;
        return Promise.resolve(
          jsonResponse({ token: `token-${antiforgeryCallCount}` }),
        );
      }
      return Promise.resolve(emptyResponse(401));
    });
    vi.stubGlobal("fetch", fetchMock);

    const listener = vi.fn();
    window.addEventListener(authUnauthorizedEvent, listener);

    await expect(
      apiRequest("/api/words", z.unknown(), { body: {}, method: "POST" }),
    ).rejects.toThrow();
    expect(listener).toHaveBeenCalledOnce();

    await apiRequest("/api/words", z.unknown(), {
      body: {},
      method: "POST",
    }).catch(() => {});

    expect(antiforgeryCallCount).toBe(2);

    window.removeEventListener(authUnauthorizedEvent, listener);
  });

  it("parses message, title, and errors from a JSON error body", async () => {
    const { apiRequest, ApiError } = await import("@/lib/api/client");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { errors: { email: ["Zorunlu alan."] }, message: "Geçersiz istek." },
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const error = (await apiRequest("/api/words", z.unknown()).catch(
      (caught) => caught,
    )) as {
      message: string;
      status: number;
      errors: Record<string, string[]>;
    };

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Geçersiz istek.");
    expect(error.status).toBe(400);
    expect(error.errors).toEqual({ email: ["Zorunlu alan."] });
  });

  it("falls back to a generic message when the error response has no JSON body", async () => {
    const { apiRequest, ApiError } = await import("@/lib/api/client");
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse(500));
    vi.stubGlobal("fetch", fetchMock);

    const error = (await apiRequest("/api/words", z.unknown()).catch(
      (caught) => caught,
    )) as {
      message: string;
      errors: Record<string, string[]>;
    };

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("İstek 500 durum koduyla başarısız oldu.");
    expect(error.errors).toEqual({});
  });

  it("resolves undefined for a 204 response without parsing JSON", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    const jsonSpy = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      json: jsonSpy,
      ok: true,
      status: 204,
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest("/api/practice-sessions/1", z.unknown());

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("resolves the parsed JSON body for a successful response", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ wordId: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest(
      "/api/words/1",
      z.object({ wordId: z.number() }),
    );

    expect(result).toEqual({ wordId: 1 });
  });

  it("does not permanently poison the cache when the antiforgery request itself fails", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    let attempt = 0;
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => {
      if (path === "/api/auth/antiforgery") {
        attempt += 1;
        if (attempt === 1) {
          return Promise.resolve(emptyResponse(500));
        }
        return Promise.resolve(jsonResponse({ token: "csrf-token" }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest("/api/words", z.unknown(), { body: {}, method: "POST" }),
    ).rejects.toThrow();

    await apiRequest("/api/words", z.unknown(), { body: {}, method: "POST" });

    expect(attempt).toBe(2);
  });
});
