import React from 'react';
import { useFileMintStore } from '../store/useFileMintStore';
import { open } from '@tauri-apps/plugin-dialog';
import { X, Plus, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

export const FileList: React.FC = () => {
  const { files, activePreviewIndex, setActivePreviewIndex, removeFile, clearFiles, addFiles, t, language } =
    useFileMintStore();

  const formatSize = (bytes: number) => {
    const units = language === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['o', 'Ko', 'Mo', 'Go'];
    if (bytes < 1024) return `${bytes} ${units[0]}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units[1]}`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} ${units[2]}`;
  };

  const handleAddMore = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Fichiers', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'bmp', 'gif', 'tiff', 'pdf'] }],
      });
      if (selected && Array.isArray(selected)) {
        await addFiles(selected);
      } else if (selected && typeof selected === 'string') {
        await addFiles([selected]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 px-6 py-2.5 flex items-center justify-between gap-4 select-none">
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
        <button
          onClick={handleAddMore}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-mint-500 text-slate-600 dark:text-slate-300 hover:text-mint-500 dark:hover:text-mint-400 text-xs font-semibold shrink-0 transition-colors cursor-pointer"
          title={t.addMore}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addMore}</span>
        </button>

        {files.map((file, index) => {
          const isActive = index === activePreviewIndex;
          const isPdf = file.fileType === 'pdf';

          return (
            <div
              key={file.path}
              onClick={() => setActivePreviewIndex(index)}
              title={file.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer shrink-0 transition-all ${
                isActive
                  ? 'border-mint-500 bg-mint-500/15 text-slate-900 dark:text-white font-medium shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isPdf ? (
                <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
              <span className="max-w-[130px] truncate" title={file.path}>
                {file.name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {formatSize(file.sizeBytes)}
              </span>
              {file.hasGps && (
                <span
                  className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium cursor-help"
                  title={t.gpsDetectedBadge}
                >
                  📍
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors ml-1 cursor-pointer"
                title={t.removeFileTooltip}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-slate-500">
          {files.length} {files.length > 1 ? t.fileCountPlural : t.fileCountSingle}
        </span>
        <button
          onClick={clearFiles}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title={t.clearAll}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
