import React, { useState, useEffect, useRef } from 'react';
import {
  useFileMintStore,
  APP_VERSION,
  formatResizeSummary,
  formatFileSize,
  createProfilesExportJson,
  validateAndSanitizeProfiles,
  isTauriEnv,
} from '../store/useFileMintStore';
import {
  X,
  Shield,
  MousePointer,
  Sliders,
  Languages,
  Check,
  Palette,
  Monitor,
  Sun,
  Moon,
  Download,
  Upload,
  AlertTriangle,
  FileJson,
  Folder,
  FolderPlus,
  Plus,
  Trash2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { CustomProfile, ImageConfigTab, ContextMenuMode } from '../types';
import { getSystemLanguage } from '../i18n/translations';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    setSettingsOpen,
    contextMenuEnabled,
    contextMenuMode,
    contextMenuLoading,
    setContextMenuMode,
    defaultImageTab,
    setDefaultImageTab,
    defaultImagePreset,
    setDefaultImagePreset,
    customProfiles,
    importCustomProfiles,
    destinationConfig,
    setDestinationConfig,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    lifetimeSavedBytes,
    lifetimeFilesCount,
    resetLifetimeStats,
    watchFolders,
    addWatchFolder,
    updateWatchFolder,
    removeWatchFolder,
    toggleWatchFolder,
  } = useFileMintStore();

  const isDev = Boolean(import.meta.env.DEV);

  const handleSelectDefaultCustomFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setDestinationConfig({ mode: { Custom: selected } });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectWatchFolder = async (ruleId: string) => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        const isDuplicate = watchFolders.some(
          (r) => r.id !== ruleId && r.watch_path.toLowerCase() === selected.toLowerCase()
        );
        if (isDuplicate) {
          alert(t.duplicateWatchFolderAlert);
          return;
        }
        const folderName = selected.split(/[\\/]/).filter(Boolean).pop() || '';
        const currentRule = watchFolders.find((r) => r.id === ruleId);
        updateWatchFolder(ruleId, {
          watch_path: selected,
          enabled: true,
          name: currentRule?.name || folderName,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectWatchOutputFolder = async (ruleId: string) => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        updateWatchFolder(ruleId, { output_path: selected });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNewWatchFolder = async () => {
    const newId = await addWatchFolder();
    if (isTauriEnv()) {
      handleSelectWatchFolder(newId);
    }
  };

  const [pendingImportProfiles, setPendingImportProfiles] = useState<CustomProfile[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const systemLang = getSystemLanguage();

  const handleExport = async () => {
    const jsonString = createProfilesExportJson(customProfiles);
    const fileName = `filemint-profiles-${new Date().toISOString().slice(0, 10)}.json`;

    let savedViaTauri = false;
    try {
      const filePath = await saveDialog({
        defaultPath: fileName,
        filters: [{ name: 'JSON (*.json)', extensions: ['json'] }],
      });
      if (filePath) {
        await writeTextFile(filePath, jsonString);
        savedViaTauri = true;
      } else {
        return;
      }
    } catch {
      // Fallback for non-Tauri or scope restrictions
    }

    if (!savedViaTauri) {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    setToastMessage(t.exportSuccess);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTriggerImport = () => {
    setErrorMessage(null);
    setToastMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const valid = validateAndSanitizeProfiles(parsed);
      if (!valid || valid.length === 0) {
        setErrorMessage(t.importErrorNoValidProfiles);
        setTimeout(() => setErrorMessage(null), 4000);
        return;
      }
      setPendingImportProfiles(valid);
    } catch {
      setErrorMessage(t.importErrorInvalidJson);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImportProfiles) return;
    const success = importCustomProfiles(pendingImportProfiles);
    setPendingImportProfiles(null);
    if (success) {
      setToastMessage(t.importSuccess);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      onClick={() => setSettingsOpen(false)}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default"
      >
        {pendingImportProfiles && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-50 rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-amber-500">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {t.importConfirmTitle}
                </h4>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{t.importOverwriteWarning}</span>
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {t.importConfirmMessage.replace('{count}', String(pendingImportProfiles.length))}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t.detectedProfilesInFile} ({pendingImportProfiles.length})
                </span>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {pendingImportProfiles.map((p, idx) => {
                    const retouche = [
                      (p.options.rotation || 0) % 360 !== 0 ? `${(p.options.rotation || 0) % 360}°` : null,
                      p.options.flip_horizontal || p.options.flip_vertical ? 'Miroir' : null,
                      p.options.grayscale ? 'N&B' : null,
                    ].filter(Boolean);
                    const desc = [
                      ...retouche,
                      formatResizeSummary(p.options),
                      p.options.compress === false ? t.noCompression : `Q${p.options.quality}`,
                      p.options.metadata_policy === 'RemoveGps' ? 'Sans GPS' : p.options.metadata_policy === 'RemoveAll' ? 'Sans EXIF' : null,
                      p.options.format === 'Original' ? t.keepOriginal : p.options.format,
                    ].filter(Boolean).join(' • ');

                    return (
                      <div
                        key={p.id || idx}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-500/10 text-mint-600 dark:text-mint-400 font-semibold shrink-0">
                          {desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingImportProfiles(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t.importConfirmButton}</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-5 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-mint-500" />
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
              {t.settingsTitle}
            </h3>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            aria-label={t.close}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* 1. Préférences Générales (Langue, Thème, Mises à jour, Menu contextuel) */}
          <div className="space-y-1.5">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-1">
              <Sliders className="w-3 h-3 text-mint-500" />
              <span>{t.generalSection}</span>
            </h4>
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 divide-y divide-slate-200/70 dark:divide-slate-800/70">
              
              {/* Langue */}
              <div className="flex items-center justify-between gap-3 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-mint-500/10 text-mint-500 flex items-center justify-center shrink-0">
                    <Languages className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                      {t.languageSection}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {language === 'fr' ? t.french : t.english}
                      {systemLang === language && ` • ${t.systemLanguage}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLanguage('fr')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      language === 'fr'
                        ? 'border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 text-mint-600 dark:text-mint-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.french}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 text-mint-600 dark:text-mint-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.english}
                  </button>
                </div>
              </div>

              {/* Apparence */}
              <div className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-mint-500/10 text-mint-500 flex items-center justify-center shrink-0">
                    <Palette className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                      {t.appearance}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {theme === 'system' ? t.themeSystem : theme === 'light' ? t.themeLight : t.themeDark}
                    </span>
                  </div>
                </div>

                <div className="flex items-center rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      theme === 'system'
                        ? 'border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 text-mint-600 dark:text-mint-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title={t.themeSystem}
                  >
                    <Monitor className="w-3 h-3 shrink-0" />
                    <span>{t.themeSystem}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      theme === 'light'
                        ? 'border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 text-mint-600 dark:text-mint-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title={t.themeLight}
                  >
                    <Sun className="w-3 h-3 shrink-0" />
                    <span>{t.themeLight}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      theme === 'dark'
                        ? 'border border-slate-200/50 dark:border-slate-600 bg-white dark:bg-slate-700 text-mint-600 dark:text-mint-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title={t.themeDark}
                  >
                    <Moon className="w-3 h-3 shrink-0" />
                    <span>{t.themeDark}</span>
                  </button>
                </div>
              </div>

              {/* Menu contextuel Windows */}
              <div className="pt-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-mint-500/10 text-mint-500 flex items-center justify-center shrink-0">
                      <MousePointer className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                        {t.contextMenuLabel}
                      </span>
                      {contextMenuLoading && (
                        <Loader2 className="w-3 h-3 animate-spin text-mint-500 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <select
                      disabled={contextMenuLoading}
                      value={!contextMenuEnabled || contextMenuMode === 'disabled' ? 'disabled' : contextMenuMode}
                      onChange={(e) => setContextMenuMode(e.target.value as ContextMenuMode)}
                      className="py-1.5 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-mint-500 transition-colors cursor-pointer appearance-none shadow-xs"
                    >
                      <option value="modern">
                        {t.contextMenuModern}
                      </option>
                      <option value="classic">
                        {t.contextMenuClassic}
                      </option>
                      <option value="disabled">
                        {t.contextMenuDisabled}
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="pl-9 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  <p>
                    {(!contextMenuEnabled || contextMenuMode === 'disabled') && t.contextMenuDisabledDesc}
                    {contextMenuEnabled && contextMenuMode === 'modern' && t.contextMenuModernDesc}
                    {contextMenuEnabled && contextMenuMode === 'classic' && t.contextMenuClassicDesc}
                  </p>

                  {contextMenuEnabled && contextMenuMode !== 'disabled' && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block">
                      {t.contextMenuRefreshNotice}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Paramètres de traitement & Profils */}
          <div className="space-y-1.5">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-1">
              <Sliders className="w-3 h-3 text-mint-500" />
              <span>{t.defaultTabSection}</span>
            </h4>
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              {/* Onglet par défaut */}
              <div>
                <span className="font-semibold block text-slate-800 dark:text-slate-200 text-xs mb-1.5">
                  {t.defaultTabSection}
                </span>
                <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold">
                  {(
                    [
                      { id: 'presets', label: t.tabPresets },
                      { id: 'manipulate', label: t.tabManipulate },
                      { id: 'resize', label: t.tabResize },
                      { id: 'compress', label: t.tabCompress },
                      { id: 'convert', label: t.tabConvert },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setDefaultImageTab(item.id as ImageConfigTab)}
                      className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                        defaultImageTab === item.id
                          ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      title={item.label}
                    >
                      <span className="truncate block">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Profil par défaut */}
              <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70">
                <span className="font-semibold block text-slate-800 dark:text-slate-200 text-xs mb-1.5">
                  {t.defaultPresetSection}
                </span>

                {customProfiles.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">
                    {t.noCustomProfiles}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-semibold">
                      {customProfiles.map((p) => {
                        const isSelected =
                          (defaultImagePreset || customProfiles[0]?.id) === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setDefaultImagePreset(p.id)}
                            className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                            title={p.name}
                          >
                            <span className="truncate block">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const selectedProfile =
                        customProfiles.find((p) => p.id === defaultImagePreset) ||
                        customProfiles[0];
                      if (!selectedProfile) return null;
                      const opt = selectedProfile.options;
                      const retouche = [
                        (opt.rotation || 0) % 360 !== 0 ? `${(opt.rotation || 0) % 360}°` : null,
                        opt.flip_horizontal || opt.flip_vertical ? 'Miroir' : null,
                        opt.grayscale ? 'N&B' : null,
                      ].filter(Boolean);
                      const summaryText = [
                        ...retouche,
                        formatResizeSummary(opt),
                        opt.compress === false ? t.noCompression : `Q${opt.quality}`,
                        opt.metadata_policy === 'RemoveGps' ? 'Sans GPS' : opt.metadata_policy === 'RemoveAll' ? 'Sans EXIF' : null,
                        opt.format === 'Original' ? t.keepOriginal : opt.format,
                      ].filter(Boolean).join(' • ');

                      return (
                        <div className="mt-2 p-2 px-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                            {summaryText}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-mint-500/10 text-mint-600 dark:text-mint-400 font-semibold font-mono text-[10px] shrink-0">
                            {opt.format === 'Original' ? t.keepOriginal : opt.format}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Profiles Export/Import */}
                <div className="pt-2.5 mt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <FileJson className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                    <span className="font-semibold">{t.exportImportTitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExport}
                      className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                      <Download className="w-3 h-3 text-mint-500" />
                      <span>{t.exportProfiles}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerImport}
                      className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3 h-3 text-blue-500" />
                      <span>{t.importProfiles}</span>
                    </button>
                  </div>
                </div>

                {toastMessage && (
                  <div className="mt-2 p-2 rounded-xl bg-mint-500/10 border border-mint-500/30 text-mint-700 dark:text-mint-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                    <Check className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                    <span>{toastMessage}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="mt-2 p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* 3. Emplacement d'exportation */}
          <div className="space-y-1.5">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-1">
              <Folder className="w-3 h-3 text-mint-500" />
              <span>{t.exportLocationSection}</span>
            </h4>
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              {/* Option 1: Sous-dossier relatif */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDestinationConfig({ mode: 'FileMintSubfolder' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDestinationConfig({ mode: 'FileMintSubfolder' });
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  destinationConfig.mode === 'FileMintSubfolder'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      destinationConfig.mode === 'FileMintSubfolder'
                        ? 'border-mint-500 bg-mint-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {destinationConfig.mode === 'FileMintSubfolder' && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                        {t.modeSubfolder}
                      </span>
                      <span className="text-[10px] font-mono text-mint-600 dark:text-mint-400 font-semibold px-1.5 py-0.5 rounded bg-mint-500/10">
                        ./{destinationConfig.subfolder_name || 'FileMint'}/
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {t.modeSubfolderDesc}
                    </p>

                    {destinationConfig.mode === 'FileMintSubfolder' && (
                      <div
                        className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          {t.defaultSubfolderName} :
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={destinationConfig.subfolder_name || 'FileMint'}
                            onChange={(e) =>
                              setDestinationConfig({ subfolder_name: e.target.value })
                            }
                            placeholder={t.subfolderNamePlaceholder}
                            className="w-36 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-mint-500"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">
                            ./{destinationConfig.subfolder_name || 'FileMint'}/
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 2: Même dossier */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDestinationConfig({ mode: 'SameAsOriginal' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDestinationConfig({ mode: 'SameAsOriginal' });
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  destinationConfig.mode === 'SameAsOriginal'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      destinationConfig.mode === 'SameAsOriginal'
                        ? 'border-mint-500 bg-mint-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {destinationConfig.mode === 'SameAsOriginal' && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 block">
                      {t.modeSame}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {t.modeSameDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 3: Dossier personnalisé */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (typeof destinationConfig.mode !== 'object') {
                    handleSelectDefaultCustomFolder();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (typeof destinationConfig.mode !== 'object') {
                      handleSelectDefaultCustomFolder();
                    }
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  typeof destinationConfig.mode === 'object'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      typeof destinationConfig.mode === 'object'
                        ? 'border-mint-500 bg-mint-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {typeof destinationConfig.mode === 'object' && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                        {t.modeCustom}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDefaultCustomFolder();
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-mint-500" />
                        <span>{t.chooseCustom}</span>
                      </button>
                    </div>
                    {typeof destinationConfig.mode === 'object' ? (
                      <div className="mt-1.5 p-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200 break-all">
                        {destinationConfig.mode.Custom}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        {t.defaultCustomFolder}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Dossiers de surveillance automatique */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-mint-500" />
                <span>{t.watchFoldersSection}</span>
              </h4>
              <div className="flex items-center gap-2">
                {watchFolders.filter((f) => f.enabled && f.watch_path).length > 0 && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {watchFolders.filter((f) => f.enabled && f.watch_path).length}{' '}
                      {watchFolders.filter((f) => f.enabled && f.watch_path).length > 1
                        ? t.watchFoldersActivePlural
                        : t.watchFoldersActiveSingular}
                    </span>
                  </span>
                )}
                {watchFolders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddNewWatchFolder}
                    className="px-2 py-0.5 rounded-lg border border-mint-500/30 hover:border-mint-500 hover:bg-mint-500/10 text-mint-600 dark:text-mint-400 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.addWatchFolder}</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 leading-snug">
              {t.watchFoldersDesc}
            </p>

            {watchFolders.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
                <FolderPlus className="w-7 h-7 text-mint-500/70 mx-auto" />
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                  {t.watchFolderEmptyDesc}
                </p>
                <button
                  type="button"
                  onClick={handleAddNewWatchFolder}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addWatchFolder}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {watchFolders.map((rule, index) => {
                  const activeProfileId = rule.profile_id || defaultImagePreset;
                  const activeProfile =
                    customProfiles.find((p) => p.id === activeProfileId) ||
                    customProfiles[0];

                  return (
                    <div
                      key={rule.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2.5 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0">
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={rule.name || ''}
                            onChange={(e) =>
                              updateWatchFolder(rule.id, { name: e.target.value })
                            }
                            placeholder={
                              rule.watch_path
                                ? rule.watch_path.split(/[\\/]/).filter(Boolean).pop() || `Dossier ${index + 1}`
                                : `Dossier ${index + 1}`
                            }
                            className="bg-transparent font-semibold text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-b focus:border-mint-500 max-w-xs truncate"
                          />
                          {rule.enabled && rule.watch_path && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold shrink-0">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="hidden sm:inline">Actif</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Enable toggle switch for this rule */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={rule.enabled}
                            onClick={() => toggleWatchFolder(rule.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.enabled
                                ? 'bg-mint-500'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            title={rule.enabled ? 'Désactiver ce dossier surveillé' : 'Activer ce dossier surveillé'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                rule.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Delete rule button */}
                          <button
                            type="button"
                            onClick={() => removeWatchFolder(rule.id)}
                            className="p-1 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title={t.deleteWatchFolder}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="space-y-2">
                        {/* Source folder */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {t.watchFolderPath}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              placeholder={t.watchFolderSelectPlaceholder}
                              value={rule.watch_path || ''}
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSelectWatchFolder(rule.id)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Folder className="w-3.5 h-3.5 text-mint-500" />
                              <span>{t.watchFolderBrowse}</span>
                            </button>
                          </div>
                        </div>

                        {/* Destination folder */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {t.watchFolderDestPath}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              placeholder={t.watchFolderDefaultSubfolder}
                              value={rule.output_path || ''}
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSelectWatchOutputFolder(rule.id)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Folder className="w-3.5 h-3.5 text-mint-500" />
                              <span>{t.watchFolderBrowse}</span>
                            </button>
                            {rule.output_path && (
                              <button
                                type="button"
                                onClick={() => updateWatchFolder(rule.id, { output_path: null })}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-500 text-slate-400 cursor-pointer"
                                title={t.watchFolderResetDest}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Profil d'optimisation appliqué */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {t.watchFolderProfileLabel}
                            </label>
                            {activeProfile && (
                              <span className="text-[10px] font-mono text-mint-600 dark:text-mint-400 font-semibold truncate max-w-[260px]">
                                {formatResizeSummary(activeProfile.options)} • Q{activeProfile.options.quality} • {activeProfile.options.format}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              value={rule.profile_id || ''}
                              onChange={(e) => {
                                const newProfileId = e.target.value || null;
                                const targetProfile =
                                  customProfiles.find(
                                    (p) => p.id === (newProfileId || defaultImagePreset)
                                  ) || customProfiles[0];
                                updateWatchFolder(rule.id, {
                                  profile_id: newProfileId,
                                  image_options: targetProfile ? targetProfile.options : undefined,
                                });
                              }}
                              className="w-full py-1.5 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 text-xs font-medium cursor-pointer appearance-none focus:outline-none focus:border-mint-500"
                            >
                              <option value="">
                                {t.watchFolderProfileDefault} (
                                {customProfiles.find((p) => p.id === defaultImagePreset)?.name ||
                                  'Web'}
                                )
                              </option>
                              {customProfiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Drop box mode checkbox */}
                        <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.delete_source}
                            onChange={(e) =>
                              updateWatchFolder(rule.id, { delete_source: e.target.checked })
                            }
                            className="rounded text-mint-500 accent-mint-500"
                          />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            <strong className="text-slate-700 dark:text-slate-200">
                              {t.watchFolderDeleteSource}
                            </strong>{' '}
                            — {t.watchFolderDeleteSourceDesc}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </div>

          {/* 5. Confidentialité & Statistiques d'impact */}
          <div className="space-y-1.5 pt-0.5">
            <div className="p-3 rounded-2xl bg-mint-500/5 border border-mint-500/20 text-slate-600 dark:text-slate-300 flex items-start gap-2.5 text-[11px]">
              <Shield className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" />
              <div className="min-w-0 leading-relaxed space-y-0.5">
                <span className="font-semibold text-slate-800 dark:text-slate-100 block text-xs">
                  {t.privacySection}
                </span>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 mt-0.5 leading-snug">
                  <p>{t.privacyItem1}</p>
                  <p>{t.privacyItem2}</p>
                </div>
              </div>
            </div>

            {/* Statistiques globales textuelles discrètes */}
            <div className="px-2 py-0.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {t.lifetimeStatsTitle} :
                </span>
                <span>
                  <strong className="text-mint-600 dark:text-mint-400 font-mono font-semibold">
                    {formatFileSize(lifetimeSavedBytes, language)}
                  </strong>{' '}
                  {language === 'fr' ? "d'espace économisé" : 'disk space saved'} •{' '}
                  <strong className="text-slate-700 dark:text-slate-200 font-mono font-semibold">
                    {lifetimeFilesCount}
                  </strong>{' '}
                  {lifetimeFilesCount <= 1 && language === 'fr'
                    ? 'fichier optimisé'
                    : t.lifetimeFilesOptimized.toLowerCase()}
                </span>
              </div>

              {lifetimeFilesCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t.resetStatsConfirm)) {
                      resetLifetimeStats();
                    }
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                  title={t.resetStats}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.resetStats}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-end">
          <div className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-slate-400 dark:text-slate-500 select-none">
            FileMint v{APP_VERSION}{isDev ? ' Local' : ''}
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
