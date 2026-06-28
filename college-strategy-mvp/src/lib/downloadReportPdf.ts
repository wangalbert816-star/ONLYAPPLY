function sanitizeFilenamePart(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").slice(0, 48) || "report";
}

export function buildReportPdfFilename(intakeLabel: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `OnlyApply-${sanitizeFilenamePart(intakeLabel)}-${date}.pdf`;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function preparePdfClone(source: HTMLElement): { clone: HTMLElement; host: HTMLDivElement } {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add("report-pdf-clone");
  clone.classList.remove("report-pdf-export-root");
  clone.removeAttribute("aria-hidden");
  clone.querySelectorAll("[data-no-pdf]").forEach((el) => el.remove());

  // html2canvas cannot capture visibility:hidden or far off-screen nodes
  clone.style.visibility = "visible";
  clone.style.opacity = "1";
  clone.style.position = "relative";
  clone.style.display = "block";
  clone.style.width = "210mm";
  clone.style.left = "0";
  clone.style.top = "0";

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.className = "report-pdf-export-host";
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.zIndex = "-99999";
  host.style.pointerEvents = "none";
  host.style.visibility = "visible";
  host.style.opacity = "1";
  host.style.overflow = "visible";
  host.style.background = "#ffffff";

  host.appendChild(clone);
  document.body.appendChild(host);
  return { clone, host };
}

export async function downloadReportPdf(source: HTMLElement, filename: string): Promise<void> {
  const { clone, host } = preparePdfClone(source);
  try {
    await waitForPaint();
    await waitForImages(clone);

    const opts = {
      margin: [10, 8, 12, 8] as [number, number, number, number],
      filename,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth || 794,
        windowHeight: clone.scrollHeight || 1123,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        after: ".pdf-cover-page",
        before: [".pdf-section--break-before", ".pdf-radar-panel"],
        avoid: [
          "pdf-keep",
          "pdf-radar-panel",
          "pdf-cover-page",
          "pdf-verdict-card",
          "pdf-action-block",
          "pdf-footer",
        ],
      },
    };
    // Lazy-load html2pdf.js (and its html2canvas/jsPDF deps) only when the user
    // actually exports a PDF, keeping it out of the initial bundle.
    const { default: html2pdf } = await import("html2pdf.js");
    await html2pdf().set(opts as never).from(clone).save();
  } finally {
    host.remove();
  }
}
