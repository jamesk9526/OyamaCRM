// Generates Steward-mark assets for the Oyama Bridge desktop app.
// Run with: node create-icon.js
// No external dependencies — uses only Node.js built-ins.

const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

// ----- CRC32 ----------------------------------------------------------------
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}
const CRC_TABLE = buildCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ----- PNG builder ----------------------------------------------------------
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function buildPNG(pixels, width, height) {
  // pixels: Uint8Array with RGBA channels, length = width * height * 4
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // 8-bit depth
  ihdr.writeUInt8(6, 9);   // colour type 6 = RGBA
  // bytes 10-12 stay 0 (deflate, no filter, no interlace)

  // Build raw scanline data: 1 filter byte (0x00) + RGBA per pixel
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(height * rowBytes, 0);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0; // filter = None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * rowBytes + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----- Icon design ----------------------------------------------------------
// Design: green rounded-rectangle background with the Steward ring/mark.
// BG colour: #16a34a (Oyama Steward green)
const BG_R = 22, BG_G = 163, BG_B = 74;

function drawOyamaIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  // Rounded-rect corner radius as fraction of size
  const cornerR = size * 0.18;

  const ringOuter = size * 0.34;
  const ringInner = size * 0.29;
  const stroke = Math.max(2, size * 0.055);

  const segments = [
    [size * 0.32, size * 0.56, size * 0.33, size * 0.41],
    [size * 0.33, size * 0.41, size * 0.53, size * 0.34],
    [size * 0.53, size * 0.34, size * 0.69, size * 0.42],
    [size * 0.69, size * 0.42, size * 0.59, size * 0.53],
    [size * 0.59, size * 0.53, size * 0.48, size * 0.62],
    [size * 0.48, size * 0.62, size * 0.58, size * 0.72],
    [size * 0.58, size * 0.72, size * 0.72, size * 0.62],
    [size * 0.31, size * 0.70, size * 0.43, size * 0.64],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const off = (y * size + x) * 4;

      // Check if pixel is inside the rounded rectangle background
      if (!insideRoundedRect(x, y, size, size, cornerR)) {
        pixels[off + 3] = 0; // fully transparent outside shape
        continue;
      }

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const onRing = dist >= ringInner && dist <= ringOuter;
      const onMark = segments.some(([x1, y1, x2, y2]) => distanceToSegment(x, y, x1, y1, x2, y2) <= stroke);

      if (onRing || onMark) {
        pixels[off]     = 255;
        pixels[off + 1] = 255;
        pixels[off + 2] = 255;
        pixels[off + 3] = 255;
      } else {
        // Green background
        pixels[off]     = BG_R;
        pixels[off + 1] = BG_G;
        pixels[off + 2] = BG_B;
        pixels[off + 3] = 255;
      }
    }
  }

  return pixels;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function insideRoundedRect(px, py, w, h, r) {
  // Top-left corner
  if (px < r && py < r) {
    return (px - r) ** 2 + (py - r) ** 2 <= r * r;
  }
  // Top-right corner
  if (px > w - 1 - r && py < r) {
    return (px - (w - 1 - r)) ** 2 + (py - r) ** 2 <= r * r;
  }
  // Bottom-left corner
  if (px < r && py > h - 1 - r) {
    return (px - r) ** 2 + (py - (h - 1 - r)) ** 2 <= r * r;
  }
  // Bottom-right corner
  if (px > w - 1 - r && py > h - 1 - r) {
    return (px - (w - 1 - r)) ** 2 + (py - (h - 1 - r)) ** 2 <= r * r;
  }
  return true;
}

// ----- ICO builder ----------------------------------------------------------
// Wraps a single PNG as an ICO file (PNG-inside-ICO format, supported by Windows Vista+).
function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  // Width/height 0 means 256 in ICO spec
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);   // colour count (0 = 256+)
  entry.writeUInt8(0, 3);   // reserved
  entry.writeUInt16LE(0, 4);  // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset = header + one directory entry

  return Buffer.concat([header, entry, pngBuffer]);
}

// ----- Main -----------------------------------------------------------------
const assetsDir = path.join(__dirname, "assets");
fs.mkdirSync(assetsDir, { recursive: true });

// 256×256 — used for installer, window titlebar, and taskbar
const pixels256 = drawOyamaIcon(256);
const png256 = buildPNG(pixels256, 256, 256);
fs.writeFileSync(path.join(assetsDir, "icon.png"), png256);
console.log("Created assets/icon.png (256×256)");

// ICO wrapping the 256×256 PNG
const ico256 = buildIco(png256, 256);
fs.writeFileSync(path.join(assetsDir, "icon.ico"), ico256);
console.log("Created assets/icon.ico (256×256 PNG-in-ICO)");

// 32×32 PNG — tray fallback reference
const pixels32 = drawOyamaIcon(32);
const png32 = buildPNG(pixels32, 32, 32);
fs.writeFileSync(path.join(assetsDir, "icon-tray.png"), png32);
console.log("Created assets/icon-tray.png (32×32)");

console.log("Icon generation complete.");
