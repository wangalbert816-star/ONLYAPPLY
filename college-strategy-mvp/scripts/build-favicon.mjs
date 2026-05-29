/**
 * Generate favicon assets from public/onlyapply-favicon-source.png
 * Ink-centroid centering → square canvas → fixed-size PNG/ICO.
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

/** Padding around centered logo (Google circle crop + tab legibility) */
const CANVAS_INSET = 0.08;

function isInk(r, g, b, a) {
  return a > 20 && (r < 245 || g < 245 || b < 245);
}

async function analyzeInk(image) {
  const { data, info } = await image.clone().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  let n = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isInk(r, g, b, a)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      n += 1;
    }
  }

  if (n === 0) throw new Error("No logo ink found in favicon source");

  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: sumX / n,
    cy: sumY / n,
    width: info.width,
    height: info.height,
  };
}

async function preparedLogoBuffer() {
  const base = sharp(src);
  const ink = await analyzeInk(base);
  const cropW = ink.maxX - ink.minX + 1;
  const cropH = ink.maxY - ink.minY + 1;

  const cropped = await base
    .extract({ left: ink.minX, top: ink.minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const cxInCrop = ink.cx - ink.minX;
  const cyInCrop = ink.cy - ink.minY;
  const contentSide = Math.max(cropW, cropH);
  const side = Math.round(contentSide * (1 + CANVAS_INSET * 2));

  const left = Math.round(side / 2 - cxInCrop);
  const top = Math.round(side / 2 - cyInCrop);

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: cropped, left, top }])
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
