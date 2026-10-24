import React, { useState } from 'react';
import { useFileMintStore } from '../../store/useFileMintStore';
import {
  Loader2,
  ArrowRight,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  Palette,
  FileText,
  Maximize2,
  Shield,
} from 'lucide-react';
import { LargePreviewModal } from './LargePreviewModal';

export const SideBySidePreview: React.FC = () => {
  const {
    files,
    activePreviewIndex,
    preview,
    previewLoading,
    imageOptions,
    rotateClockwise,
    toggleFlipHorizontal,
    toggleGrayscale,
    pdfOptions,
    t,
    language,
  } = useFileMintStore();
  const activeFile = files[activePreviewIndex];

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'sideBySide' | 'split'>('sideBySide');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isLargeModalOpen, setIsLargeModalOpen] = useState(false);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
        {t.noFileSelected}
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    const units = language === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['o', 'Ko', 'Mo', 'Go'];
    if (bytes < 1024) return `${bytes} ${units[0]}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units[1]}`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} ${units[2]}`;
  };

  // Specific rendering for PDF documents
  if (activeFile.fileType === 'pdf') {
    const estimatedPercent = pdfOptions.profile === 'Compact' ? 65 : pdfOptions.profile === 'Balanced' ? 45 : 25;
    const estimatedFinal = Math.round(activeFile.sizeBytes * (1 - estimatedPercent / 100));

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 bg-slate-100/50 dark:bg-slate-950/40 select-none">
        <div className="max-w-lg md:max-w-xl w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>

          <h3
            className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1 max-w-full truncate cursor-help"
            title={activeFile.path}
          >
            {activeFile.name}
          </h3>
          <p className="text-xs text-slate-400 mb-6 font-mono text-[11px] truncate max-w-full px-2" title={activeFile.path}>
            {activeFile.path}
          </p>

          <div className="w-full grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center mb-6">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">{t.initialWeight}</div>
              <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                {formatSize(activeFile.sizeBytes)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">{t.estimatedWeight}</div>
              <div className="text-xs font-mono font-bold text-mint-500 mt-0.5">
                ~{formatSize(estimatedFinal)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">{t.savings}</div>
              <div className="text-xs font-mono font-bold text-emerald-500 mt-0.5">
                -{estimatedPercent}%
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.pdfProfileSelected} : <span className="font-semibold text-slate-800 dark:text-slate-200">{pdfOptions.profile}</span>. {t.pdfExplanation}
          </p>
        </div>
      </div>
    );
  }

  // Dynamic image preview rendering
  return (
    <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-950/40 overflow-hidden relative select-none">
      <div className="h-11 px-5 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between text-xs backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px] cursor-help" title={activeFile.path}>
            {activeFile.name}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-medium text-slate-500">
            {t.initial}{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-mono">
              {formatSize(activeFile.sizeBytes)}
            </strong>{' '}
            ({activeFile.width}×{activeFile.height})
          </span>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

          {preview ? (
            <span className="font-medium text-slate-500">
              {t.result}{' '}
              <strong className="text-mint-600 dark:text-mint-400 font-mono">
                {formatSize(preview.estimated_bytes)}
              </strong>{' '}
              ({preview.new_width}×{preview.new_height})
            </span>
          ) : (
            <span className="text-slate-400">{t.calculating}</span>
          )}

          {preview && preview.saved_percentage > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              -{preview.saved_percentage.toFixed(0)}%
            </span>
          )}

          {activeFile.hasGps && (
            <span
              className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1 cursor-help"
              title={t.gpsDetectedNotice}
            >
              <span>📍</span>
              <span>{t.gpsDetectedBadge}</span>
            </span>
          )}

          {activeFile.hasGps && imageOptions.metadata_policy !== 'KeepAll' && (
            <span
              className="px-2 py-0.5 rounded-full bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold text-[10px] flex items-center gap-1 cursor-default"
              title={t.metadataRemoveGpsDesc}
            >
              <Shield className="w-3 h-3 text-mint-500" />
              <span>{t.gpsCleanBadge}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
            title={t.zoomOut}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 w-10 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
            title={t.zoomIn}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
            title={t.resetZoom}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={() => setViewMode(viewMode === 'sideBySide' ? 'split' : 'sideBySide')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === 'split'
                ? 'bg-mint-500/15 text-mint-500 border border-mint-500/30'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {viewMode === 'sideBySide' ? t.viewSideBySide : t.viewSplit}
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={rotateClockwise}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-mint-500 transition-colors"
            title={`${t.rotateCwQuick} (+90°)`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFlipHorizontal}
            className={`p-1 rounded-md transition-colors ${
              imageOptions.flip_horizontal
                ? 'bg-mint-500/15 text-mint-500 font-bold'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500'
            }`}
            title={t.flipHorizontal}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleGrayscale}
            className={`p-1 rounded-md transition-colors ${
              imageOptions.grayscale
                ? 'bg-mint-500/15 text-mint-500 font-bold'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500'
            }`}
            title={t.grayscale}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={() => setIsLargeModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-800/80 hover:bg-mint-500 hover:text-slate-950 dark:hover:bg-mint-500 dark:hover:text-slate-950 transition-all border border-slate-300 dark:border-slate-700 hover:border-mint-500 shadow-sm"
            title={t.enlarge}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{t.enlarge}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-3 md:p-5 overflow-auto relative w-full h-full">
        {previewLoading && (
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-mint-500" />
              <span>{t.previewLoading}</span>
            </div>
          </div>
        )}

        {preview?.data_url ? (
          viewMode === 'sideBySide' ? (
            <div className="flex items-center justify-center max-h-full max-w-full min-h-0 min-w-0">
              <div
                onClick={() => setIsLargeModalOpen(true)}
                className="group relative flex flex-col items-center border border-slate-200 dark:border-slate-800 rounded-3xl p-3 bg-white/70 dark:bg-slate-900/60 shadow-2xl cursor-zoom-in hover:border-mint-500/60 transition-all max-h-full max-w-full min-h-0 min-w-0"
                style={{
                  transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
                  transformOrigin: 'center',
                  transition: 'transform 0.15s ease-out',
                }}
                title={t.clickToEnlarge}
              >
                <div className="text-[10px] uppercase font-bold text-mint-500 tracking-wider mb-2 flex items-center justify-between w-full px-1.5 shrink-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Eye className="w-3.5 h-3.5 text-mint-500" /> {t.result}
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-mint-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3 h-3" /> {t.enlarge}
                  </span>
                </div>
                <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-auto">
                  <img
                    src={preview.data_url}
                    alt={t.result}
                    className="max-h-full max-w-full w-auto h-auto object-contain rounded-2xl shadow-sm block"
                    style={{
                      maxHeight: 'min(620px, calc(100vh - 290px))',
                      maxWidth: 'min(1100px, calc(100vw - 450px))',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Split slider comparison mode */
            <div
              className="relative border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center max-h-full max-w-full min-h-0 min-w-0"
              style={{
                transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
                transformOrigin: 'center',
                transition: 'transform 0.15s ease-out',
              }}
            >
              <img
                src={preview.data_url}
                alt={t.result}
                className="max-h-full max-w-full w-auto h-auto object-contain block rounded-3xl"
                style={{
                  maxHeight: 'min(620px, calc(100vh - 290px))',
                  maxWidth: 'min(1100px, calc(100vw - 450px))',
                }}
              />
              <div
                className="absolute top-0 bottom-0 left-0 overflow-hidden border-r-2 border-mint-500 bg-white dark:bg-slate-900"
                style={{ width: `${splitPos}%` }}
              >
                <img
                  src={preview.data_url}
                  alt={t.initial}
                  className="max-h-full max-w-full w-auto h-auto object-contain block opacity-90 contrast-125"
                  style={{
                    maxHeight: 'min(620px, calc(100vh - 290px))',
                    maxWidth: 'min(1100px, calc(100vw - 450px))',
                  }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPos}
                onChange={(e) => setSplitPos(Number(e.target.value))}
                className="absolute inset-x-0 bottom-3 w-4/5 mx-auto opacity-70 hover:opacity-100 transition-opacity accent-mint-500 z-10"
              />
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
