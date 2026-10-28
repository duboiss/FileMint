import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RenderedPdfPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converts a base64 encoded string to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Renders page 1 of a PDF (from Uint8Array or ArrayBuffer) onto an offscreen canvas and returns a data URL.
 * Max width is capped at 1000px for instant rendering performance and low memory consumption.
 */
export async function renderPdfPage1(
  pdfData: Uint8Array | ArrayBuffer,
  maxDimension = 1000
): Promise<RenderedPdfPage> {
  return renderPdfPage(pdfData, 1, maxDimension);
}

/**
 * Loads a PDF document instance for efficient multi-page rendering.
 */
export async function loadPdfDocument(
  pdfData: Uint8Array | ArrayBuffer
): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    useSystemFonts: true,
  });
  return loadingTask.promise;
}

/**
 * Renders a specific 1-based page from an already loaded PDFDocumentProxy.
 */
export async function renderPdfPageFromDoc(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  maxDimension = 350
): Promise<RenderedPdfPage> {
  const targetPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
  const page = await pdfDoc.getPage(targetPage);

  const defaultViewport = page.getViewport({ scale: 1.0 });
  const longestEdge = Math.max(defaultViewport.width, defaultViewport.height);
  const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1.0;
  const viewport = page.getViewport({ scale: Math.max(0.2, scale) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport,
    canvas,
  };

  await page.render(renderContext).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Gets the total number of pages in a PDF document without rendering them.
 */
export async function getPdfPageCount(
  pdfData: Uint8Array | ArrayBuffer
): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  return pdfDoc.numPages;
}

/**
 * Renders any specified 1-based page of a PDF onto an offscreen canvas and returns a data URL.
 */
export async function renderPdfPage(
  pdfData: Uint8Array | ArrayBuffer,
  pageNum: number,
  maxDimension = 600
): Promise<RenderedPdfPage> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const targetPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
  const page = await pdfDoc.getPage(targetPage);

  const defaultViewport = page.getViewport({ scale: 1.0 });
  const longestEdge = Math.max(defaultViewport.width, defaultViewport.height);
  const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1.0;
  const viewport = page.getViewport({ scale: Math.max(0.2, scale) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }

  // White background for transparent PDF pages
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport,
    canvas,
  };

  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Parses user input page ranges (e.g. "1-3, 5, 8-fin", "pairs", "impairs") into an array of 1-based page numbers.
 */
export function parsePageRange(input: string, maxPages: number): number[] {
  if (!input || !input.trim() || maxPages <= 0) return [];
  const normalized = input.toLowerCase().replace(/;/g, ',');
  const set = new Set<number>();

  for (const rawPart of normalized.split(/[,\s]+/)) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part === 'pairs' || part === 'even') {
      for (let p = 2; p <= maxPages; p += 2) set.add(p);
      continue;
    }
    if (part === 'impairs' || part === 'odd') {
      for (let p = 1; p <= maxPages; p += 2) set.add(p);
      continue;
    }
    if (part === 'toutes' || part === 'all' || part === '*') {
      for (let p = 1; p <= maxPages; p++) set.add(p);
      continue;
    }

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10) || 1;
      const end =
        endStr.trim() === 'fin' || endStr.trim() === 'end'
          ? maxPages
          : parseInt(endStr, 10) || maxPages;
      const [from, to] = start <= end ? [start, end] : [end, start];
      for (let p = from; p <= to; p++) {
        if (p >= 1 && p <= maxPages) set.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPages) {
        set.add(p);
      }
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Formats an array of 1-based page numbers into a compact range string (e.g. [1, 2, 3, 5] -> "1-3, 5").
 */
export function formatPageRange(pages: number[]): string {
  if (!pages || pages.length === 0) return '';
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const ranges: string[] = [];

  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = start;
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return ranges.join(', ');
}
