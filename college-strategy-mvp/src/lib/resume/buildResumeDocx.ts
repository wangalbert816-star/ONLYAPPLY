import type PizZip from "pizzip";
import type { ResumeFormData } from "./types";
import { resumeFormToTemplateData } from "./resumeForm";

const TEMPLATE_URL = "/templates/Resume.docx?v=4";

/** docxtemplater only parses `w:` tags; some editors emit `ns0:` prefixes. */
function normalizeWordXml(xml: string): string {
  return xml
    .replace(/xmlns:ns0=/g, "xmlns:w=")
    .replace(/xmlns:ns1=/g, "xmlns:w14=")
    .replace(/xmlns:ns2=/g, "xmlns:v=")
    .replace(/xmlns:ns3=/g, "xmlns:o=")
    .replace(/<(\/?)ns0:/g, "<$1w:")
    .replace(/<(\/?)ns1:/g, "<$1w14:")
    .replace(/<(\/?)ns2:/g, "<$1v:")
    .replace(/<(\/?)ns3:/g, "<$1o:")
    .replace(/\bns0:/g, "w:")
    .replace(/\bns1:/g, "w14:")
    .replace(/\bns2:/g, "v:")
    .replace(/\bns3:/g, "o:");
}

function paragraphPlainText(paraXml: string): string {
  return [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join("")
    .trim();
}

function rowPlainText(rowXml: string): string {
  return [...rowXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldDropRenderableText(text: string): boolean {
  if (!text) return true;
  if (/\bundefined\b/i.test(text)) return true;
  if (/^▪\s*(AP Courses:|Relevant Coursework:)?\s*$/.test(text)) return true;
  if (/^Expected Graduation:\s*$/i.test(text)) return true;
  if (/^GPA:\s*\/\s*4\.0(?:\s*·\s*Rank:\s*\/\s*)?$/i.test(text)) return true;
  if (/^GPA:\s*\/\s*4\.0\s*·\s*Rank:\s*\/\s*$/i.test(text)) return true;
  if (/^▪\s*$/.test(text)) return true;
  if (/^Technical Skills:\s*$/i.test(text)) return true;
  if (/^Languages:\s*$/i.test(text)) return true;
  if (/^Interests:\s*$/i.test(text)) return true;
  return false;
}

/** Drop bullet / label-only paragraphs left empty after render. Keep HR / border paragraphs. */
function stripEmptyParagraphs(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    if (/<w:pict|<w:pBdr|<w:drawing|<v:rect|<w:br\b/.test(para)) return para;
    const text = paragraphPlainText(para);
    if (shouldDropRenderableText(text)) return "";
    return para;
  });
}

function stripEmptyTableRows(xml: string): string {
  return xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
    const text = rowPlainText(row);
    if (shouldDropRenderableText(text)) return "";
    return row;
  });
}

function stripUndefinedTextNodes(xml: string): string {
  return xml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (full, attrs, text) => {
    if (text === "undefined") return `<w:t${attrs}></w:t>`;
    if (/\bundefined\b/.test(text)) {
      const cleaned = text.replace(/\bundefined\b/g, "").replace(/\s+/g, " ").trim();
      if (!cleaned) return `<w:t${attrs}></w:t>`;
      return `<w:t${attrs}>${cleaned}</w:t>`;
    }
    return full;
  });
}

function cleanRenderedDocumentXml(xml: string): string {
  return stripEmptyTableRows(stripEmptyParagraphs(stripUndefinedTextNodes(xml)));
}

function prepareTemplateZip(zip: PizZip): PizZip {
  const documentXml = zip.file("word/document.xml");
  if (documentXml) {
    zip.file("word/document.xml", normalizeWordXml(documentXml.asText()));
  }
  return zip;
}

let templateCache: ArrayBuffer | null = null;

async function loadTemplate(): Promise<ArrayBuffer> {
  if (templateCache) return templateCache;
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error("resume_template_missing");
  }
  templateCache = await response.arrayBuffer();
  return templateCache;
}

export async function generateResumeDocx(form: ResumeFormData): Promise<Blob> {
  const template = await loadTemplate();
  // Lazy-load docxtemplater + pizzip only when the user generates a resume,
  // keeping these heavy libraries out of the initial bundle.
  const [{ default: PizZipImpl }, { default: DocxtemplaterImpl }] = await Promise.all([
    import("pizzip"),
    import("docxtemplater"),
  ]);
  const zip = prepareTemplateZip(new PizZipImpl(template));
  const doc = new DocxtemplaterImpl(zip, {
    delimiters: { start: "[", end: "]" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(resumeFormToTemplateData(form));

  const outZip = doc.getZip();
  const documentXml = outZip.file("word/document.xml");
  if (documentXml) {
    outZip.file("word/document.xml", cleanRenderedDocumentXml(documentXml.asText()));
  }

  return outZip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  }) as Blob;
}

export function downloadResumeBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resumeDownloadFilename(fullName: string): string {
  const base = fullName.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") || "Resume";
  return `${base}_Resume.docx`;
}
