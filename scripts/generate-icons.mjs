/**
 * Generates placeholder PNG icons for the OpenMem extension.
 * Creates icons/icon16.png, icons/icon48.png, icons/icon128.png
 * inside packages/extension/.
 *
 * Run:  node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "../packages/extension/icons");
mkdirSync(OUT, { recursive: true });

// ── CRC-32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function makePNG(size, drawFn) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  // Build raw scanlines (filter byte 0 per row + RGB pixels)
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter = None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      raw.push(r, g, b);
    }
  }

  const idat = deflateSync(Buffer.from(raw), { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Design ────────────────────────────────────────────────────────────────────
// Deep indigo background with a white "M" glyph — simple but recognisable.
//
// Background: #1e1b4b (30, 27, 75)
// Accent:     #818cf8 (129, 140, 248)

const BG = [30, 27, 75];
const ACCENT = [129, 140, 248];

/**
 * Draw a simple "OM" letter mark centred in the icon.
 * We rasterise a block-letter "M" at various sizes.
 */
function drawIcon(x, y, size) {
  const pad = Math.round(size * 0.15);
  const w = size - pad * 2;
  const h = size - pad * 2;

  const lx = x - pad;
  const ly = y - pad;

  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return BG;

  // Normalise to 0..1
  const nx = lx / w;
  const ny = ly / h;

  // Stroke width relative to icon size
  const sw = Math.max(1, Math.round(size * 0.12));

  // "M" shape: two verticals + two diagonals meeting at centre-top
  const cols = w;
  const rows = h;
  const px = lx;
  const py = ly;

  // Left vertical bar
  if (px < sw) return ACCENT;
  // Right vertical bar
  if (px >= cols - sw) return ACCENT;

  // Left diagonal (top-left → centre-top)
  const midX = Math.round(cols / 2);
  const diagLSlope = midX / rows; // dx/dy
  const diagLLeft = Math.round(py * diagLSlope);
  const diagLRight = diagLLeft + sw;
  if (px >= diagLLeft && px < diagLRight && py < rows * 0.6) return ACCENT;

  // Right diagonal (top-right → centre-top)
  const diagRRight = cols - Math.round(py * diagLSlope);
  const diagRLeft = diagRRight - sw;
  if (px >= diagRLeft && px < diagRRight && py < rows * 0.6) return ACCENT;

  return BG;
}

// ── Emit files ────────────────────────────────────────────────────────────────
for (const size of [16, 48, 128]) {
  const buf = makePNG(size, drawIcon);
  const file = resolve(OUT, `icon${size}.png`);
  writeFileSync(file, buf);
  console.log(`wrote ${file}  (${buf.length} bytes)`);
}
console.log("Done.");
