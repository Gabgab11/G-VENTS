import { describe, expect, it } from "vitest";
import { apiHeaders, clientIpFrom } from "./headers";
import { ApiError, apiMessage, GENERIC_MESSAGE, toProblem } from "./problem";

describe("problem details", () => {
  it("shows the API's own message for rule errors and the first field message for validation", () => {
    expect(apiMessage(new ApiError(toProblem(409, { code: "order.buyer_limit", detail: "You can get 1 more ticket(s) for this event." })))).toBe(
      "You can get 1 more ticket(s) for this event.",
    );
    expect(apiMessage(new ApiError(toProblem(400, { code: "validation.failed", detail: "Some fields are not valid.", errors: [{ field: "lines", code: "order.quantity_invalid", message: "Choose between 1 and 10 tickets." }] })))).toBe(
      "Choose between 1 and 10 tickets.",
    );
  });

  it("explains chosen 503s (busy, limiter) but hides internal errors and anything unexpected", () => {
    expect(apiMessage(new ApiError(toProblem(503, { code: "order.busy", detail: "Lots of people are getting tickets right now. Please try again." })))).toMatch(/Lots of people/);
    expect(apiMessage(new ApiError(toProblem(500, { code: "internal_error", detail: "Something broke at line 42" })))).toBe(GENERIC_MESSAGE);
    expect(apiMessage(new ApiError(toProblem(502, "<html>bad gateway</html>")))).toBe(GENERIC_MESSAGE);
    expect(apiMessage(new TypeError("fetch failed"), "Try later.")).toBe("Try later.");
    expect(toProblem(404, null)).toEqual({ status: 404, code: "request_failed", detail: GENERIC_MESSAGE });
  });
});

describe("API headers", () => {
  it("takes the first forwarded IP, or x-real-ip, and ignores junk", () => {
    expect(clientIpFrom("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
    expect(clientIpFrom(null, "2001:db8::1")).toBe("2001:db8::1");
    expect(clientIpFrom("not-an-ip")).toBeNull();
  });

  it("sends the token, request id and BFF headers; never the IP without the key", () => {
    expect(apiHeaders({ accessToken: "t", bffKey: "k", clientIp: "203.0.113.9", requestId: "r" })).toEqual({
      authorization: "Bearer t",
      "x-request-id": "r",
      "x-gventz-bff-key": "k",
      "x-gventz-client-ip": "203.0.113.9",
    });
    expect(apiHeaders({ accessToken: null, bffKey: "", clientIp: "203.0.113.9", requestId: "r" })).toEqual({ "x-request-id": "r" });
  });
});
