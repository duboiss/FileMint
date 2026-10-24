import React from 'react';
import { useFileMintStore, formatFileSize } from '../store/useFileMintStore';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, AlertCircle, FolderOpen, RotateCcw, ArrowDownRight, FileText, Image as ImageIcon } from 'lucide-react';

export const ResultsSummary: React.FC = () => {
  const { batchSummary, resetToHome, t, language } = useFileMintStore();

  if (!batchSummary) {
    return null;
  }

  const savedPercentage =
    batchSummary.total_original_bytes > 0
      ? Math.max(
          0,
          Math.round(
            (batchSummary.total_saved_bytes / batchSummary.total_original_bytes) * 100
          )
        )
      : 0;

  const hasSuccessfulFiles =
    batchSummary.success_count > 0 && batchSummary.items.some((item) => item.output_path);

  const handleOpenFolder = () => {
    if (!hasSuccessfulFiles) return;
    const firstSuccessful = batchSummary.items.find((item) => item.output_path);
    if (firstSuccessful?.output_path) {
      invoke('open_path_in_explorer', { path: firstSuccessful.output_path });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full overflow-y-auto select-none">
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center mb-6">
        <div className="h-16 w-16 rounded-2xl bg-mint-500/10 text-mint-500 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-mint-500" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">
          {batchSummary.cancelled ? t.batchCancelled : t.batchCompleted}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {batchSummary.success_count} {batchSummary.success_count > 1 ? t.fileCountPlural : t.fileCountSingle}{' '}
          {language === 'en' ? 'optimized locally' : 'optimisé(s) localement'}
          {batchSummary.failure_count > 0 && ` • ${batchSummary.failure_count} ${language === 'en' ? 'failed' : 'échec(s)'}`}
        </p>

        <div className="flex items-center gap-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 mb-8">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {t.spaceSaved}
            </span>
            <div className="text-2xl font-black text-mint-500 font-mono mt-0.5 flex items-center gap-1.5">
              <ArrowDownRight className="w-6 h-6" />
              <span>{formatFileSize(Math.max(0, batchSummary.total_saved_bytes), language)}</span>
              <span className="text-sm font-semibold text-emerald-500">(-{savedPercentage}%)</span>
            </div>
          </div>

          <div className="w-[1px] h-10 bg-slate-200 dark:bg-slate-700 mx-2" />

          <div className="text-left text-xs">
            <div className="text-slate-400">
              {t.initial}{' '}
              <span className="font-mono text-slate-700 dark:text-slate-200">
                {formatFileSize(batchSummary.total_original_bytes, language)}
              </span>
            </div>
            <div className="text-slate-400 mt-1">
              {t.result}{' '}
              <span className="font-mono font-bold text-mint-500">
                {formatFileSize(batchSummary.total_final_bytes, language)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenFolder}
            disabled={!hasSuccessfulFiles}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 ${
              hasSuccessfulFiles
                ? 'bg-mint-500 hover:bg-mint-600 text-slate-950 shadow-mint-500/20 hover:scale-[1.02] cursor-pointer'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 opacity-60 cursor-not-allowed shadow-none'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t.openDestination}</span>
          </button>

          <button
            onClick={resetToHome}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.newBatch}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
          {language === 'en' ? 'Processed files details' : 'Détail des fichiers traités'} ({batchSummary.items.length})
        </h4>
        <div className="space-y-1.5">
          {batchSummary.items.map((item, idx) => {
            const outputName = item.output_path ? item.output_path.split(/[/\\]/).pop() : null;
            const isRenamed = Boolean(outputName && outputName !== item.file_name);
            const displayName = outputName || item.file_name;

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 flex items-center justify-between text-xs gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {item.success ? (
                    <CheckCircle2 className="w-4 h-4 text-mint-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  {item.file_name.toLowerCase().endsWith('.pdf') ? (
                    <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                        title={item.output_path || item.file_name}
                      >
                        {displayName}
                      </span>
                      {isRenamed && (
                        <span
                          className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold px-1.5 py-0.2 rounded shrink-0"
                          title={t.renamedNotice}
                        >
                          {outputName && outputName.match(/\(\d+\)/)
                            ? outputName.match(/\(\d+\)/)?.[0]
                            : language === 'en'
                            ? 'renamed'
                            : 'renommé'}
                        </span>
                      )}
                    </div>
                    {isRenamed && (
                      <span className="text-[10px] text-slate-400 truncate mt-0.5">
                        {t.sourceFile || 'Source'} : {item.file_name}
                      </span>
                    )}
                  </div>
                  {item.error && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                      {item.error}
                    </span>
                  )}
                </div>

                {item.success && (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400 line-through">
                        {formatFileSize(item.original_size, language)}
                      </span>
                      <span className="font-bold text-mint-500">
                        {formatFileSize(item.final_size, language)}
                      </span>
                    </div>
                    {item.output_path && (
                      <button
                        onClick={() => invoke('open_path_in_explorer', { path: item.output_path })}
                        className="p-1 rounded-lg text-slate-400 hover:text-mint-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={language === 'en' ? 'Show in folder' : 'Afficher dans le dossier'}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
