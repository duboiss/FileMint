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
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);

  const defaultViewport = page.getViewport({ scale: 1.0 });
  const longestEdge = Math.max(defaultViewport.width, defaultViewport.height);
  const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1.0;
  const viewport = page.getViewport({ scale: Math.max(0.5, scale) });

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

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}
