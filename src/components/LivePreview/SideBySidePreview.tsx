import React, { useState } from 'react';
import { useFileMintStore, formatFileSize, hasActiveImageChanges } from '../../store/useFileMintStore';
import {
  Loader2,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Shield,
  Columns,
  SplitSquareVertical,
} from 'lucide-react';
import { LargePreviewModal } from './LargePreviewModal';
import { PdfPageGrid } from './PdfPageGrid';

export const SideBySidePreview: React.FC = () => {
  const {
    files,
    activePreviewIndex,
    preview,
    previewLoading,
    imageOptions,
    pdfOptions,
    pdfToolMode,
    t,
    language,
  } = useFileMintStore();
  const activeFile = files[activePreviewIndex];

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'sideBySide' | 'split'>('sideBySide');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isLargeModalOpen, setIsLargeModalOpen] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const updateSplitPosition = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(Math.round(percent));
  };

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingSplit(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSplitPosition(e.clientX, e.currentTarget);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplit) {
      updateSplitPosition(e.clientX, e.currentTarget);
    }
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

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

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
        {t.noFileSelected}
      </div>
    );
  }

  const isPdf = activeFile.fileType === 'pdf';

  if (isPdf && pdfToolMode === 'split') {
    return <PdfPageGrid />;
  }

  const hasChanges = isPdf || hasActiveImageChanges(imageOptions, activeFile);
  const hasSizeChange = Boolean(
    preview &&
    preview.estimated_bytes &&
    preview.estimated_bytes !== activeFile.sizeBytes
  );

  // Fast preliminary estimate for PDFs: ONLY used if target_size_kb is explicitly requested.
  // We NEVER invent an arbitrary hardcoded percentage (e.g. -45%) while loading because CAD/vector
  // PDFs only compress by ~14% whereas photo albums compress by 60%.
  const pdfEstimate = React.useMemo(() => {
    if (!isPdf || pdfToolMode !== 'compress') return null;
    if (pdfOptions.target_size_kb && pdfOptions.target_size_kb > 0) {
      const targetBytes = pdfOptions.target_size_kb * 1024;
      const est = Math.min(activeFile.sizeBytes, targetBytes);
      const pct = activeFile.sizeBytes > 0
        ? Math.max(0, Math.round(((activeFile.sizeBytes - est) / activeFile.sizeBytes) * 100))
        : 0;
      return { bytes: est, percent: pct };
    }
    return null;
  }, [isPdf, pdfToolMode, pdfOptions, activeFile.sizeBytes]);

  const estimatedBytes = preview?.estimated_bytes ?? pdfEstimate?.bytes;
  const savedPercentage = preview?.saved_percentage !== undefined && preview?.estimated_bytes !== undefined
    ? preview.saved_percentage
    : pdfEstimate?.percent;

  const showEstimatedSize = Boolean(
    estimatedBytes !== undefined &&
    (isPdf
      ? pdfToolMode === 'compress'
      : (hasSizeChange || Boolean(imageOptions.target_size_kb && imageOptions.compress !== false)))
  );

  // Dynamic preview rendering (Images and PDF Page 1)
  return (
    <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-950/40 overflow-hidden relative select-none">
      {/* Streamlined, responsive toolbar */}
      <div className="h-12 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 flex items-center justify-between gap-3 text-xs backdrop-blur-sm z-10 shrink-0">
        {/* Left: Metadata comparison */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px] sm:max-w-[180px] md:max-w-[240px] cursor-help text-xs leading-tight"
                title={activeFile.path}
              >
                {activeFile.name}
              </span>
              {isPdf && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-mint-500/15 text-mint-600 dark:text-mint-400 font-semibold text-[9px] shrink-0 whitespace-nowrap">
                  <span>📄</span>
                  <span>{t.pdfPage1Preview}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
              <span className="shrink-0 text-slate-600 dark:text-slate-400">
                {formatFileSize(activeFile.sizeBytes, language)}
              </span>
              {showEstimatedSize && estimatedBytes !== undefined ? (
                <>
                  <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span
                    className="shrink-0 font-bold text-mint-600 dark:text-mint-400 cursor-help"
                    title={t.estimatedSizeTooltip}
                  >
                    ~{formatFileSize(estimatedBytes, language)}
                  </span>
                  {savedPercentage !== undefined && savedPercentage > 0 && (
                    <span
                      className="shrink-0 px-1 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] cursor-help"
                      title={t.estimatedSizeTooltip}
                    >
                      -{savedPercentage.toFixed(0)}%
                    </span>
                  )}
                  {savedPercentage !== undefined && savedPercentage === 0 && (
                    <span
                      className="shrink-0 px-1 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium text-[9px] cursor-help"
                      title={t.estimatedSizeTooltip}
                    >
                      0%
                    </span>
                  )}
                  {previewLoading && (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-mint-500 shrink-0" />
                  )}
                </>
              ) : previewLoading ? (
                <>
                  <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span className="shrink-0 text-slate-400 italic text-[9px] flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-mint-500 shrink-0" />
                    <span>{t.previewLoading}</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {isPdf ? (
            <span
              className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10px] shrink-0"
            >
              <span>{getPdfProfileLabel(pdfOptions.profile)}</span>
            </span>
          ) : (
            <>
              {imageOptions.target_size_kb && imageOptions.compress !== false && (
                <span
                  className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold text-[10px] shrink-0"
                  title={`${t.targetSizeTitle} : ≤ ${imageOptions.target_size_kb} Ko`}
                >
                  <span>🎯 ≤</span>
                  <span>
                    {imageOptions.target_size_kb >= 1024
                      ? `${(imageOptions.target_size_kb / 1024).toFixed(
                          imageOptions.target_size_kb % 1024 === 0 ? 0 : 1
                        )} ${language === 'en' ? 'MB' : 'Mo'}`
                      : `${imageOptions.target_size_kb} ${language === 'en' ? 'KB' : 'Ko'}`}
                  </span>
                </span>
              )}

              {activeFile.hasGps && (
                <span
                  className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold cursor-help shrink-0"
                  title={t.gpsDetectedNotice}
                >
                  📍 GPS
                </span>
              )}

              {activeFile.hasGps && imageOptions.metadata_policy !== 'KeepAll' && (
                <span
                  className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-mint-500/15 text-mint-600 dark:text-mint-400 text-[10px] font-semibold shrink-0"
                  title={t.metadataRemoveGpsDesc}
                >
                  <Shield className="w-3 h-3 text-mint-500" />
                  <span>{t.gpsCleanBadge}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: View controls & zoom */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg p-0.5 bg-slate-200/60 dark:bg-slate-800/80 border border-slate-300/40 dark:border-slate-700/50">
            <button
              type="button"
              disabled={!hasChanges}
              onClick={() => setViewMode('sideBySide')}
              className={`p-1 rounded-md text-[11px] font-medium transition-all ${
                !hasChanges
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : viewMode === 'sideBySide'
                  ? 'bg-white dark:bg-slate-900 text-mint-500 shadow-sm font-semibold cursor-pointer'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer'
              }`}
              title={hasChanges ? t.viewSideBySide : t.noChangesToCompare}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!hasChanges}
              onClick={() => setViewMode('split')}
              className={`p-1 rounded-md text-[11px] font-medium transition-all ${
                !hasChanges
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : viewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-mint-500 shadow-sm font-semibold cursor-pointer'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer'
              }`}
              title={hasChanges ? t.viewSplit : t.noChangesToCompare}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            title={t.zoomOut}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono text-mint-600 dark:text-mint-400 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold min-w-[42px] text-center cursor-pointer transition-colors"
            title={t.resetZoom}
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            title={t.zoomIn}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            title={t.resetZoom}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Enlarge */}
          <button
            onClick={() => setIsLargeModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-800/80 hover:bg-mint-500 hover:text-slate-950 dark:hover:bg-mint-500 dark:hover:text-slate-950 transition-all border border-slate-300/60 dark:border-slate-700/60 shadow-sm cursor-pointer"
            title={t.enlarge}
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">{t.enlarge}</span>
          </button>
        </div>
      </div>

      {/* Main image preview stage */}
      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-auto relative w-full h-full">
        {previewLoading && (
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-mint-500" />
              <span>{t.previewLoading}</span>
            </div>
          </div>
        )}

        {preview?.data_url ? (
          !hasChanges || viewMode === 'sideBySide' ? (
            <div className="flex items-center justify-center max-h-full max-w-full min-h-0 min-w-0 my-auto py-2">
              <div
                onClick={() => setIsLargeModalOpen(true)}
                className="group relative inline-block border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl select-none cursor-zoom-in hover:border-mint-500/60 transition-all max-h-full max-w-full touch-none"
                style={{
                  transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
                  transformOrigin: 'center',
                  transition: 'transform 0.15s ease-out',
                }}
                title={t.clickToEnlarge}
              >
                <img
                  src={preview.data_url}
                  alt={t.result}
                  draggable={false}
                  className="max-h-full max-w-full w-auto h-auto object-contain block rounded-3xl pointer-events-none select-none"
                  style={{
                    maxHeight: 'min(560px, calc(100vh - 380px))',
                    maxWidth: 'min(1100px, calc(100vw - 440px))',
                  }}
                />
              </div>
            </div>
          ) : (
            /* Split slider comparison mode */
            <div
              className="relative max-h-full max-w-full flex items-center justify-center min-h-0 min-w-0 my-auto py-2"
              style={{
                transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
                transformOrigin: 'center',
                transition: 'transform 0.15s ease-out',
              }}
            >
              <div
                onPointerDown={handleSplitPointerDown}
                onPointerMove={handleSplitPointerMove}
                onPointerUp={handleSplitPointerUp}
                onPointerCancel={() => setIsDraggingSplit(false)}
                className="relative inline-block border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl select-none cursor-ew-resize group max-h-full max-w-full touch-none"
              >
                {/* Badges for split comparison */}
                <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none border border-white/10 shadow-lg flex items-center gap-1">
                  <span>{t.initial}</span>
                  {isPdf && <span className="text-slate-400 text-[9px]">({t.pdfPage1Preview})</span>}
                </div>
                <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-mint-500/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none select-none shadow-lg flex items-center gap-1">
                  <span>{t.result}</span>
                  {isPdf && <span className="text-slate-800 text-[9px]">({t.pdfPage1Preview})</span>}
                </div>

                {/* Base Result Image */}
                <img
                  src={preview.data_url}
                  alt={t.result}
                  draggable={false}
                  className="max-h-full max-w-full w-auto h-auto object-contain block rounded-3xl pointer-events-none select-none"
                  style={{
                    maxHeight: 'min(560px, calc(100vh - 380px))',
                    maxWidth: 'min(1100px, calc(100vw - 440px))',
                  }}
                />

                {/* Clipped Initial Image on top */}
                <div
                  className="absolute inset-0 pointer-events-none select-none overflow-hidden rounded-3xl"
                  style={{
                    clipPath: `inset(0 ${100 - splitPos}% 0 0)`,
                  }}
                >
                  <img
                    src={preview.original_data_url || preview.data_url}
                    alt={t.initial}
                    draggable={false}
                    className="w-full h-full object-contain block pointer-events-none select-none"
                    style={{
                      maxHeight: 'min(560px, calc(100vh - 380px))',
                      maxWidth: 'min(1100px, calc(100vw - 440px))',
                    }}
                  />
                </div>

                {/* Vertical Divider Line with Central Handle */}
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
            </div>
          )
        ) : (
          <div className="text-center text-slate-400 text-xs">
            {previewLoading ? t.previewLoading : t.previewUnavailable}
          </div>
        )}
      </div>

      <LargePreviewModal
        isOpen={isLargeModalOpen}
        onClose={() => setIsLargeModalOpen(false)}
        preview={preview}
        activeFile={activeFile}
      />
    </div>
  );
};
