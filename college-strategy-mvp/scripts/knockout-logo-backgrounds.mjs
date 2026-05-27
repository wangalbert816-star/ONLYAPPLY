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
  "michigan.png": { sim: 52, neutralMinL: 198, neutralSpread: 36 },
  "ucla.png": { sim: 42 },
  "berkeley.png": { sim: 48 },
  "mit.png": { sim: 50 },
  "babson.png": { sim: 50, neutralMinL: 198, neutralSpread: 34 },
};

/** 走马灯专用：保留原图，不做通用抠图 */
const SKIP_KNOCKOUT = new Set(["ucla.png"]);

function knockPrincetonWhiteBg(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) continue;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const l = (r + g + b) / 3;
    if (l >= 248 && spread <= 12) data[i + 3] = 0;
  }
}

/** Princeton：仅去掉外围白底，盾形/橙/黑/书页不动 */
async function processPrincetonWhiteBgOnly(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const copy = new Uint8ClampedArray(data);
  knockPrincetonWhiteBg(copy);
  const trimmed = await sharp(Buffer.from(copy), { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  await fs.writeFile(filePath, trimmed);
  const meta = await sharp(trimmed).metadata();
  console.log("ok", path.basename(filePath), { mode: "white-bg-only", out: `${meta.width}x${meta.height}` });
}

function keepNyuPurplePixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 28) return false;
  if (max - min < 18) return false;
  const l = (r + g + b) / 3;
  if (l < 35 || l > 235) return false;
  if (b < 45 || r < 45) return false;
  if (g > Math.min(r, b) * 0.92) return false;
  return r + b > g * 2.2;
}

/** 抠图后收紧紫条与 NYU 字之间的透明缝，避免走马灯里像空一格 */
function tightenNyuHorizontalGap(data, w, h, targetGapPx = 10) {
  const colCount = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 30) colCount[x]++;
    }
  }
  let first = -1;
  let last = -1;
  for (let x = 0; x < w; x++) {
    if (colCount[x] > 0) {
      if (first < 0) first = x;
      last = x;
    }
  }
  if (first < 0) return data;

  let gapStart = -1;
  let gapEnd = -1;
  let inGap = false;
  for (let x = first; x <= last; x++) {
    if (colCount[x] === 0) {
      if (!inGap) {
        gapStart = x;
        inGap = true;
      }
      gapEnd = x;
    } else if (inGap) {
      break;
    }
  }
  if (gapStart < 0 || gapEnd < gapStart) return data;

  const gapWidth = gapEnd - gapStart + 1;
  const shift = gapWidth - targetGapPx;
  if (shift <= 0) return data;

  const out = new Uint8ClampedArray(data);
  out.fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] < 30) continue;
      const nx = x > gapEnd ? x - shift : x;
      if (nx < 0 || nx >= w) continue;
      const no = (y * w + nx) * 4;
      out[no] = data[o];
      out[no + 1] = data[o + 1];
      out[no + 2] = data[o + 2];
      out[no + 3] = data[o + 3];
    }
  }
  return out;
}

/** NYU wordmark: keep brand purple only; black / white / gray → transparent */
async function processNyuPurpleOnly(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let copy = new Uint8ClampedArray(data);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (!keepNyuPurplePixel(copy[o], copy[o + 1], copy[o + 2])) copy[o + 3] = 0;
  }
  copy = tightenNyuHorizontalGap(copy, w, h, 10);
  const trimmed = await sharp(Buffer.from(copy), { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  await fs.writeFile(filePath, trimmed);
  const meta = await sharp(trimmed).metadata();
  console.log("ok", path.basename(filePath), { mode: "purple-only", out: `${meta.width}x${meta.height}` });
}

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

/** 去掉已烘焙进 PNG 的白底 / 灰底棋盘格（不透明浅色中性像素） */
function knockOpaqueNeutralLight(data, w, h, { minL = 200, maxSpread = 32 } = {}) {
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const l = (r + g + b) / 3;
    if (l >= minL && spread <= maxSpread) {
      data[o + 3] = 0;
    }
  }
}

async function processFile(filePath) {
  const base = path.basename(filePath);
  const opts = PER_FILE[base] ?? {};
  const sim = opts.sim ?? DEFAULT_SIM;
  const neutralMinL = opts.neutralMinL ?? 200;
  const neutralSpread = opts.neutralSpread ?? 32;

  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const copy = new Uint8ClampedArray(data);
  floodKnockout(copy, w, h, sim);
  if (!opts.skipNeutralKnock) {
    knockOpaqueNeutralLight(copy, w, h, { minL: neutralMinL, maxSpread: neutralSpread });
  }

  const trimmed = await sharp(Buffer.from(copy), {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 8 })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  await fs.writeFile(filePath, trimmed);

  const meta = await sharp(trimmed).metadata();
  console.log("ok", base, { sim, neutralMinL, neutralSpread, out: `${meta.width}x${meta.height}` });
}

async function main() {
  const entries = await fs.readdir(LOGOS_DIR);
  const pngs = entries.filter((f) => f.endsWith(".png") && !f.includes("-source"));
  if (pngs.length === 0) {
    console.error("no png in", LOGOS_DIR);
    process.exit(1);
  }
  for (const f of pngs) {
    const filePath = path.join(LOGOS_DIR, f);
    if (f === "nyu.png") {
      const src = path.join(LOGOS_DIR, "nyu-source.png");
      try {
        await fs.access(src);
        await fs.copyFile(src, filePath);
      } catch {
        /* use existing nyu.png pixels */
      }
      await processNyuPurpleOnly(filePath);
      continue;
    }
    if (f === "princeton.png") {
      const src = path.join(LOGOS_DIR, "princeton-source.png");
      try {
        await fs.access(src);
        await fs.copyFile(src, filePath);
      } catch {
        /* use existing princeton.png pixels */
      }
      await processPrincetonWhiteBgOnly(filePath);
      continue;
    }
    if (SKIP_KNOCKOUT.has(f)) {
      const src = path.join(LOGOS_DIR, f.replace(".png", "-source.png"));
      try {
        await fs.access(src);
        await fs.copyFile(src, filePath);
      } catch {
        /* keep current asset */
      }
      const meta = await sharp(filePath).metadata();
      console.log("skip", f, { mode: "source-only", out: `${meta.width}x${meta.height}` });
      continue;
    }
    await processFile(filePath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
