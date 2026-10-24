import React from 'react';
import { useFileMintStore, formatFileSize } from '../store/useFileMintStore';
import { Loader2, StopCircle, HardDrive } from 'lucide-react';

export const BatchProgress: React.FC = () => {
  const { batchProgress, cancelBatch, files, t, language } = useFileMintStore();

  const total = batchProgress?.total_items || files.length || 1;
  const current = batchProgress?.current_index || 0;
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto w-full select-none">
      <div className="w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-mint-500/10 text-mint-500 flex items-center justify-center mb-6">
          <Loader2 className="w-8 h-8 animate-spin text-mint-500" />
        </div>

        <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-1">
          {t.processingTitle}
        </h3>

        <p className="text-xs text-slate-400 font-mono mb-6 max-w-sm truncate">
          {batchProgress?.current_file || (language === 'en' ? 'Initializing...' : 'Initialisation...')}
        </p>

        <div className="w-full space-y-2 mb-6">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-500">{language === 'en' ? 'Progress' : 'Progression'}</span>
            <span className="font-mono text-mint-500">
              {current} / {total} ({percentage}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-mint-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {batchProgress && batchProgress.saved_bytes > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mint-500/10 text-mint-600 dark:text-mint-400 text-xs font-bold mb-6">
            <HardDrive className="w-4 h-4" />
            <span>
              {language === 'en'
                ? `Already ${formatFileSize(batchProgress.saved_bytes, language)} saved!`
                : `Déjà ${formatFileSize(batchProgress.saved_bytes, language)} économisés !`}
            </span>
          </div>
        )}

        <button
          onClick={cancelBatch}
          className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-500 text-slate-600 dark:text-slate-300 hover:text-red-500 text-xs font-semibold transition-colors flex items-center gap-2"
        >
          <StopCircle className="w-4 h-4" />
          <span>{t.cancelBatch}</span>
        </button>
      </div>
    </div>
  );
};
