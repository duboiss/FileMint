import React, { useState, useEffect, useRef } from 'react';
import { PreviewResult, FileItem } from '../../types';
import { useFileMintStore, formatFileSize } from '../../store/useFileMintStore';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Sliders,
  Columns,
  Eye,
  ArrowRight,
  Move,
  Loader2,
} from 'lucide-react';

interface LargePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: PreviewResult | null;
  activeFile: FileItem | null;
}

export const LargePreviewModal: React.FC<LargePreviewModalProps> = ({
  isOpen,
  onClose,
  preview: propPreview,
  activeFile,
}) => {
  const {
    t,
    language,
    imageOptions,
    setImageOptions,
    preview: storePreview,
    previewLoading,
  } = useFileMintStore();

  const currentPreview = storePreview || propPreview;

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'split' | 'sideBySide' | 'single'>('split');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const qualityRef = useRef(imageOptions.quality);
  qualityRef.current = imageOptions.quality;

  const updateSplitPosition = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(Math.round(percent));
  };

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingSplit(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSplitPosition(e.clientX, e.currentTarget);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplit) {
      e.stopPropagation();
      updateSplitPosition(e.clientX, e.currentTarget);
    }
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplit) {
      e.stopPropagation();
      setIsDraggingSplit(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Reset zoom and pan offset when opening
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Keyboard shortcuts: Escape to close, +/- zoom, [/] quality, 0/r reset pan
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((z) => Math.min(4, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-') {
        setZoomLevel((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === '[') {
        setImageOptions({ quality: Math.max(10, qualityRef.current - 5), lossless: false });
      } else if (e.key === ']') {
        setImageOptions({ quality: Math.min(100, qualityRef.current + 5), lossless: false });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, setImageOptions]);

  if (!isOpen || !activeFile) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-[96vw] h-[94vh] rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-mint-500/10 text-mint-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100 cursor-help" title={activeFile.path}>
                  {activeFile.name}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  {t.initial}{' '}
                  <strong className="text-slate-200 font-mono">
                    {formatFileSize(activeFile.sizeBytes, language)}
                  </strong>{' '}
                  ({activeFile.width}×{activeFile.height})
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                {currentPreview ? (
                  <span className="text-slate-400">
                    {t.projected}{' '}
                    <strong className="text-mint-400 font-mono">
                      {formatFileSize(currentPreview.estimated_bytes, language)}
                    </strong>{' '}
                    ({currentPreview.new_width}×{currentPreview.new_height})
                  </span>
                ) : null}
                {currentPreview && currentPreview.saved_percentage > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                    -{currentPreview.saved_percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                  viewMode === 'split'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.viewSplit}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{t.viewSplit}</span>
              </button>
              <button
                onClick={() => setViewMode('sideBySide')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                  viewMode === 'sideBySide'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.viewSideBySide}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>{t.viewSideBySide}</span>
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                  viewMode === 'single'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.viewSingle}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{t.viewSingle}</span>
              </button>
            </div>

            <div className="w-[1px] h-5 bg-slate-800" />

            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700/60">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300"
                title={`${t.zoomOut} (-)`}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(zoomLevel === 1 ? 2 : 1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="px-2 py-1 rounded text-[11px] font-mono text-mint-400 hover:bg-slate-700/60 font-semibold min-w-[50px] text-center"
                title="100% / Fit"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300"
                title={`${t.zoomIn} (+)`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                title={`${t.resetZoom} (0)`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-[1px] h-5 bg-slate-800" />

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-slate-700/60 cursor-pointer"
              title={`${t.close} (Esc)`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className={`flex-1 relative overflow-hidden flex items-center justify-center p-4 bg-slate-950/60 ${
            zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {zoomLevel > 1 && (
            <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <Move className="w-3.5 h-3.5 text-mint-400" />
              <span>{t.dragToPan}</span>
            </div>
          )}

          {currentPreview?.data_url ? (
            <div
              className="transition-transform duration-75 ease-out max-h-full max-w-full flex items-center justify-center"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            >
              {viewMode === 'split' && (
                <div
                  onPointerDown={handleSplitPointerDown}
                  onPointerMove={handleSplitPointerMove}
                  onPointerUp={handleSplitPointerUp}
                  onPointerCancel={() => setIsDraggingSplit(false)}
                  className="relative inline-block border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-h-[75vh] max-w-[85vw] select-none cursor-ew-resize group bg-slate-950 touch-none"
                >
                  {/* Badges for split comparison */}
                  <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none border border-white/10 shadow-lg">
                    {t.initial}
                  </div>
                  <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-mint-500/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none shadow-lg">
                    {t.result}
                  </div>

                  {/* Result image underneath */}
                  <img
                    src={currentPreview.data_url}
                    alt={t.result}
                    draggable={false}
                    className="max-h-[75vh] max-w-[85vw] object-contain block pointer-events-none select-none"
                  />

                  {/* Clipped Initial image on top */}
                  <div
                    className="absolute inset-0 pointer-events-none select-none overflow-hidden"
                    style={{
                      clipPath: `inset(0 ${100 - splitPos}% 0 0)`,
                    }}
                  >
                    <img
                      src={currentPreview.original_data_url || currentPreview.data_url}
                      alt={t.initial}
                      draggable={false}
                      className="w-full h-full object-contain block pointer-events-none select-none"
                    />
                  </div>

                  {/* Vertical divider line and handle */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-mint-400 pointer-events-none z-10 shadow-[0_0_12px_rgba(45,212,191,0.85)]"
                    style={{ left: `${splitPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-900/95 border-2 border-mint-400 text-mint-400 shadow-2xl flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="8 7 3 12 8 17" />
                        <polyline points="16 7 21 12 16 17" />
                      </svg>
                    </div>
                  </div>

                  {/* Optional accessibility slider at bottom */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitPos}
                    onChange={(e) => setSplitPos(Number(e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute inset-x-0 bottom-6 w-3/5 mx-auto opacity-75 hover:opacity-100 transition-opacity accent-mint-500 z-20 cursor-ew-resize"
                  />
                </div>
              )}

              {viewMode === 'sideBySide' && (
                <div className="flex items-center gap-8 max-h-[75vh] max-w-[90vw]">
                  <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t.initial} ({activeFile.width}×{activeFile.height})
                    </span>
                    <img
                      src={currentPreview.original_data_url || currentPreview.data_url}
                      alt={t.initial}
                      className="max-h-[68vh] max-w-[42vw] object-contain rounded-lg pointer-events-none"
                    />
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/80 border border-mint-500/30 shadow-xl shadow-mint-500/5">
                    <span className="text-[11px] font-bold text-mint-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> {t.result} ({currentPreview.new_width}×{currentPreview.new_height})
                    </span>
                    <img
                      src={currentPreview.data_url}
                      alt={t.result}
                      className="max-h-[68vh] max-w-[42vw] object-contain rounded-lg pointer-events-none"
                    />
                  </div>
                </div>
              )}

              {viewMode === 'single' && (
                <div className="p-2 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl flex items-center justify-center">
                  <img
                    src={currentPreview.data_url}
                    alt={t.result}
                    className="max-h-[76vh] max-w-[88vw] object-contain rounded-xl pointer-events-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-400 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-mint-500" />
              <span>{t.previewLoading}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md z-20 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
              <Sliders className="w-3.5 h-3.5 text-mint-400" />
              <span>{t.encodingQuality}</span>
            </div>

            <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setImageOptions({ quality: 50, lossless: false })}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  imageOptions.quality === 50 && !imageOptions.lossless
                    ? 'bg-mint-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="50% - Qualité légère"
              >
                {t.qualityLight} (50)
              </button>
              <button
                type="button"
                onClick={() => setImageOptions({ quality: 75, lossless: false })}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  imageOptions.quality === 75 && !imageOptions.lossless
                    ? 'bg-mint-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="75% - Qualité équilibrée"
              >
                {t.qualityBalanced} (75)
              </button>
              <button
                type="button"
                onClick={() => setImageOptions({ quality: 100, lossless: false })}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  imageOptions.quality === 100 && !imageOptions.lossless
                    ? 'bg-mint-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="100% - Qualité maximum"
              >
                {t.qualityMax} (100)
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] max-w-sm flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={imageOptions.quality}
              onChange={(e) => setImageOptions({ quality: Number(e.target.value), lossless: false })}
              className="w-full accent-mint-500 cursor-pointer"
            />
            <span className="font-mono font-bold text-mint-400 bg-mint-500/10 px-2.5 py-1 rounded-lg border border-mint-500/20 text-xs min-w-[54px] text-center shrink-0">
              {imageOptions.quality}%
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={imageOptions.lossless}
                onChange={(e) => setImageOptions({ lossless: e.target.checked })}
                className="rounded text-mint-500 accent-mint-500 cursor-pointer"
              />
              <span className="text-xs font-medium">{t.lossless}</span>
            </label>

            <div className="w-[1px] h-4 bg-slate-800" />

            {previewLoading ? (
              <div className="flex items-center gap-1.5 text-mint-400 text-xs font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px]">{t.previewLoading}</span>
              </div>
            ) : currentPreview ? (
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">{t.result}</span>
                <strong className="text-mint-400">{formatFileSize(currentPreview.estimated_bytes, language)}</strong>
                {currentPreview.saved_percentage > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    -{currentPreview.saved_percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="h-8 px-6 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span>{t.shortcuts} <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Esc</kbd> {t.shortcutEsc}</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">+</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">-</kbd> {t.shortcutZoom}</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">[</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">]</kbd> {t.compressionLevel}</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">0</kbd> {t.shortcutReset}</span>
          </div>
          <div>
            {t.privacyBadge}
          </div>
        </div>
      </div>
    </div>
  );
};
