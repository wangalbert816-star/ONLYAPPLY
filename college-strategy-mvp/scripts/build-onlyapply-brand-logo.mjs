/**
 * 从 public/onlyapply-logo-source.png 生成透明底字标 public/onlyapply-logo.png。
 * - 单版小图（仅蓝+黑字标）：整图抠浅灰底。
 * - 旧版上下双图：先裁掉下方深色条再抠底。
 * 用法：node scripts/build-onlyapply-brand-logo.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../public/onlyapply-logo-source.png");
const OUT = path.resolve(__dirname, "../public/onlyapply-logo.png");

/** 高度大于等于此值时视为「上下双版本」合成图，需裁掉底部深色字标 */
const COMPOSITE_MIN_HEIGHT = 900;
/** 裁切高度：略小于深色圆角条开始出现的位置 */
const CROP_BOTTOM_BEFORE_ROW = 532;

const SIM = 46;

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
  if (n === 0) return { r: 240, g: 242, b: 247 };
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
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
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

/** 去掉字标内未与边缘连通的白/浅灰底（如 O、p 的内洞） */
function knockOpaqueNeutralLight(data, w, h, { minL = 248, maxSpread = 14 } = {}) {
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

async function main() {
  const meta = await sharp(SRC).metadata();
  const fullH = meta.height ?? 0;
  const fullW = meta.width ?? 0;
  const useCompositeCrop = fullH >= COMPOSITE_MIN_HEIGHT;
  const cropH = useCompositeCrop ? Math.min(CROP_BOTTOM_BEFORE_ROW, fullH) : fullH;

  const pipeline = sharp(SRC);
  if (useCompositeCrop) {
    pipeline.extract({ left: 0, top: 0, width: fullW, height: cropH });
  }

  const cropped = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const w = cropped.info.width;
  const h = cropped.info.height;
  const copy = new Uint8ClampedArray(cropped.data);
  floodKnockout(copy, w, h, SIM);
  knockOpaqueNeutralLight(copy, w, h);

  const buf = await sharp(Buffer.from(copy), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .trim()
    .toBuffer();

  await fs.writeFile(OUT, buf);
  const after = await sharp(OUT).metadata();
  console.log("wrote", OUT, {
    from: `${fullW}x${fullH}`,
    to: `${after.width}x${after.height}`,
    compositeCrop: useCompositeCrop,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
