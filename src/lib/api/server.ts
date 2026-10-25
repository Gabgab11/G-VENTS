import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import createClient, { type Middleware } from "openapi-fetch";
import { serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiHeaders, clientIpFrom } from "./headers";
import { ApiError, toProblem } from "./problem";
import type { paths } from "./schema";

// The website's only way to reach gventz-api (application design AD13: the browser never calls
// the API). Runs in Server Components and Server Actions. Each call carries the signed-in user's
// Supabase access token (the API verifies it), a request id, and the BFF headers.

const TIMEOUT_MS = 10_000;

/** Throws ApiError for any non-2xx answer, so callers handle one error type. */
const throwOnError: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined;
    const body = await response
      .clone()
      .json()
      .catch(() => null);
    const problem = toProblem(response.status, body, response.headers.get("x-request-id") ?? undefined);
    if (response.status >= 500 && problem.code === "internal_error") {
      console.error(`[api] ${response.status} ${response.url} request ${problem.requestId ?? "?"}`);
    }
    throw new ApiError(problem);
  },
};

async function requestHeaders(anonymous: boolean): Promise<Record<string, string>> {
  const env = serverEnv();
  // Anonymous calls read no cookies or request headers, so pages using them can stay static.
  if (anonymous) return apiHeaders({ accessToken: null, bffKey: env.bffSharedSecret, clientIp: null, requestId: randomUUID() });
  const incoming = await headers();
  // getSession reads the cookie without a network call; the API verifies the token itself.
  const supabase = await createSupabaseServerClient();
  const accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return apiHeaders({
    accessToken,
    bffKey: env.bffSharedSecret,
    clientIp: clientIpFrom(incoming.get("x-forwarded-for"), incoming.get("x-real-ip")),
    requestId: incoming.get("x-request-id") ?? randomUUID(),
  });
}

/** A raw call for non-JSON answers (the guest CSV). The caller checks `response.ok`. */
export async function apiFetch(path: string): Promise<Response> {
  return fetch(`${serverEnv().apiUrl}${path}`, { headers: await requestHeaders(false), cache: "no-store", signal: AbortSignal.timeout(60_000) });
}

/**
 * A typed client for this request. `anonymous` skips the session and request headers (public
 * data); with `revalidate` (seconds) answers are cached by Next.js, so static pages stay static.
 */
export async function api(opts: { anonymous?: boolean; revalidate?: number } = {}) {
  const env = serverEnv();
  const cacheInit: RequestInit & { next?: { revalidate: number } } =
    opts.anonymous && opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" };
  const client = createClient<paths>({
    baseUrl: env.apiUrl,
    headers: await requestHeaders(opts.anonymous ?? false),
    fetch: (request: Request) => fetch(request, { signal: AbortSignal.timeout(TIMEOUT_MS), ...cacheInit }),
  });
  client.use(throwOnError);
  return client;
}

/** The data of a successful call. Errors were already thrown as ApiError by the middleware. */
export function data<T>(result: { data?: T; error?: unknown }): T {
  if (result.data === undefined) throw new ApiError(toProblem(500, result.error));
  return result.data;
}
