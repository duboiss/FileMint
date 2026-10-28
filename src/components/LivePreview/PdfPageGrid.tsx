import React, { useEffect, useState, useRef } from 'react';
import { useFileMintStore } from '../../store/useFileMintStore';
import {
  loadPdfDocument,
  renderPdfPageFromDoc,
} from '../../utils/pdfPreviewRenderer';
import { invoke } from '@tauri-apps/api/core';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  Check,
  CheckSquare,
  Square,
  RotateCcw,
  Loader2,
  FileText,
  Layers,
} from 'lucide-react';

export const PdfPageGrid: React.FC = () => {
  const {
    files,
    activePreviewIndex,
    selectedPdfPages,
    togglePdfPageSelection,
    selectAllPdfPages,
    deselectAllPdfPages,
    invertPdfPageSelection,
    setSelectedPdfPages,
    activePdfTotalPages,
    setActivePdfTotalPages,
    t,
  } = useFileMintStore();

  const activeFile = files[activePreviewIndex];
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageThumbnails, setPageThumbnails] = useState<Record<number, string>>({});
  const renderedPagesRef = useRef<Set<number>>(new Set());

  // Load the PDF document proxy when active file changes
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      if (!activeFile || activeFile.fileType !== 'pdf') return;

      setLoading(true);
      setError(null);
      setPageThumbnails({});
      renderedPagesRef.current = new Set();

      try {
        let pdfBytes: Uint8Array;
        try {
          const rawBytes = await invoke<number[] | Uint8Array>('load_pdf_bytes', {
            path: activeFile.path,
          });
          pdfBytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
        } catch {
          // Mock / Fallback if running outside Tauri
          const res = await fetch(activeFile.path);
          const buf = await res.arrayBuffer();
          pdfBytes = new Uint8Array(buf);
        }

        if (isCancelled) return;

        const doc = await loadPdfDocument(pdfBytes);
        if (isCancelled) return;

        setPdfDoc(doc);
        const total = doc.numPages;
        setActivePdfTotalPages(total);

        // If no pages currently selected, default to select all
        if (selectedPdfPages.length === 0) {
          setSelectedPdfPages(Array.from({ length: total }, (_, i) => i + 1));
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : 'Impossible de charger le document PDF'
          );
          setLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [activeFile?.path]);

  // Render visible or requested pages progressively
  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    async function renderAllThumbnails() {
      if (!pdfDoc) return;
      const total = pdfDoc.numPages;

      for (let p = 1; p <= total; p++) {
        if (isCancelled) break;
        if (renderedPagesRef.current.has(p)) continue;

        try {
          renderedPagesRef.current.add(p);
          const rendered = await renderPdfPageFromDoc(pdfDoc, p, 320);
          if (isCancelled) break;

          setPageThumbnails((prev) => ({
            ...prev,
            [p]: rendered.dataUrl,
          }));
        } catch (err) {
          console.warn(`Erreur de rendu de la page ${p}:`, err);
        }
      }
    }

    renderAllThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
        {t.noFileSelected}
      </div>
    );
  }

  const selectEven = () => {
    const total = activePdfTotalPages;
    const even = Array.from({ length: total }, (_, i) => i + 1).filter(
      (p) => p % 2 === 0
    );
    setSelectedPdfPages(even);
  };

  const selectOdd = () => {
    const total = activePdfTotalPages;
    const odd = Array.from({ length: total }, (_, i) => i + 1).filter(
      (p) => p % 2 !== 0
    );
    setSelectedPdfPages(odd);
  };

  const totalPages = activePdfTotalPages || 1;
  const selectedCount = selectedPdfPages.length;

  return (
    <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-950/40 overflow-hidden relative select-none">
      {/* Top Toolbar */}
      <div className="h-12 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 flex items-center justify-between gap-3 text-xs backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-mint-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {selectedCount} / {totalPages}{' '}
            <span className="text-slate-400 font-normal">
              {t.pdfSelectedPagesCount}
            </span>
          </span>
        </div>

        {/* Quick select buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={selectAllPdfPages}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-mint-500/20 hover:text-mint-600 dark:hover:text-mint-400 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer flex items-center gap-1"
            title={t.pdfSelectAll}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.pdfSelectAll}</span>
          </button>

          <button
            type="button"
            onClick={deselectAllPdfPages}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer flex items-center gap-1"
            title={t.pdfDeselectAll}
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.pdfDeselectAll}</span>
          </button>

          <button
            type="button"
            onClick={invertPdfPageSelection}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer flex items-center gap-1"
            title={t.pdfInvertSelection}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.pdfInvertSelection}</span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={selectEven}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer"
            title={t.pdfSelectEven}
          >
            {t.pdfSelectEven}
          </button>

          <button
            type="button"
            onClick={selectOdd}
            className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer"
            title={t.pdfSelectOdd}
          >
            {t.pdfSelectOdd}
          </button>
        </div>
      </div>

      {/* Pages Grid Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-mint-500" />
            <span className="text-xs">{t.previewLoading}</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2 p-6 text-center">
            <FileText className="w-10 h-10 stroke-1 text-red-400 mb-1" />
            <p className="font-semibold text-sm">{t.previewUnavailable}</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isSelected = selectedPdfPages.includes(pageNum);
              const thumbUrl = pageThumbnails[pageNum];

              return (
                <div
                  key={pageNum}
                  onClick={() => togglePdfPageSelection(pageNum)}
                  className={`group relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col select-none bg-white dark:bg-slate-900 shadow-sm ${
                    isSelected
                      ? 'border-mint-500 ring-4 ring-mint-500/20 shadow-md scale-[1.01]'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Card Header Badge */}
                  <div className="p-2 px-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800/60 z-10">
                    <span className="text-[11px] font-bold font-mono text-slate-700 dark:text-slate-300">
                      #{pageNum}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-mint-500 text-slate-950 shadow-sm'
                          : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Thumbnail / Preview Area */}
                  <div className="relative aspect-[1/1.41] bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Page ${pageNum}`}
                        className="w-full h-full object-contain pointer-events-none"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-1.5 p-4 text-center">
                        <FileText className="w-8 h-8 stroke-1" />
                        <span className="text-[10px] font-mono">
                          Page {pageNum}
                        </span>
                      </div>
                    )}

                    {/* Dark overlay when not selected */}
                    {!isSelected && (
                      <div className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/40 pointer-events-none group-hover:opacity-0 transition-opacity" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
