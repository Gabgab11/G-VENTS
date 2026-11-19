// The QR poster (Change 4, FR-29.2): drawn in the browser, loaded only when someone asks for it,
// so the QR generator and canvas code stay out of the event page's first load.
import { qrMatrix } from "@/lib/qr";

/** Colours and fonts of the light theme (the poster is for printing), read from the design tokens. */
function posterTheme() {
  const probe = document.createElement("div");
  probe.setAttribute("data-theme", "light");
  probe.hidden = true;
  document.body.appendChild(probe);
  const css = getComputedStyle(probe);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  probe.style.fontFamily = "var(--font-display)";
  const display = getComputedStyle(probe).fontFamily;
  probe.style.fontFamily = "var(--font-sans)";
  const sans = getComputedStyle(probe).fontFamily;
  const theme = {
    bg: read("--color-bg", "white"),
    text: read("--color-text", "black"),
    muted: read("--color-text-muted", "dimgray"),
    brand: read("--color-brand-z", "orangered"),
    display: display || "sans-serif",
    sans: sans || "sans-serif",
  };
  probe.remove();
  return theme;
}

/** Up to `max` lines that fit `width`, the last one cut with an ellipsis. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1]!;
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** A 1080×1350 PNG: wordmark, title, subtitle, the QR code of the link and a "scan" line. */
export async function drawPoster(url: string, text: { title: string; subtitle: string }, scan: string): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const theme = posterTheme();
  ctx.direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // Wordmark "G-ventZ", the Z in the brand colour (always left to right).
  ctx.font = `800 56px ${theme.display}`;
  const word = "G-vent";
  const wordWidth = ctx.measureText(word).width;
  const zWidth = ctx.measureText("Z").width;
  const startX = (W - wordWidth - zWidth) / 2;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillStyle = theme.text;
  ctx.fillText(word, startX, 130);
  ctx.fillStyle = theme.brand;
  ctx.fillText("Z", startX + wordWidth, 130);
  ctx.textAlign = "center";
  ctx.direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";

  // The QR code sits above the "scan" line at the bottom; the title (up to three lines) and the
  // subtitle are centred in the space between the wordmark and the code.
  const size = 620;
  const top = H - 130 - size;
  ctx.font = `700 68px ${theme.display}`;
  const titleLines = wrap(ctx, text.title, W - 160, 3);
  ctx.font = `500 38px ${theme.sans}`;
  const subLines = text.subtitle ? wrap(ctx, text.subtitle, W - 160, 2) : [];
  const blockHeight = titleLines.length * 80 + (subLines.length ? 16 + subLines.length * 50 : 0);
  let y = 170 + (top - 170 - blockHeight) / 2 + 60; // + the first line's ascent
  ctx.fillStyle = theme.text;
  ctx.font = `700 68px ${theme.display}`;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 80;
  }
  ctx.fillStyle = theme.muted;
  ctx.font = `500 38px ${theme.sans}`;
  for (const line of subLines) {
    ctx.fillText(line, W / 2, y - 14);
    y += 50;
  }

  // Dark on white with its quiet zone.
  const panelX = (W - size) / 2;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.roundRect(panelX, top, size, size, 36);
  ctx.fill();
  const m = qrMatrix(url);
  const modules = m.length + 8;
  const cell = Math.floor(size / modules);
  const offset = (size - cell * m.length) / 2;
  ctx.fillStyle = "black";
  m.forEach((row, my) => row.forEach((on, mx) => {
    if (on) ctx.fillRect(panelX + offset + mx * cell, top + offset + my * cell, cell, cell);
  }));

  ctx.fillStyle = theme.muted;
  ctx.font = `600 36px ${theme.sans}`;
  ctx.fillText(scan, W / 2, top + size + 80);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
