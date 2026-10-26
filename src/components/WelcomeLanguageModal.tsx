import React, { useState } from 'react';
import { useFileMintStore } from '../store/useFileMintStore';
import { getSystemLanguage, Language } from '../i18n/translations';
import { ThemeMode, ContextMenuMode } from '../types';
import {
  Languages,
  ShieldCheck,
  Zap,
  Monitor,
  Sun,
  Moon,
} from 'lucide-react';

export const WelcomeLanguageModal: React.FC = () => {
  const {
    showWelcomeModal,
    setWelcomeModalOpen,
    language,
    setLanguage,
    theme,
    setTheme,
    contextMenuMode,
    setContextMenuMode,
  } = useFileMintStore();
  const systemLang = getSystemLanguage();
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(theme || 'system');
  const [selectedContextMenu, setSelectedContextMenu] = useState<ContextMenuMode>(
    contextMenuMode === 'disabled' ? 'disabled' : contextMenuMode || 'modern'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!showWelcomeModal) return null;

  const handleThemeSelect = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    setTheme(mode);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      setTheme(selectedTheme);
      setLanguage(selectedLang);

      // Explicitly apply the chosen context menu mode and wait for completion
      await setContextMenuMode(selectedContextMenu);
      setWelcomeModalOpen(false);
    } catch (err) {
      console.error('Erreur configuration initiale :', err);
      setWelcomeModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fadeIn select-none p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-slate-800 dark:text-slate-100 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-mint-500/20 to-emerald-500/20 text-mint-500 flex items-center justify-center mb-3 shadow-inner">
          <Languages className="w-6 h-6 text-mint-500" />
        </div>

        <h2 className="text-xl font-bold mb-1">
          {selectedLang === 'fr' ? 'Bienvenue sur FileMint' : 'Welcome to FileMint'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          {selectedLang === 'fr'
            ? 'Optimiseur & convertisseur local pour images et PDF. 100% hors ligne et respectueux de votre vie privée.'
            : 'Local image and PDF optimizer & converter. 100% offline and privacy-focused.'}
        </p>

        {/* 1. Language */}
        <div className="w-full text-left space-y-1.5 mb-4">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {selectedLang === 'fr' ? 'Langue de l\'application :' : 'Application language:'}
          </label>
          <div className="relative">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as Language)}
              className="w-full py-2 px-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm font-medium focus:outline-none focus:border-mint-500 transition-colors cursor-pointer appearance-none text-slate-800 dark:text-slate-100"
            >
              <option value="fr">
                Français {systemLang === 'fr' ? '• (Langue système)' : ''}
              </option>
              <option value="en">
                English {systemLang === 'en' ? '• (System language)' : ''}
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Theme */}
        <div className="w-full text-left space-y-1.5 mb-4">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {selectedLang === 'fr' ? 'Thème & Apparence :' : 'Theme & Appearance:'}
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleThemeSelect('system')}
              className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[48px] ${
                selectedTheme === 'system'
                  ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm ring-1 ring-mint-500/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span>{selectedLang === 'fr' ? 'Système' : 'System'}</span>
              </div>
              <span className="text-[9px] font-medium tracking-normal px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {selectedLang === 'fr' ? 'Windows' : 'OS Default'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeSelect('light')}
              className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[48px] ${
                selectedTheme === 'light'
                  ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm ring-1 ring-mint-500/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span>{selectedLang === 'fr' ? 'Clair' : 'Light'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeSelect('dark')}
              className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[48px] ${
                selectedTheme === 'dark'
                  ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm ring-1 ring-mint-500/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span>{selectedLang === 'fr' ? 'Sombre' : 'Dark'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Windows Context Menu Integration */}
        <div className="w-full text-left space-y-1.5 mb-4">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {selectedLang === 'fr'
              ? 'Menu contextuel (clic droit Windows) :'
              : 'Context menu (Windows right-click):'}
          </label>
          <div className="relative">
            <select
              value={selectedContextMenu}
              onChange={(e) => setSelectedContextMenu(e.target.value as ContextMenuMode)}
              className="w-full py-2 px-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm font-medium focus:outline-none focus:border-mint-500 transition-colors cursor-pointer appearance-none text-slate-800 dark:text-slate-100"
            >
              <option value="modern">
                {selectedLang === 'fr'
                  ? 'Moderne (Windows 11) • Recommandé'
                  : 'Modern (Windows 11) • Recommended'}
              </option>
              <option value="classic">
                {selectedLang === 'fr'
                  ? 'Classique (Windows 10 / 11)'
                  : 'Classic (Windows 10 / 11)'}
              </option>
              <option value="disabled">
                {selectedLang === 'fr' ? 'Désactivé' : 'Disabled'}
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            {selectedContextMenu === 'modern' &&
              (selectedLang === 'fr'
                ? 'Visible directement au premier clic droit dans l\'Explorateur.'
                : 'Directly visible on primary right-click in Windows Explorer.')}
            {selectedContextMenu === 'classic' &&
              (selectedLang === 'fr'
                ? 'Dans « Afficher plus d\'options » ou sous Windows 10.'
                : 'Inside "Show more options" or on Windows 10.')}
            {selectedContextMenu === 'disabled' &&
              (selectedLang === 'fr'
                ? 'Ne pas afficher FileMint au clic droit dans l\'Explorateur.'
                : 'Do not show FileMint on right-click in Explorer.')}
          </span>
        </div>

        {/* 4. Privacy */}
        <div className="w-full p-2.5 rounded-2xl bg-mint-500/10 border border-mint-500/20 text-mint-700 dark:text-mint-400 text-xs flex items-center gap-2 mb-4 text-left">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="text-[11px]">
            {selectedLang === 'fr'
              ? 'Aucune donnée ni télémétrie n\'est transmise sur internet.'
              : 'Zero telemetry, no files or usage data are ever sent over internet.'}
          </span>
        </div>

        {/* 5. Confirm */}
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className={`w-full py-2.5 rounded-xl bg-mint-500 hover:bg-mint-600 text-slate-950 font-bold text-sm shadow-lg shadow-mint-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer ${
            isSubmitting ? 'opacity-75 pointer-events-none' : ''
          }`}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Zap className="w-4 h-4 fill-slate-950" />
          )}
          <span>
            {isSubmitting
              ? selectedLang === 'fr'
                ? 'Configuration en cours...'
                : 'Setting up...'
              : selectedLang === 'fr'
              ? 'Commencer'
              : 'Get Started'}
          </span>
        </button>
      </div>
    </div>
  );
};
