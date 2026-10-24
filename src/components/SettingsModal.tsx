import React, { useState, useEffect, useRef } from 'react';
import {
  useFileMintStore,
  formatResizeSummary,
  createProfilesExportJson,
  validateAndSanitizeProfiles,
} from '../store/useFileMintStore';
import {
  X,
  Shield,
  Globe,
  MousePointer,
  ExternalLink,
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
  Loader2,
  Sparkles,
  Layers,
  EyeOff,
} from 'lucide-react';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { CustomProfile, ImageConfigTab } from '../types';
import { getSystemLanguage } from '../i18n/translations';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    setSettingsOpen,
    updateCheckEnabled,
    setUpdateCheckEnabled,
    updateInfo,
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
  } = useFileMintStore();

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
        className="relative max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default"
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

        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-mint-500" />
              <span>{t.languageSection}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    language === 'fr'
                      ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{t.french}</span>
                  {systemLang === 'fr' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-mint-500/20 text-mint-600 dark:text-mint-400 border border-mint-500/30">
                      {t.systemLanguage}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    language === 'en'
                      ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{t.english}</span>
                  {systemLang === 'en' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-mint-500/20 text-mint-600 dark:text-mint-400 border border-mint-500/30">
                      {t.systemLanguage}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-mint-500" />
              <span>{t.appearance}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                {t.chooseTheme}
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[52px] ${
                    theme === 'system'
                      ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.themeSystem}</span>
                  </div>
                  <span className="text-[9px] font-medium tracking-normal px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {t.themeSystemWindows}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[52px] ${
                    theme === 'light'
                      ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.themeLight}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[52px] ${
                    theme === 'dark'
                      ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.themeDark}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MousePointer className="w-3.5 h-3.5" />
              <span>{t.systemIntegration}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold block text-slate-800 dark:text-slate-200">
                      {t.contextMenuLabel}
                    </span>
                    {contextMenuLoading && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-mint-600 dark:text-mint-400 bg-mint-500/10 px-2 py-0.5 rounded-full animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t.contextMenuApplying}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {t.contextMenuDesc}
                  </span>
                </div>
              </div>

              <div
                className={`pt-1 space-y-2 transition-opacity ${
                  contextMenuLoading ? 'opacity-70 pointer-events-none' : ''
                }`}
              >
                {/* 1. Modern */}
                <button
                  type="button"
                  disabled={contextMenuLoading}
                  onClick={() => setContextMenuMode('modern')}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    contextMenuEnabled && contextMenuMode === 'modern'
                      ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        contextMenuEnabled && contextMenuMode === 'modern'
                          ? 'bg-mint-500/20 text-mint-500'
                          : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {t.contextMenuModern}
                        </span>
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-mint-500/20 text-mint-600 dark:text-mint-400 border border-mint-500/30">
                          {t.contextMenuBadgeRecommended}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.contextMenuModernDesc}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center">
                    {contextMenuEnabled && contextMenuMode === 'modern' ? (
                      <div className="w-5 h-5 rounded-full bg-mint-500 text-slate-950 flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                </button>

                {/* 2. Classic */}
                <button
                  type="button"
                  disabled={contextMenuLoading}
                  onClick={() => setContextMenuMode('classic')}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    contextMenuEnabled && contextMenuMode === 'classic'
                      ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        contextMenuEnabled && contextMenuMode === 'classic'
                          ? 'bg-mint-500/20 text-mint-500'
                          : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                        {t.contextMenuClassic}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.contextMenuClassicDesc}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center">
                    {contextMenuEnabled && contextMenuMode === 'classic' ? (
                      <div className="w-5 h-5 rounded-full bg-mint-500 text-slate-950 flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                </button>

                {/* 3. Disabled */}
                <button
                  type="button"
                  disabled={contextMenuLoading}
                  onClick={() => setContextMenuMode('disabled')}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    !contextMenuEnabled || contextMenuMode === 'disabled'
                      ? 'border-slate-400 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-400/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        !contextMenuEnabled || contextMenuMode === 'disabled'
                          ? 'bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      <EyeOff className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                        {t.contextMenuDisabled}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.contextMenuDisabledDesc}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center">
                    {!contextMenuEnabled || contextMenuMode === 'disabled' ? (
                      <div className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                </button>
              </div>

              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block text-center pt-1">
                {t.contextMenuRefreshNotice}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>{t.defaultTabSection}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <div>
                <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">
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
                      className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                        defaultImageTab === item.id
                          ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      title={item.label}
                    >
                      <span className="truncate block tracking-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60">
                <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1.5">
                  {t.defaultPresetSection}
                </span>

                {customProfiles.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">
                    {t.noCustomProfiles}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
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
                                ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
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
                        <div className="mt-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                            {summaryText}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] shrink-0">
                            {/* 1. Retouche */}
                            {(opt.rotation || 0) % 360 !== 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-sans">
                                {(opt.rotation || 0) % 360}°
                              </span>
                            )}
                            {(opt.flip_horizontal || opt.flip_vertical) && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-sans">
                                Miroir
                              </span>
                            )}
                            {opt.grayscale && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 font-sans">
                                N&B
                              </span>
                            )}

                            {/* 2. Dimensions */}
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                              {formatResizeSummary(opt)}
                            </span>

                            {/* 3. Compression & Confidentialité */}
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                              {opt.compress === false ? t.noCompression : `Q${opt.quality}`}
                            </span>
                            {opt.metadata_policy === 'RemoveGps' && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                                Sans GPS
                              </span>
                            )}
                            {opt.metadata_policy === 'RemoveAll' && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 font-semibold">
                                Sans EXIF
                              </span>
                            )}

                            {/* 4. Format */}
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                              {opt.format === 'Original' ? t.keepOriginal : opt.format}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <FileJson className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {t.exportImportTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{t.importOverwriteWarning}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={handleExport}
                      className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-mint-500" />
                      <span>{t.exportProfiles}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerImport}
                      className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-500" />
                      <span>{t.importProfiles}</span>
                    </button>
                  </div>

                  {toastMessage && (
                    <div className="p-2 rounded-xl bg-mint-500/10 border border-mint-500/30 text-mint-700 dark:text-mint-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                      <Check className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                      <span>{toastMessage}</span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
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
          </div>

          {/* Export location & destination section */}
          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-mint-500" />
              <span>{t.exportLocationSection}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3.5 text-xs">
              <div>
                <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1.5">
                  {t.defaultExportMode}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestinationConfig({ mode: 'FileMintSubfolder' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      destinationConfig.mode === 'FileMintSubfolder'
                        ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-xs">{t.modeSubfolder}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      ./{destinationConfig.subfolder_name || 'FileMint'}/
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestinationConfig({ mode: 'SameAsOriginal' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      destinationConfig.mode === 'SameAsOriginal'
                        ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-xs">{t.modeSame}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {t.modeSameDesc}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectDefaultCustomFolder}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      typeof destinationConfig.mode === 'object'
                        ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-xs">{t.modeCustom}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {typeof destinationConfig.mode === 'object' ? destinationConfig.mode.Custom : t.chooseCustom}
                    </div>
                  </button>
                </div>
              </div>

              {/* Relative subfolder name setting */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <label className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">
                  {t.defaultSubfolderName}
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      value={destinationConfig.subfolder_name || 'FileMint'}
                      onChange={(e) => setDestinationConfig({ subfolder_name: e.target.value })}
                      placeholder={t.subfolderNamePlaceholder}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-mint-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ./{destinationConfig.subfolder_name || 'FileMint'}/
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>{t.updatesSection}</span>
            </h4>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold block text-slate-800 dark:text-slate-200">
                    {t.updateCheckLabel}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {t.updateCheckDesc}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={updateCheckEnabled}
                  onChange={(e) => setUpdateCheckEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-mint-500 accent-mint-500 cursor-pointer"
                />
              </div>

              {updateInfo?.has_update && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-mint-500 font-semibold">
                    {t.updateAvailable} (v{updateInfo.latest_version})
                  </span>
                  <button
                    onClick={() => openUrl(updateInfo.release_notes_url)}
                    className="flex items-center gap-1 text-[11px] text-mint-600 dark:text-mint-400 underline font-medium cursor-pointer"
                  >
                    <span>{t.openDownloadPage}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-mint-500/5 border border-mint-500/20 text-slate-600 dark:text-slate-300 space-y-2">
            <span className="font-bold text-mint-600 dark:text-mint-400 block">
              {t.privacySection}
            </span>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t.privacyP1}
            </p>
            <ul className="text-[11px] space-y-1 list-disc list-inside text-slate-500 dark:text-slate-400">
              <li>{t.privacyItem1}</li>
              <li>{t.privacyItem2}</li>
              <li>{t.privacyItem3}</li>
            </ul>
          </div>
        </div>

        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end">
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
