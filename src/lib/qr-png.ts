import { deflateSync } from "node:zlib";
import { qrMatrix } from "@/lib/qr";

// PNG version of the QR code, for emails. Gmail and Outlook don't show SVG,
// so the confirmation email carries this as an inline image attachment.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Black-and-white PNG, `scale` pixels per module, 4-module quiet zone.
export function qrPng(text: string, scale = 10): Buffer {
  const m = qrMatrix(text);
  const border = 4;
  const dim = (m.length + border * 2) * scale;

  // 8-bit greyscale rows, each starting with filter byte 0.
  const raw = Buffer.alloc((dim + 1) * dim, 255);
  for (let py = 0; py < dim; py++) {
    raw[py * (dim + 1)] = 0;
    const y = Math.floor(py / scale) - border;
    if (y < 0 || y >= m.length) continue;
    for (let px = 0; px < dim; px++) {
      const x = Math.floor(px / scale) - border;
      if (x >= 0 && x < m.length && m[y][x]) raw[py * (dim + 1) + 1 + px] = 0;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(dim, 0);
  header.writeUInt32BE(dim, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
