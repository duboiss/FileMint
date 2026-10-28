import React, { useState, useEffect, useRef } from 'react';
import { PreviewResult, FileItem } from '../../types';
import { useFileMintStore, formatFileSize, hasActiveImageChanges } from '../../store/useFileMintStore';
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
  FileText,
  Search,
} from 'lucide-react';
import { LoupeLens } from './LoupeLens';

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
    pdfOptions,
    setPdfOptions,
    preview: storePreview,
    previewLoading,
  } = useFileMintStore();

  const currentPreview = storePreview || propPreview;

  const isImage = activeFile?.fileType !== 'pdf';
  const hasChanges = !isImage || hasActiveImageChanges(imageOptions);
  const isCompressionActive = isImage && imageOptions.compress !== false;
  const isTargetSizeMode = Boolean(imageOptions.target_size_kb && imageOptions.target_size_kb > 0);
  const isLossless = Boolean(imageOptions.lossless);
  const canAdjustQuality = isCompressionActive && !isTargetSizeMode && !isLossless;

  const getPdfProfileLabel = (profile: string) => {
    switch (profile) {
      case 'Readable':
        return t.profileReadable;
      case 'Balanced':
        return t.profileBalanced;
      case 'Compact':
        return t.profileCompact;
      default:
        return profile;
    }
  };

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'split' | 'sideBySide' | 'single'>('split');
  const effectiveViewMode = hasChanges ? viewMode : 'single';
  const [splitPos, setSplitPos] = useState<number>(50);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const qualityRef = useRef(imageOptions.quality);
  qualityRef.current = imageOptions.quality;

  // Loupe A/B 200% / 400%
  const [isLoupeActive, setIsLoupeActive] = useState<boolean>(false);
  const [loupeZoom, setLoupeZoom] = useState<2 | 4>(2);
  const [loupeState, setLoupeState] = useState<{
    clientX: number;
    clientY: number;
    normX: number;
    normY: number;
    imageRect: { width: number; height: number };
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Reset zoom, pan, and loupe when opening
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      setIsLoupeActive(false);
      setLoupeState(null);
    }
  }, [isOpen]);

  // Keyboard shortcuts: Escape to close, L toggle loupe, Space toggle 200%/400%, +/- zoom, [/] quality, 0/r reset pan
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'l' || e.key === 'L') {
        setIsLoupeActive((prev) => !prev);
      } else if (e.key === ' ' || e.code === 'Space') {
        if (isLoupeActive) {
          e.preventDefault();
          setLoupeZoom((z) => (z === 2 ? 4 : 2));
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((z) => Math.min(4, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-') {
        setZoomLevel((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === '[') {
        if (canAdjustQuality) {
          setImageOptions({ quality: Math.max(10, qualityRef.current - 5), lossless: false, compress: true });
        }
      } else if (e.key === ']') {
        if (canAdjustQuality) {
          setImageOptions({ quality: Math.min(100, qualityRef.current + 5), lossless: false, compress: true });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, setImageOptions, isLoupeActive]);

  if (!isOpen || !activeFile) return null;

  // Cursor-centered wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // If loupe is active, wheel toggles 200% / 400%
    if (isLoupeActive) {
      if (e.deltaY < 0) {
        setLoupeZoom(4);
      } else {
        setLoupeZoom(2);
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorRelX = e.clientX - (rect.left + rect.width / 2);
    const cursorRelY = e.clientY - (rect.top + rect.height / 2);

    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    const currentZ = zoomLevel;
    const nextZ = Math.max(0.25, Math.min(4, +(currentZ + delta).toFixed(2)));

    if (nextZ === currentZ) return;

    if (nextZ === 1) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      const ratio = nextZ / currentZ;
      const nextPanX = cursorRelX - (cursorRelX - panOffset.x) * ratio;
      const nextPanY = cursorRelY - (cursorRelY - panOffset.y) * ratio;
      setZoomLevel(nextZ);
      setPanOffset({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLoupeActive || zoomLevel <= 1) return;
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

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isLoupeActive) {
      if (loupeState) setLoupeState(null);
      return;
    }

    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setLoupeState({
      clientX: e.clientX,
      clientY: e.clientY,
      normX,
      normY,
      imageRect: {
        width: rect.width,
        height: rect.height,
      },
    });
  };

  const handleImagePointerLeave = () => {
    setLoupeState(null);
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
        <div className="h-14 min-h-[3.5rem] px-4 sm:px-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs backdrop-blur-sm z-20 gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="p-1.5 rounded-lg bg-mint-500/10 text-mint-400 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <span
                className="font-bold text-sm text-slate-100 truncate cursor-help leading-tight"
                title={activeFile.path}
              >
                {activeFile.name}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-400 mt-0.5 leading-none">
                <span className="shrink-0 font-mono text-slate-300">
                  {formatFileSize(activeFile.sizeBytes, language)}
                  {isImage && activeFile.width && activeFile.height ? (
                    <span className="hidden sm:inline text-slate-500 ml-1">({activeFile.width}×{activeFile.height})</span>
                  ) : !isImage ? (
                    <span className="text-mint-400 text-[10px] ml-1">({t.pdfPage1Preview})</span>
                  ) : null}
                </span>
                {Boolean(currentPreview?.estimated_bytes && currentPreview.estimated_bytes !== activeFile.sizeBytes) && (
                  <>
                    <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="shrink-0 text-mint-400 font-mono font-bold">
                      {formatFileSize(currentPreview!.estimated_bytes, language)}
                      {isImage && currentPreview?.new_width && currentPreview?.new_height ? (
                        <span className="hidden sm:inline text-mint-500/80 font-normal ml-1">({currentPreview.new_width}×{currentPreview.new_height})</span>
                      ) : null}
                    </span>
                    {currentPreview!.saved_percentage > 0 && (
                      <span className="shrink-0 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        -{currentPreview!.saved_percentage.toFixed(0)}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 shrink-0">
              <button
                disabled={!hasChanges}
                onClick={() => setViewMode('split')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all shrink-0 ${
                  !hasChanges
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : effectiveViewMode === 'split'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm cursor-pointer'
                    : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                }`}
                title={hasChanges ? t.viewSplit : t.noChangesToCompare}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.viewSplit}</span>
              </button>
              <button
                disabled={!hasChanges}
                onClick={() => setViewMode('sideBySide')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all shrink-0 ${
                  !hasChanges
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : effectiveViewMode === 'sideBySide'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm cursor-pointer'
                    : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                }`}
                title={hasChanges ? t.viewSideBySide : t.noChangesToCompare}
              >
                <Columns className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.viewSideBySide}</span>
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all shrink-0 ${
                  effectiveViewMode === 'single'
                    ? 'bg-mint-500 text-slate-950 font-semibold shadow-sm cursor-pointer'
                    : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                }`}
                title={t.viewSingle}
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.viewSingle}</span>
              </button>
            </div>

            <div className="w-[1px] h-5 bg-slate-800" />

            {/* Loupe A/B 200% / 400% Toggle */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setIsLoupeActive(!isLoupeActive)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isLoupeActive
                    ? 'bg-mint-500 text-slate-950 font-bold shadow-md shadow-mint-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title={t.loupeTooltip}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.loupeTitle}</span>
              </button>

              {isLoupeActive && (
                <div className="flex items-center gap-0.5 pl-1 pr-0.5 border-l border-slate-700">
                  <button
                    type="button"
                    onClick={() => setLoupeZoom(2)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      loupeZoom === 2
                        ? 'bg-mint-400 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    200%
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoupeZoom(4)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      loupeZoom === 4
                        ? 'bg-mint-400 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    400%
                  </button>
                </div>
              )}
            </div>

            <div className="w-[1px] h-5 bg-slate-800" />

            {/* Global Zoom with Presets */}
            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700/60 shrink-0">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
                title={`${t.zoomOut} (-)`}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                    zoomLevel === 1
                      ? 'bg-mint-500/20 text-mint-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  title={t.zoomFit}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(2);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                    zoomLevel === 2
                      ? 'bg-mint-500/20 text-mint-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  title="200%"
                >
                  200%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(4);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                    zoomLevel === 4
                      ? 'bg-mint-500/20 text-mint-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  title="400%"
                >
                  400%
                </button>
              </div>

              <button
                onClick={() => setZoomLevel((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
                title={`${t.zoomIn} (+)`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
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
          ref={containerRef}
          onWheel={handleWheel}
          className={`flex-1 relative overflow-hidden flex items-center justify-center px-4 sm:px-6 py-5 sm:py-6 bg-slate-950/60 ${
            isLoupeActive
              ? 'cursor-crosshair'
              : zoomLevel > 1
              ? (isDragging ? 'cursor-grabbing' : 'cursor-grab')
              : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            handleImagePointerLeave();
          }}
        >
          {zoomLevel > 1 && !isLoupeActive && (
            <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <Move className="w-3.5 h-3.5 text-mint-400" />
              <span>{t.dragToPan}</span>
            </div>
          )}

          {isLoupeActive && (
            <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-mint-500/40 text-[11px] text-slate-200 flex items-center gap-2 backdrop-blur-sm pointer-events-none shadow-lg">
              <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse" />
              <span className="font-semibold text-mint-400">{t.loupeTitle} {loupeZoom * 100}%</span>
              <span className="text-slate-400">• {t.loupeShortcutHint}</span>
            </div>
          )}

          {currentPreview?.data_url ? (
            <div
              className="transition-transform duration-75 ease-out max-h-full max-w-full flex items-center justify-center my-auto"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            >
              {effectiveViewMode === 'split' && (
                <div
                  onPointerDown={handleSplitPointerDown}
                  onPointerMove={(e) => {
                    handleSplitPointerMove(e);
                    handleImagePointerMove(e);
                  }}
                  onPointerUp={handleSplitPointerUp}
                  onPointerCancel={() => setIsDraggingSplit(false)}
                  onPointerLeave={handleImagePointerLeave}
                  className="relative inline-block border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-h-[66vh] max-w-[85vw] select-none cursor-ew-resize group bg-slate-950 touch-none my-auto"
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
                    className="max-h-[66vh] max-w-[85vw] object-contain block pointer-events-none select-none"
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
                </div>
              )}

              {effectiveViewMode === 'sideBySide' && (
                <div className="flex items-center gap-6 max-h-[66vh] max-w-[90vw] my-auto">
                  {/* Initial Card */}
                  <div
                    onPointerMove={handleImagePointerMove}
                    onPointerLeave={handleImagePointerLeave}
                    className="relative inline-block border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-slate-950 max-h-[66vh] max-w-[43vw] select-none"
                  >
                    <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none border border-white/10 shadow-lg">
                      <span>{t.initial}</span>
                      {activeFile.width && activeFile.height && (
                        <span className="font-mono font-normal ml-1">({activeFile.width}×{activeFile.height})</span>
                      )}
                    </div>
                    <img
                      src={currentPreview.original_data_url || currentPreview.data_url}
                      alt={t.initial}
                      draggable={false}
                      className="max-h-[66vh] max-w-[43vw] object-contain block pointer-events-none select-none"
                    />
                  </div>

                  {/* Result Card */}
                  <div
                    onPointerMove={handleImagePointerMove}
                    onPointerLeave={handleImagePointerLeave}
                    className="relative inline-block border border-mint-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-mint-500/5 bg-slate-950 max-h-[66vh] max-w-[43vw] select-none"
                  >
                    <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-mint-500/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none shadow-lg flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t.result}</span>
                      {currentPreview.new_width && currentPreview.new_height && (
                        <span className="font-mono font-normal">({currentPreview.new_width}×{currentPreview.new_height})</span>
                      )}
                    </div>
                    <img
                      src={currentPreview.data_url}
                      alt={t.result}
                      draggable={false}
                      className="max-h-[66vh] max-w-[43vw] object-contain block pointer-events-none select-none"
                    />
                  </div>
                </div>
              )}

              {effectiveViewMode === 'single' && (
                <div
                  onPointerMove={handleImagePointerMove}
                  onPointerLeave={handleImagePointerLeave}
                  className="relative inline-block border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-h-[66vh] max-w-[85vw] bg-slate-950 select-none my-auto"
                >
                  <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-mint-500/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none shadow-lg flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.result}</span>
                    {currentPreview.new_width && currentPreview.new_height && (
                      <span className="font-mono font-normal">({currentPreview.new_width}×{currentPreview.new_height})</span>
                    )}
                  </div>
                  <img
                    src={currentPreview.data_url}
                    alt={t.result}
                    draggable={false}
                    className="max-h-[66vh] max-w-[85vw] object-contain block pointer-events-none select-none"
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

          {/* Floating Synchronized A/B Loupe */}
          {isLoupeActive && loupeState && currentPreview && (
            <LoupeLens
              clientX={loupeState.clientX}
              clientY={loupeState.clientY}
              normX={loupeState.normX}
              normY={loupeState.normY}
              imageRect={loupeState.imageRect}
              originalSrc={currentPreview.original_data_url || currentPreview.data_url}
              resultSrc={currentPreview.data_url}
              hasChanges={hasChanges}
              zoom={loupeZoom}
            />
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md z-20 flex flex-wrap items-center justify-between gap-4 text-xs">
          {!isImage ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
                <FileText className="w-3.5 h-3.5 text-mint-400" />
                <span>{t.pdfProfileSelected}</span>
              </div>
              <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60 shrink-0">
                {(['Readable', 'Balanced', 'Compact'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPdfOptions({ profile: p, target_size_kb: null })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      pdfOptions.profile === p && !pdfOptions.target_size_kb
                        ? 'bg-mint-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                  >
                    {getPdfProfileLabel(p)}
                  </button>
                ))}
              </div>
              <span className="hidden md:inline text-[11px] text-slate-400">
                {t.pdfExplanation}
              </span>
            </div>
          ) : !isCompressionActive ? (
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                {t.noCompression}
              </span>
              <button
                type="button"
                onClick={() => setImageOptions({ compress: true })}
                className="px-3 py-1 rounded-xl bg-mint-500 hover:bg-mint-400 text-slate-950 font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
              >
                {t.enableCompression}
              </button>
            </div>
          ) : isTargetSizeMode ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-mint-500/10 text-mint-400 border border-mint-500/20 font-bold">
                {t.compressionModeTargetSize} : ≤ {imageOptions.target_size_kb} Ko
              </span>
            </div>
          ) : isLossless ? (
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-xl bg-mint-500/10 text-mint-400 border border-mint-500/20 font-bold">
                {t.lossless}
              </span>
              <button
                type="button"
                onClick={() => setImageOptions({ lossless: false })}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                {t.compressionModeQuality}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
                  <Sliders className="w-3.5 h-3.5 text-mint-400" />
                  <span>{t.encodingQuality}</span>
                </div>

                <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setImageOptions({ quality: 50, lossless: false, compress: true })}
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
                    onClick={() => setImageOptions({ quality: 75, lossless: false, compress: true })}
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
                    onClick={() => setImageOptions({ quality: 100, lossless: false, compress: true })}
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
                  onChange={(e) =>
                    setImageOptions({ quality: Number(e.target.value), lossless: false, compress: true })
                  }
                  className="w-full accent-mint-500 cursor-pointer"
                />
                <span className="font-mono font-bold text-mint-400 bg-mint-500/10 px-2.5 py-1 rounded-lg border border-mint-500/20 text-xs min-w-[54px] text-center shrink-0">
                  {imageOptions.quality}%
                </span>
              </div>
            </>
          )}

          <div className="flex items-center gap-4 shrink-0">
            {canAdjustQuality && (
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={imageOptions.lossless}
                  onChange={(e) => setImageOptions({ lossless: e.target.checked })}
                  className="rounded text-mint-500 accent-mint-500 cursor-pointer"
                />
                <span className="text-xs font-medium">{t.lossless}</span>
              </label>
            )}

            <div className="w-[1px] h-4 bg-slate-800" />

            {previewLoading ? (
              <div className="flex items-center gap-1.5 text-mint-400 text-xs font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px]">{t.previewLoading}</span>
              </div>
            ) : currentPreview ? (
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">{t.result}</span>
                <strong className="text-mint-400">
                  {formatFileSize(currentPreview.estimated_bytes, language)}
                </strong>
                {currentPreview.saved_percentage > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    -{currentPreview.saved_percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-[2rem] px-4 sm:px-6 py-1 border-t border-slate-800/80 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400 gap-3 select-none overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 py-0.5">
            <span className="font-semibold text-slate-400 shrink-0 hidden md:inline">
              {t.shortcuts}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                Esc
              </kbd>
              <span>{t.shortcutEsc}</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                +
              </kbd>
              <span className="text-slate-500">/</span>
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                -
              </kbd>
              <span>{t.shortcutZoom}</span>
            </span>
            {canAdjustQuality && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                  [
                </kbd>
                <span className="text-slate-500">/</span>
                <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                  ]
                </kbd>
                <span className="hidden sm:inline">{t.compressionLevel}</span>
                <span className="sm:hidden">{t.tagQuality}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                0
              </kbd>
              <span>{t.shortcutReset}</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                L
              </kbd>
              <span>{t.loupeTitle}</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                {language === 'en' ? 'Space' : 'Espace'}
              </kbd>
              <span>200%/400%</span>
            </span>
          </div>

          <div className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1.5 pl-3 border-l border-slate-800/80 text-[10px] sm:text-[11px]">
            <span className="hidden xl:inline">{t.privacyBadge}</span>
            <span className="xl:hidden flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{t.privacyBadgeShort}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
