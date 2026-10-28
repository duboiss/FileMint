import React, { useMemo } from 'react';
import { useFileMintStore, APP_VERSION } from '../store/useFileMintStore';
import { Sparkles, Settings, RotateCcw, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    setSettingsOpen,
    updateInfo,
    updateDownloaded,
    updateInstalling,
    updateError,
    downloadUpdate,
    installAndRestart,
    t,
    watchFolders,
  } = useFileMintStore();
  const isDev = Boolean(import.meta.env.DEV);
  const versionLabel = isDev ? `v${APP_VERSION} Local` : `v${APP_VERSION}`;
  const activeWatchFolders = useMemo(
    () => watchFolders.filter((f) => f.enabled && f.watch_path),
    [watchFolders]
  );
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
            title={`${activeCount > 1 ? `${activeCount} ${t.watchFoldersActivePlural}` : t.watchFolderStatusActive} (${activeWatchFolders.map((f) => f.name || f.watch_path).join(', ')})`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] hidden sm:inline">
              {activeCount > 1 ? `${t.watchFolderStatusActive} (${activeCount})` : t.watchFolderStatusActive}
            </span>
          </button>
        )}

        {/* Update System in Header: silently downloads in background, only displays button once ready to restart */}
        {updateInfo?.has_update && (
          <>
            {updateDownloaded ? (
              <button
                type="button"
                disabled={updateInstalling}
                onClick={() => installAndRestart()}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all animate-fadeIn ${
                  updateInstalling
                    ? 'bg-mint-500/60 text-slate-900 cursor-wait'
                    : 'bg-mint-500 hover:bg-mint-600 text-slate-950 shadow-mint-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
                title={`${t.updateRestartToApply} (v${updateInfo.latest_version})`}
              >
                {updateInstalling ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {updateInstalling ? t.updateInstalling : t.updateRestartToApply}
                </span>
                <span className="sm:hidden">
                  {updateInstalling ? t.updateInstalling : t.updateRestartShort}
                </span>
                {!updateInstalling && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-950/20 font-mono">
                    v{updateInfo.latest_version}
                  </span>
                )}
              </button>
            ) : updateError ? (
              <button
                type="button"
                onClick={() => downloadUpdate()}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors cursor-pointer"
                title={updateError}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.updateRetry}</span>
              </button>
            ) : !updateInfo.download_url ? (
              <button
                type="button"
                onClick={() => downloadUpdate()}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-mint-500/15 text-mint-600 dark:text-mint-300 border border-mint-500/30 hover:bg-mint-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title={`${t.updateAction.replace('{version}', updateInfo.latest_version)} (${t.openDownloadPage})`}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-mint-500" />
                <span>{t.updateAction.replace('{version}', updateInfo.latest_version)}</span>
              </button>
            ) : null}
          </>
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
