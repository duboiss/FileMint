import React, { useState } from 'react';
import { useFileMintStore } from '../../store/useFileMintStore';
import { PdfProfile } from '../../types';
import { FileText, Check, ShieldCheck, Target } from 'lucide-react';

export const PdfConfigPanel: React.FC = () => {
  const { pdfOptions, setPdfOptions, t, language } = useFileMintStore();
  const [pdfTargetUnit, setPdfTargetUnit] = useState<'kb' | 'mb'>('mb');

  const profiles: Array<{
    id: PdfProfile;
    title: string;
    targetDpi: string;
    description: string;
    badge: string;
  }> = [
    {
      id: 'Readable',
      title: t.profileReadable,
      targetDpi: '200-250 DPI',
      description: t.profileReadableDesc,
      badge: t.pdfBadgeOffice,
    },
    {
      id: 'Balanced',
      title: t.profileBalanced,
      targetDpi: '~150 DPI',
      description: t.profileBalancedDesc,
      badge: t.pdfBadgeRecommended,
    },
    {
      id: 'Compact',
      title: t.profileCompact,
      targetDpi: '~100 DPI',
      description: t.profileCompactDesc,
      badge: t.pdfBadgeScans,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/40 p-5 overflow-y-auto select-none space-y-5">
      {/* Mode switch: Preset Profiles vs Target Size */}
      <div className="grid grid-cols-2 p-1 bg-slate-200/50 dark:bg-slate-800/60 rounded-2xl border border-slate-300/40 dark:border-slate-700/50 text-[11px] font-semibold shadow-inner">
        <button
          type="button"
          onClick={() => setPdfOptions({ target_size_kb: null })}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            !pdfOptions.target_size_kb
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-red-500" />
          <span>{t.pdfPresetProfiles}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            setPdfOptions({
              target_size_kb: pdfOptions.target_size_kb || 1024,
            })
          }
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            Boolean(pdfOptions.target_size_kb)
              ? 'bg-white dark:bg-slate-900 text-mint-600 dark:text-mint-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-mint-500" />
          <span>{t.compressionModeTargetSize}</span>
        </button>
      </div>

      {/* Target Size mode card */}
      {Boolean(pdfOptions.target_size_kb) ? (
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center text-xs font-medium">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-mint-500" />
              <span>{t.targetSizeTitle}</span>
            </span>
            <span className="font-mono font-bold text-mint-500 text-sm bg-mint-500/10 px-2.5 py-0.5 rounded-lg border border-mint-500/20">
              ≤ {(pdfOptions.target_size_kb || 1024) >= 1024
                ? `${((pdfOptions.target_size_kb || 1024) / 1024).toFixed(
                    (pdfOptions.target_size_kb || 1024) % 1024 === 0 ? 0 : 1
                  )} ${language === 'en' ? 'MB' : 'Mo'}`
                : `${pdfOptions.target_size_kb || 1024} ${language === 'en' ? 'KB' : 'Ko'}`}
            </span>
          </div>

          {/* Quick pills */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t.targetSizeQuickPills}
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: language === 'en' ? '500 KB' : '500 Ko', kb: 500 },
                { label: language === 'en' ? '1 MB' : '1 Mo', kb: 1024 },
                { label: language === 'en' ? '2 MB' : '2 Mo', kb: 2048 },
                { label: language === 'en' ? '5 MB' : '5 Mo', kb: 5120 },
                { label: language === 'en' ? '10 MB' : '10 Mo', kb: 10240 },
              ].map((item) => {
                const isSelected = pdfOptions.target_size_kb === item.kb;
                return (
                  <button
                    key={item.kb}
                    type="button"
                    onClick={() => setPdfOptions({ target_size_kb: item.kb })}
                    className={`py-2 px-1 rounded-xl text-center text-xs transition-all cursor-pointer font-medium ${
                      isSelected
                        ? 'bg-mint-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t.targetSizeCustomLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="50"
                max="100000"
                step={pdfTargetUnit === 'mb' ? '0.1' : '100'}
                value={
                  pdfTargetUnit === 'mb'
                    ? Number(((pdfOptions.target_size_kb || 1024) / 1024).toFixed(2))
                    : pdfOptions.target_size_kb || 1024
                }
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value) || 1);
                  const kb = pdfTargetUnit === 'mb' ? Math.round(val * 1024) : Math.round(val);
                  setPdfOptions({ target_size_kb: kb });
                }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/30"
              />
              <div className="flex items-center p-0.5 bg-slate-200/50 dark:bg-slate-800/60 rounded-xl border border-slate-300/40 dark:border-slate-700/50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPdfTargetUnit('kb')}
                  className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                    pdfTargetUnit === 'kb'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'en' ? 'KB' : 'Ko'}
                </button>
                <button
                  type="button"
                  onClick={() => setPdfTargetUnit('mb')}
                  className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                    pdfTargetUnit === 'mb'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {language === 'en' ? 'MB' : 'Mo'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-mint-500/10 border border-mint-500/20 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.pdfTargetSizeDesc}
          </div>
        </div>
      ) : (
        /* Preset profiles list */
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <FileText className="w-3.5 h-3.5 text-red-500" />
            <span>{t.pdfProfileTitle}</span>
          </div>

          {profiles.map((p) => {
            const isSelected = pdfOptions.profile === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPdfOptions({ profile: p.id })}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs flex items-center gap-2">
                    <span>{p.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                      {p.targetDpi}
                    </span>
                    {p.id === 'Balanced' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint-500/20 text-mint-600 dark:text-mint-400 font-semibold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {p.description}
                  </p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-mint-500 shrink-0 ml-3" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3 pt-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          {t.advancedOptions}
        </label>

        <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-800/30 cursor-pointer">
          <input
            type="checkbox"
            checked={pdfOptions.optimize_structure}
            onChange={(e) => setPdfOptions({ optimize_structure: e.target.checked })}
            className="rounded text-mint-500 accent-mint-500 mt-0.5"
          />
          <div>
            <span className="text-xs font-semibold block text-slate-800 dark:text-slate-200">
              {t.optimizeStructure}
            </span>
            <span className="text-[11px] text-slate-400">{t.optimizeStructureDesc}</span>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-800/30 cursor-pointer">
          <input
            type="checkbox"
            checked={pdfOptions.recompress_images}
            onChange={(e) => setPdfOptions({ recompress_images: e.target.checked })}
            className="rounded text-mint-500 accent-mint-500 mt-0.5"
          />
          <div>
            <span className="text-xs font-semibold block text-slate-800 dark:text-slate-200">
              {t.recompressStreams}
            </span>
            <span className="text-[11px] text-slate-400">{t.recompressStreamsDesc}</span>
          </div>
        </label>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-mint-500 shrink-0" />
        <span>{t.pdfSafetyNote}</span>
      </div>
    </div>
  );
};
