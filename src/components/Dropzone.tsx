import React, { useState } from 'react';
import { useFileMintStore, formatFileSize } from '../store/useFileMintStore';
import { open } from '@tauri-apps/plugin-dialog';
import { FileUp, Image as ImageIcon, FileText, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const Dropzone: React.FC = () => {
  const { addFiles, t, lifetimeSavedBytes, lifetimeFilesCount, language } = useFileMintStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handlePickFiles = async (types?: 'images' | 'pdf') => {
    try {
      const filters = types === 'images'
        ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'bmp', 'gif', 'tiff'] }]
        : types === 'pdf'
        ? [{ name: 'Documents PDF', extensions: ['pdf'] }]
        : [{ name: 'Fichiers supportés', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'bmp', 'gif', 'tiff', 'pdf'] }];

      const selected = await open({
        multiple: true,
        filters,
      });

      if (selected && Array.isArray(selected)) {
        await addFiles(selected);
      } else if (selected && typeof selected === 'string') {
        await addFiles([selected]);
      }
    } catch (err) {
      console.info('Mode aperçu Web : chargement des fichiers de démonstration', err);
      await addFiles([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 max-w-4xl mx-auto w-full overflow-y-auto">
      {lifetimeFilesCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 mb-4 transition-all select-none animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-mint-500 shrink-0" />
          <span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatFileSize(lifetimeSavedBytes, language)}
            </span>{' '}
            {lifetimeSavedBytes <= 1 ? t.lifetimePillSavedSingle : t.lifetimePill}{' '}
            <span className="text-slate-300 dark:text-slate-600 mx-0.5">•</span>{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {lifetimeFilesCount}
            </span>{' '}
            {lifetimeFilesCount <= 1 ? t.lifetimePillFilesSingle : t.lifetimePillFiles}
          </span>
        </div>
      )}

      {/* Main drop target */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragOver(false);
          // Handled via native Tauri drag-drop window listeners in App.tsx
        }}
        className={`w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 relative overflow-hidden ${
          isDragOver
            ? 'border-mint-500 bg-mint-500/10 scale-[1.01]'
            : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 hover:border-mint-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/60'
        }`}
      >
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-mint-500/20 to-emerald-500/10 flex items-center justify-center text-mint-500 mb-5 shadow-inner">
          <FileUp className="w-8 h-8 text-mint-500" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {t.dropTitle}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
          {t.dropSubtitle}
        </p>

        <button
          onClick={() => handlePickFiles()}
          className="px-6 py-3 rounded-xl bg-mint-500 hover:bg-mint-600 text-slate-950 font-semibold text-sm shadow-lg shadow-mint-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          {t.selectFiles}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mt-6">
        <button
          onClick={() => handlePickFiles('images')}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-left transition-all hover:border-slate-300 dark:hover:border-slate-700 flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-0.5">
              {t.imagesCardTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.imagesCardSubtitle}
            </p>
          </div>
        </button>

        <button
          onClick={() => handlePickFiles('pdf')}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-left transition-all hover:border-slate-300 dark:hover:border-slate-700 flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-0.5">
              {t.pdfCardTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.pdfCardSubtitle}
            </p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 mt-8 text-xs font-medium text-slate-500 dark:text-slate-500">
        <ShieldCheck className="w-4 h-4 text-mint-500" />
        <span>{t.privacyBadge}</span>
      </div>
    </div>
  );
};
