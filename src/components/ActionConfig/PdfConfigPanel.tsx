import React from 'react';
import { useFileMintStore } from '../../store/useFileMintStore';
import { PdfProfile } from '../../types';
import { FileText, Check, ShieldCheck } from 'lucide-react';

export const PdfConfigPanel: React.FC = () => {
  const { pdfOptions, setPdfOptions, t } = useFileMintStore();

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
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <FileText className="w-3.5 h-3.5 text-red-500" />
        <span>{t.pdfProfileTitle}</span>
      </div>

      <div className="space-y-3">
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
            <span className="text-[11px] text-slate-400">
              {t.optimizeStructureDesc}
            </span>
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
            <span className="text-[11px] text-slate-400">
              {t.recompressStreamsDesc}
            </span>
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
