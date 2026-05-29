/**
 * Generate favicon assets from public/onlyapply-favicon-source.png
 * Trim → square → safe inset → fixed-size PNG/ICO (Chrome tab + Google circle crop).
 * Usage: npm run build:favicon
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../public");
const src = path.join(root, "onlyapply-favicon-source.png");
const bg = { r: 255, g: 255, b: 255, alpha: 1 };

/** Inset after trim so logo survives Google's circular favicon mask */
const CIRCLE_SAFE_INSET = 0.07;

async function preparedLogoBuffer() {
  const trimmed = await sharp(src).trim({ threshold: 14 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const side = Math.max(w, h);

  const padTop = Math.floor((side - h) / 2);
  const padBottom = side - h - padTop;
  const padLeft = Math.floor((side - w) / 2);
  const padRight = side - w - padLeft;

  const squared = await sharp(trimmed)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: bg,
    })
    .png()
    .toBuffer();

  const inset = Math.max(8, Math.round(side * CIRCLE_SAFE_INSET));
  return sharp(squared)
    .extend({
      top: inset,
      bottom: inset,
      left: inset,
      right: inset,
      background: bg,
    })
    .png()
    .toBuffer();
}

async function resizeSquare(size) {
  const base = await preparedLogoBuffer();
  return sharp(base).resize(size, size, { fit: "contain", background: bg }).png().toBuffer();
}

const sizes = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["apple-touch-icon.png", 180],
  ["favicon-192x192.png", 192],
  ["favicon-512x512.png", 512],
];

for (const [name, size] of sizes) {
  const buf = await resizeSquare(size);
  await fs.writeFile(path.join(root, name), buf);
}

const png16 = await resizeSquare(16);
const png32 = await resizeSquare(32);
const png48 = await resizeSquare(48);

function pngToIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const parts = [header];
  for (const { buf, size } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    parts.push(entry);
    offset += buf.length;
  }
  return Buffer.concat([...parts, ...entries.map((e) => e.buf)]);
}

await fs.writeFile(
  path.join(root, "favicon.ico"),
  pngToIco([
    { buf: png16, size: 16 },
    { buf: png32, size: 32 },
    { buf: png48, size: 48 },
  ]),
);

console.log("Wrote favicon assets to public/");
