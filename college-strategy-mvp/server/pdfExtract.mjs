/** Extract text or page images from PDF buffers (Node). */

import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = new URL(
  "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).href;

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
export async function extractPdfText(buffer) {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const chunks = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const line = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    if (line.trim()) chunks.push(line);
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
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
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
