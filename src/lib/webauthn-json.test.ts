import { describe, expect, it } from "vitest";
import { base64urlToBuffer, bufferToBase64url, creationOptionsFromJSON, optionsToJSON, requestOptionsFromJSON } from "./webauthn-json";

const bytes = (...n: number[]) => new Uint8Array(n).buffer;

describe("passkey JSON", () => {
  it("round-trips binary through base64url (no padding, URL-safe)", () => {
    const b = bytes(0, 255, 62, 63, 250, 1);
    const text = bufferToBase64url(b);
    expect(text).not.toMatch(/[+/=]/);
    expect(new Uint8Array(base64urlToBuffer(text))).toEqual(new Uint8Array(b));
  });

  it("turns server options (ArrayBuffers) into JSON and back for the browser", () => {
    const server = {
      challenge: bytes(1, 2, 3, 4),
      rp: { id: "gventz.com", name: "G-ventZ" },
      user: { id: bytes(9, 9), name: "a@b.c", displayName: "A" },
      excludeCredentials: [{ id: bytes(7, 7, 7), type: "public-key" }],
      timeout: undefined,
    };
    const json = optionsToJSON(server) as Record<string, unknown>;
    expect(json).not.toHaveProperty("timeout");
    expect(typeof json.challenge).toBe("string");
    const back = creationOptionsFromJSON(json);
    expect(new Uint8Array(back.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(new Uint8Array(back.user.id as ArrayBuffer)).toEqual(new Uint8Array([9, 9]));
    expect(new Uint8Array(back.excludeCredentials![0]!.id as ArrayBuffer)).toEqual(new Uint8Array([7, 7, 7]));
  });

  it("builds request options with allowed credentials", () => {
    const req = requestOptionsFromJSON({ challenge: bufferToBase64url(bytes(5)), allowCredentials: [{ id: bufferToBase64url(bytes(8)) }], rpId: "gventz.com" });
    expect(req.rpId).toBe("gventz.com");
    expect(req.allowCredentials![0]!.type).toBe("public-key");
  });
});
