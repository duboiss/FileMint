import React from 'react';
import { useFileMintStore, APP_VERSION } from '../store/useFileMintStore';
import { Sparkles, Settings, ArrowUpCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const { setSettingsOpen, updateInfo, t, watchFolders } = useFileMintStore();
  const isDev = Boolean(import.meta.env.DEV);
  const versionLabel = isDev ? `v${APP_VERSION} Local` : `v${APP_VERSION}`;
  const activeWatchFolders = watchFolders.filter((f) => f.enabled && f.watch_path);
  const activeCount = activeWatchFolders.length;

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800/80 px-6 flex items-center justify-between bg-white/70 dark:bg-slate-900/70 backdrop-blur-md select-none z-20">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-mint-600 to-mint-400 flex items-center justify-center shadow-lg shadow-mint-500/20 text-white font-bold">
          <Sparkles className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              FileMint
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-mint-500/10 text-mint-600 dark:text-mint-400 border border-mint-500/20">
              {versionLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeCount > 0 && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            title={`${activeCount > 1 ? `${activeCount} ${t.watchFoldersActivePlural}` : t.watchFolderStatusActive} :\n${activeWatchFolders.map((f) => `• ${f.name ? `${f.name} (${f.watch_path})` : f.watch_path}`).join('\n')}`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] hidden sm:inline">
              {activeCount > 1 ? `${t.watchFolderStatusActive} (${activeCount})` : t.watchFolderStatusActive}
            </span>
          </button>
        )}

        {updateInfo?.has_update && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-mint-500/15 text-mint-600 dark:text-mint-300 border border-mint-500/30 hover:bg-mint-500/25 transition-colors"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>{t.updateAvailable}</span>
          </button>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          title={t.settingsTooltip}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
