/** Extract text or page images from PDF buffers (Node). */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
try {
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
} catch {
  GlobalWorkerOptions.workerSrc = new URL(
    "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).href;
}

/** pdfjs-dist rejects Node Buffer even though Buffer extends Uint8Array. */
function toPdfUint8Array(buffer) {
  if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer);
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

function pdfDocumentParams(buffer) {
  return { data: toPdfUint8Array(buffer), useSystemFonts: true, disableFontFace: true };
}

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset({ canvas }, width, height) {
    canvas.width = width;
    canvas.height = height;
  }

  destroy({ canvas }) {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * @param {Buffer | Uint8Array} buffer
 * @returns {Promise<string>}
 */
function appendTextLine(lines, parts) {
  const line = parts.join(" ").replace(/\s+/g, " ").trim();
  if (line) lines.push(line);
}

/** Group PDF text items by Y position so table rows survive as separate lines. */
function textItemsToLines(items) {
  const lines = [];
  let currentParts = [];
  let lastY = null;
  for (const item of items) {
    if (!("str" in item) || !item.str) continue;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5) {
      appendTextLine(lines, currentParts);
      currentParts = [];
    }
    currentParts.push(item.str);
    if (y !== null) lastY = y;
  }
  appendTextLine(lines, currentParts);
  return lines;
}

export async function getPdfPageCount(buffer) {
  const doc = await getDocument(pdfDocumentParams(buffer)).promise;
  return doc.numPages;
}

export async function renderPdfPageToPngBase64(buffer, pageNum, scale = 2) {
  const doc = await getDocument(pdfDocumentParams(buffer)).promise;
  if (pageNum < 1 || pageNum > doc.numPages) {
    throw new Error(`pdf_page_out_of_range:${pageNum}`);
  }
  const factory = new NodeCanvasFactory();
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const { canvas, context } = factory.create(viewport.width, viewport.height);
  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory: factory,
  }).promise;
  const b64 = canvas.toBuffer("image/png").toString("base64");
  factory.destroy({ canvas, context });
  return b64;
}

export async function extractPdfText(buffer) {
  const doc = await getDocument(pdfDocumentParams(buffer)).promise;
  const chunks = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    chunks.push(...textItemsToLines(textContent.items));
  }
  return chunks.join("\n").trim();
}

/**
 * Render up to `maxPages` PDF pages to PNG base64 strings for vision LLM.
 * @param {Buffer | Uint8Array} buffer
 * @param {number} maxPages
 * @returns {Promise<string[]>}
 */
export async function renderPdfPagesToPngBase64(buffer, maxPages = 3) {
  const doc = await getDocument(pdfDocumentParams(buffer)).promise;
  const limit = Math.min(doc.numPages, maxPages);
  const images = [];
  const factory = new NodeCanvasFactory();

  for (let pageNum = 1; pageNum <= limit; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const { canvas, context } = factory.create(viewport.width, viewport.height);
    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory: factory,
    }).promise;
    images.push(canvas.toBuffer("image/png").toString("base64"));
    factory.destroy({ canvas, context });
  }

  return images;
}
