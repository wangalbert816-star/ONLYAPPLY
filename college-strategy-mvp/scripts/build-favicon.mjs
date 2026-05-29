/**
 * Generate favicon assets from public/onlyapply-favicon-source.png
 * Square canvas, logo centered with safe padding for Google's circular crop.
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

/** Extra inset so stacked logo stays legible when Google masks favicon as a circle */
const CIRCLE_SAFE_INSET = 0.1;

async function preparedLogo() {
  const meta = await sharp(src).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const side = Math.max(w, h);

  const padTop = Math.floor((side - h) / 2);
  const padBottom = side - h - padTop;
  const padLeft = Math.floor((side - w) / 2);
  const padRight = side - w - padLeft;

  const squared = await sharp(src)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: bg,
    })
    .png()
    .toBuffer();

  const inset = Math.round(side * CIRCLE_SAFE_INSET);
  return sharp(squared).extend({
    top: inset,
    bottom: inset,
    left: inset,
    right: inset,
    background: bg,
  });
}

const sizes = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["apple-touch-icon.png", 180],
  ["favicon-192x192.png", 192],
  ["favicon-512x512.png", 512],
];

const logo = await preparedLogo();

for (const [name, size] of sizes) {
  await logo
    .clone()
    .resize(size, size, { fit: "contain", background: bg })
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, name));
}

const png16 = await logo.clone().resize(16, 16, { fit: "contain", background: bg }).png().toBuffer();
const png32 = await logo.clone().resize(32, 32, { fit: "contain", background: bg }).png().toBuffer();
const png48 = await logo.clone().resize(48, 48, { fit: "contain", background: bg }).png().toBuffer();

function pngToIco(buffers) {
  const count = buffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const parts = [header];
  for (const buf of buffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(32, 0);
    entry.writeUInt8(32, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    parts.push(entry);
    offset += buf.length;
  }
  return Buffer.concat([...parts, ...buffers]);
}

await fs.writeFile(path.join(root, "favicon.ico"), pngToIco([png16, png32, png48]));
console.log("Wrote favicon assets to public/");
