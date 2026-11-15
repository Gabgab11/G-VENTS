// Errors from gventz-api. The API answers RFC 9457 problem details whose `detail` is written for
// users (its business rules E2), so forms can show it as is. Anything else (network failures,
// 5xx, an unexpected body) is logged and replaced with a generic message (src/lib/errors.ts rule).

export type FieldIssue = { field: string; code: string; message: string };

export type Problem = {
  status: number;
  code: string;
  detail: string;
  errors?: FieldIssue[];
  requestId?: string;
};

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(`${problem.status} ${problem.code}: ${problem.detail}`);
    this.name = "ApiError";
  }

  get status() {
    return this.problem.status;
  }

  get code() {
    return this.problem.code;
  }
}

export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** Reads a problem body; falls back to a generic problem for anything unexpected. */
export function toProblem(status: number, body: unknown, requestId?: string): Problem {
  const b = (body ?? {}) as Partial<Problem>;
  const ok = typeof b.code === "string" && typeof b.detail === "string";
  return {
    status,
    code: ok ? b.code! : status >= 500 ? "internal_error" : "request_failed",
    detail: ok ? b.detail! : GENERIC_MESSAGE,
    ...(Array.isArray(b.errors) ? { errors: b.errors } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

/**
 * The message to show for a failed call. Problems from the API below 500 are user-safe; 5xx shows
 * the API's text only for "unavailable" codes it chose to explain (busy, rate limits).
 */
export function apiMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  if (!(error instanceof ApiError)) return fallback;
  const { status, code, detail, errors } = error.problem;
  if (status === 400 && errors?.length) return errors[0]!.message;
  if (status < 500) return detail;
  if (status === 503 && code !== "internal_error") return detail;
  return fallback;
}

/** A message function for the `errors` area (next-intl's `t`, narrowed to what this needs). */
export type ErrorTranslator = { has(key: string): boolean; (key: string): string };

/**
 * The message for a failed call in the reader's language (FR-26, D70). English shows exactly what
 * apiMessage shows (the API's own text). Other languages show the catalogue's translation of the
 * problem's code (or of the first field error's code), and the API's English text only for codes
 * the catalogue doesn't know yet. Problems we wouldn't show (5xx) still get the fallback.
 */
export function problemMessage(error: unknown, t: ErrorTranslator, lang: string, fallback = GENERIC_MESSAGE): string {
  const english = apiMessage(error, fallback);
  if (lang === "en" || !(error instanceof ApiError) || english === fallback) return english;
  const { status, code, errors } = error.problem;
  const key = status === 400 && errors?.length ? errors[0]!.code : code;
  return key && t.has(key) ? t(key) : english;
}
