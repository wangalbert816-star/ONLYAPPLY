import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
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

/** Drop bullet / label-only paragraphs left empty after render. Keep HR / border paragraphs. */
function stripEmptyParagraphs(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    if (/<w:pict|<w:pBdr|<w:drawing|<v:rect|<w:br\b/.test(para)) return para;
    const text = paragraphPlainText(para);
    if (!text) return "";
    if (/^▪\s*(AP Courses:|Relevant Coursework:)?\s*$/.test(text)) return "";
    return para;
  });
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
  const zip = prepareTemplateZip(new PizZip(template));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "[", end: "]" },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(resumeFormToTemplateData(form));

  const outZip = doc.getZip();
  const documentXml = outZip.file("word/document.xml");
  if (documentXml) {
    outZip.file("word/document.xml", stripEmptyParagraphs(documentXml.asText()));
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
