// Small helpers for reading FormData in server actions.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

// Trimmed string value, capped so oversized input can't reach the database.
export function field(formData: FormData, key: string, maxLength = 5000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}
