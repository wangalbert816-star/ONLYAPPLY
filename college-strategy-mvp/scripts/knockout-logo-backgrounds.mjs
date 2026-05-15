/**
 * 将 PNG 中与边缘连通的浅色背景转为透明（抠白底 / 灰底）。
 * 用法：node scripts/knockout-logo-backgrounds.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = path.resolve(__dirname, "../src/assets/logos");

/** 与边缘参考色的欧氏距离阈值；略大更敢吃底，太大可能伤 logo 浅色块 */
const DEFAULT_SIM = 44;

/** 按文件微调（边缘参考色异常时可调） */
const PER_FILE = {
  "harvard.png": { sim: 40 },
  "stanford.png": { sim: 46 },
  "columbia.png": { sim: 42 },
  "brown.png": { sim: 38 },
  "duke.png": { sim: 52 },
  "michigan.png": { sim: 48 },
  "ucla.png": { sim: 42 },
  "berkeley.png": { sim: 48 },
  "mit.png": { sim: 50 },
  "amherst.png": { sim: 44 },
};

function edgeBackgroundRef(data, w, h) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const push = (x, y) => {
    const o = (y * w + x) * 4;
    const a = data[o + 3];
    if (a < 12) return;
    r += data[o];
    g += data[o + 1];
    b += data[o + 2];
    n += 1;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  if (n === 0) {
    return { r: 252, g: 252, b: 252 };
  }
  return { r: r / n, g: g / n, b: b / n };
}

function dist(o, br, bg, bb, data) {
  const dr = data[o] - br;
  const dg = data[o + 1] - bg;
  const db = data[o + 2] - bb;
  return Math.hypot(dr, dg, db);
}

function floodKnockout(data, w, h, sim) {
  const { r: br, g: bg, b: bb } = edgeBackgroundRef(data, w, h);
  const marked = new Uint8Array(w * h);
  const q = [];

  const similar = (o) => dist(o, br, bg, bb, data) < sim;

  const trySeed = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = y * w + x;
    if (marked[i]) return;
    const o = i * 4;
    if (data[o + 3] < 18) {
      marked[i] = 1;
      q.push(i);
      return;
    }
    if (similar(o)) {
      marked[i] = 1;
      q.push(i);
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (marked[ni]) continue;
      const o = ni * 4;
      if (data[o + 3] < 22) {
        marked[ni] = 1;
        q.push(ni);
        continue;
      }
      if (similar(o)) {
        marked[ni] = 1;
        q.push(ni);
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (!marked[i]) continue;
    data[i * 4 + 3] = 0;
  }
}

async function processFile(filePath) {
  const base = path.basename(filePath);
  const opts = PER_FILE[base] ?? {};
  const sim = opts.sim ?? DEFAULT_SIM;

  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const copy = new Uint8ClampedArray(data);
  floodKnockout(copy, w, h, sim);

  await sharp(Buffer.from(copy), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(filePath);

  console.log("ok", base, { sim });
}

async function main() {
  const entries = await fs.readdir(LOGOS_DIR);
  const pngs = entries.filter((f) => f.endsWith(".png"));
  if (pngs.length === 0) {
    console.error("no png in", LOGOS_DIR);
    process.exit(1);
  }
  for (const f of pngs) {
    await processFile(path.join(LOGOS_DIR, f));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
