import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RenderedPdfPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converts a base64 encoded string to Uint8Array with fast loop unrolling.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  const step = 8;
  const bound = len - (len % step);
  let i = 0;
  for (; i < bound; i += step) {
    bytes[i] = binaryString.charCodeAt(i);
    bytes[i + 1] = binaryString.charCodeAt(i + 1);
    bytes[i + 2] = binaryString.charCodeAt(i + 2);
    bytes[i + 3] = binaryString.charCodeAt(i + 3);
    bytes[i + 4] = binaryString.charCodeAt(i + 4);
    bytes[i + 5] = binaryString.charCodeAt(i + 5);
    bytes[i + 6] = binaryString.charCodeAt(i + 6);
    bytes[i + 7] = binaryString.charCodeAt(i + 7);
  }
  for (; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Renders page 1 of a PDF (from Uint8Array or ArrayBuffer) onto an offscreen canvas and returns a data URL.
 * Max dimension is capped at 750px for fast, responsive rendering performance and minimal memory consumption.
 */
export async function renderPdfPage1(
  pdfData: Uint8Array | ArrayBuffer,
  maxDimension = 650
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
    verbosity: 0,
    stopAtErrors: true,
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
  let page: pdfjsLib.PDFPageProxy | null = null;
  const canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D | null = null;

  try {
    page = await pdfDoc.getPage(targetPage);

    const defaultViewport = page.getViewport({ scale: 1.0 });
    const longestEdge = Math.max(defaultViewport.width, defaultViewport.height);
    const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1.0;
    const viewport = page.getViewport({ scale: Math.max(0.2, scale) });

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport,
      canvas,
      renderIntent: 'display',
    };

    await page.render(renderContext).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    if (page) {
      try {
        page.cleanup();
      } catch {
        // ignore
      }
    }
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.width = 1;
    canvas.height = 1;
  }
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
    verbosity: 0,
    stopAtErrors: true,
  });
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    pdfDoc = await loadingTask.promise;
    return pdfDoc.numPages;
  } finally {
    if (pdfDoc) {
      try {
        await pdfDoc.cleanup();
      } catch {
        // ignore
      }
    }
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Renders any specified 1-based page of a PDF onto an offscreen canvas and returns a data URL.
 * Automatically cleans up the PDFDocumentProxy, loadingTask, and offscreen canvas after rendering
 * to prevent Web Worker memory leaks and 4GB+ RAM spikes.
 */
export async function renderPdfPage(
  pdfData: Uint8Array | ArrayBuffer,
  pageNum: number,
  maxDimension = 650
): Promise<RenderedPdfPage> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    useSystemFonts: true,
    verbosity: 0,
    stopAtErrors: true,
  });

  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  let page: pdfjsLib.PDFPageProxy | null = null;
  const canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D | null = null;

  try {
    pdfDoc = await loadingTask.promise;
    const targetPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
    page = await pdfDoc.getPage(targetPage);

    const defaultViewport = page.getViewport({ scale: 1.0 });
    const longestEdge = Math.max(defaultViewport.width, defaultViewport.height);
    const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1.0;
    const viewport = page.getViewport({ scale: Math.max(0.2, scale) });

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
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
      renderIntent: 'display',
    };

    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    if (page) {
      try {
        page.cleanup();
      } catch {
        // ignore
      }
    }
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.width = 1;
    canvas.height = 1;

    if (pdfDoc) {
      try {
        await pdfDoc.cleanup();
      } catch {
        // ignore
      }
    }
    await loadingTask.destroy().catch(() => {});
  }
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
