// Passkeys (WebAuthn) cross between the server (Supabase Auth MFA) and the browser as JSON:
// binary fields (challenge, user id, credential ids) travel as base64url text, as in the WebAuthn
// Level 3 JSON format. Shared by the server actions and the browser code.

export function bufferToBase64url(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBuffer(text: string): ArrayBuffer {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const isBinary = (v: unknown): v is ArrayBuffer | ArrayBufferView => v instanceof ArrayBuffer || ArrayBuffer.isView(v);

/** Options from Supabase (binary fields as ArrayBuffers on the server) → plain JSON for the browser. */
export function optionsToJSON(value: unknown): unknown {
  if (isBinary(value)) return bufferToBase64url(value);
  if (Array.isArray(value)) return value.map(optionsToJSON);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).map(([k, v]) => [k, optionsToJSON(v)]));
  }
  return value;
}

type Desc = { id: string; type?: string; transports?: string[] };

/** Browser side: JSON creation options → what navigator.credentials.create() takes. */
export function creationOptionsFromJSON(o: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const user = o.user as { id: string; name: string; displayName: string };
  return {
    ...(o as object),
    challenge: base64urlToBuffer(o.challenge as string),
    user: { ...user, id: base64urlToBuffer(user.id) },
    excludeCredentials: ((o.excludeCredentials as Desc[] | undefined) ?? []).map((c) => ({ ...c, type: "public-key", id: base64urlToBuffer(c.id) })) as PublicKeyCredentialDescriptor[],
  } as PublicKeyCredentialCreationOptions;
}

/** Browser side: JSON request options → what navigator.credentials.get() takes. */
export function requestOptionsFromJSON(o: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  return {
    ...(o as object),
    challenge: base64urlToBuffer(o.challenge as string),
    allowCredentials: ((o.allowCredentials as Desc[] | undefined) ?? []).map((c) => ({ ...c, type: "public-key", id: base64urlToBuffer(c.id) })) as PublicKeyCredentialDescriptor[],
  } as PublicKeyCredentialRequestOptions;
}

/** Browser side: the new or used credential → JSON for the server (WebAuthn Level 3 shape). */
export function credentialToJSON(cred: PublicKeyCredential): Record<string, unknown> {
  const withJSON = cred as PublicKeyCredential & { toJSON?: () => Record<string, unknown> };
  if (typeof withJSON.toJSON === "function") return withJSON.toJSON();
  const r = cred.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const response: Record<string, string | undefined> = { clientDataJSON: bufferToBase64url(r.clientDataJSON) };
  if ("attestationObject" in r && r.attestationObject) response.attestationObject = bufferToBase64url(r.attestationObject);
  if ("authenticatorData" in r && r.authenticatorData) {
    response.authenticatorData = bufferToBase64url(r.authenticatorData);
    response.signature = bufferToBase64url(r.signature);
    response.userHandle = r.userHandle ? bufferToBase64url(r.userHandle) : undefined;
  }
  return {
    id: cred.id,
    rawId: cred.id,
    type: "public-key",
    response,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: (cred as PublicKeyCredential & { authenticatorAttachment?: string | null }).authenticatorAttachment ?? undefined,
  };
}
