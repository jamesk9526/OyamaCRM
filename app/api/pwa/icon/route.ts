/**
 * /api/pwa/icon — generates an Oyama-branded icon PNG for the PWA manifest.
 * Pure Node.js, no canvas or external image deps.
 * Supports ?size=180, ?size=192, and ?size=512.
 */
import { NextRequest, NextResponse } from "next/server";
import zlib from "node:zlib";

// Oyama brand green #16a34a
const BG_R = 22, BG_G = 163, BG_B = 74;

function insideRoundedRect(px: number, py: number, w: number, h: number, r: number): boolean {
  if (px < r && py < r) return (px - r) ** 2 + (py - r) ** 2 <= r * r;
  if (px > w - 1 - r && py < r) return (px - (w - 1 - r)) ** 2 + (py - r) ** 2 <= r * r;
  if (px < r && py > h - 1 - r) return (px - r) ** 2 + (py - (h - 1 - r)) ** 2 <= r * r;
  if (px > w - 1 - r && py > h - 1 - r) return (px - (w - 1 - r)) ** 2 + (py - (h - 1 - r)) ** 2 <= r * r;
  return true;
}

function generateIconPng(size: number): Buffer {
  const pixels = new Uint8Array(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const cornerR = size * 0.18;
  const ringOuter = size * 0.32;
  const ringInner = size * 0.19;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const off = (y * size + x) * 4;
      if (!insideRoundedRect(x, y, size, size, cornerR)) {
        pixels[off + 3] = 0;
        continue;
      }
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= ringInner && dist <= ringOuter) {
        pixels[off] = 255; pixels[off + 1] = 255; pixels[off + 2] = 255; pixels[off + 3] = 255;
      } else {
        pixels[off] = BG_R; pixels[off + 1] = BG_G; pixels[off + 2] = BG_B; pixels[off + 3] = 255;
      }
    }
  }

  // CRC32 table
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  const crc32 = (buf: Uint8Array | Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = (crcTable[(crc ^ buf[i]) & 0xff]! ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Buffer): Buffer => {
    const t = Buffer.from(type, "ascii");
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const combined = Buffer.concat([t, data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(combined));
    return Buffer.concat([l, t, data, c]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9); // 8-bit RGBA

  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(size * rowBytes, 0);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = y * rowBytes + 1 + x * 4;
      raw[d] = pixels[s]!; raw[d + 1] = pixels[s + 1]!; raw[d + 2] = pixels[s + 2]!; raw[d + 3] = pixels[s + 3]!;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function GET(req: NextRequest) {
  const sizeParam = req.nextUrl.searchParams.get("size");
  const size = sizeParam === "512" ? 512 : sizeParam === "180" ? 180 : 192;

  const png = generateIconPng(size);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Cache for 7 days — icon doesn't change between deploys
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
