import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/server", () => ({ api: vi.fn(), data: vi.fn() }));

const { flyerFrom, FLYER_MAX } = await import("./flyer");

function form(value?: FormDataEntryValue | Blob, filename = "cover.png"): FormData {
  const fd = new FormData();
  if (value instanceof Blob) fd.append("flyer", value, filename);
  else if (value !== undefined) fd.append("flyer", value);
  return fd;
}

describe("flyerFrom", () => {
  it("is null when no image was chosen (no field, or the browser's empty file)", () => {
    expect(flyerFrom(form())).toBeNull();
    expect(flyerFrom(form(new File([], "")))).toBeNull();
  });

  it("accepts JPG, PNG and WebP up to 5 MB", () => {
    const r = flyerFrom(form(new File([new Uint8Array(10)], "a.png", { type: "image/png" })));
    expect(r && "file" in r && r.contentType).toBe("image/png");
  });

  it("recognises a file by shape, whatever class the runtime parsed it into", () => {
    const foreign = { size: 4, type: "image/webp", name: "x.webp", arrayBuffer: async () => new ArrayBuffer(4) };
    const fd = { get: () => foreign } as unknown as FormData;
    const r = flyerFrom(fd);
    expect(r && "file" in r && r.contentType).toBe("image/webp");
  });

  it("never drops a chosen image silently: wrong type, too big, or unreadable are problems", () => {
    expect(flyerFrom(form(new File([new Uint8Array(4)], "a.gif", { type: "image/gif" })))).toEqual({ problem: "flyer_type" });
    expect(flyerFrom(form(new File([new Uint8Array(FLYER_MAX + 1)], "a.jpg", { type: "image/jpeg" })))).toEqual({ problem: "flyer_size" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(flyerFrom(form("C:\\fakepath\\cover.png"))).toEqual({ problem: "flyer_unreadable" });
    error.mockRestore();
  });
});
