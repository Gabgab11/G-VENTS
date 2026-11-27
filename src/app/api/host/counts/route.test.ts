import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const apiFetch = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiFetch: (path: string) => apiFetch(path) }));

const { GET } = await import("./route");
const { NO_COUNTS } = await import("@/app/(site)/host/shell/nav");

describe("GET /api/host/counts", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("passes the API's counts through, cleaned, and never caches them", async () => {
    apiFetch.mockResolvedValue(Response.json({ ordersAwaitingApproval: 3, drafts: 1, payoutAction: true, extra: "x" }));
    const res = await GET();
    expect(apiFetch).toHaveBeenCalledWith("/v1/host/counts");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ...NO_COUNTS, ordersAwaitingApproval: 3, drafts: 1, payoutAction: true });
  });

  it("answers zeros while the API has no counts endpoint (404)", async () => {
    apiFetch.mockResolvedValue(new Response("not found", { status: 404 }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(NO_COUNTS);
  });

  it("says signed out on 401 and unavailable on other failures", async () => {
    apiFetch.mockResolvedValue(new Response("", { status: 401 }));
    expect((await GET()).status).toBe(401);
    apiFetch.mockResolvedValue(new Response("", { status: 500 }));
    expect((await GET()).status).toBe(502);
    apiFetch.mockRejectedValue(new Error("fetch failed"));
    expect((await GET()).status).toBe(502);
  });
});
