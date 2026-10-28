import React, { useState } from 'react';
import { useFileMintStore, formatFileSize } from '../../store/useFileMintStore';
import { PdfProfile } from '../../types';
import {
  FileText,
  Check,
  ShieldCheck,
  Target,
  FileDown,
  Layers,
  Scissors,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  FileCheck,
  Files,
} from 'lucide-react';

export const PdfConfigPanel: React.FC = () => {
  const {
    files,
    pdfOptions,
    setPdfOptions,
    pdfToolMode,
    setPdfToolMode,
    pdfMergeOrder,
    reorderPdfMerge,
    pdfMergeOutputName,
    setPdfMergeOutputName,
    pdfSplitAction,
    setPdfSplitAction,
    pdfPageRangeInput,
    setPdfPageRangeInput,
    selectedPdfPages,
    activePdfTotalPages,
    t,
    language,
  } = useFileMintStore();

  const [pdfTargetUnit, setPdfTargetUnit] = useState<'kb' | 'mb'>('mb');

  const pdfFiles = files.filter((f) => f.fileType === 'pdf');
  const orderedPdfFiles = pdfMergeOrder
    .map((p) => pdfFiles.find((f) => f.path === p))
    .filter((f): f is (typeof pdfFiles)[0] => Boolean(f));
  const displayMergeFiles = orderedPdfFiles.length > 0 ? orderedPdfFiles : pdfFiles;

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
      {/* Top Main PDF Tool Mode Tabs: Compresser | Fusionner | Découper */}
      <div className="grid grid-cols-3 p-1 bg-slate-200/50 dark:bg-slate-800/60 rounded-2xl border border-slate-300/40 dark:border-slate-700/50 text-[11px] font-semibold shadow-inner">
        <button
          type="button"
          onClick={() => setPdfToolMode('compress')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            pdfToolMode === 'compress'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileDown className="w-3.5 h-3.5 text-mint-500" />
          <span>{t.tabPdfCompress}</span>
        </button>

        <button
          type="button"
          onClick={() => setPdfToolMode('merge')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
            pdfToolMode === 'merge'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>{t.tabPdfMerge}</span>
          {pdfFiles.length > 0 && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                pdfFiles.length >= 2
                  ? 'bg-mint-500 text-slate-950'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {pdfFiles.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPdfToolMode('split')}
          className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            pdfToolMode === 'split'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 text-amber-500" />
          <span>{t.tabPdfSplit}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. COMPRESSION MODE */}
      {/* ========================================================= */}
      {pdfToolMode === 'compress' && (
        <div className="space-y-5">
          {/* Sub-mode switch: Preset Profiles vs Target Size */}
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
      )}

      {/* ========================================================= */}
      {/* 2. MERGE MODE */}
      {/* ========================================================= */}
      {pdfToolMode === 'merge' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                {t.pdfMergeTitle}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.pdfMergeDesc}
            </p>
          </div>

          {pdfFiles.length < 2 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-3 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {t.pdfMergeNeedsTwo}
              </div>
            </div>
          )}

          {/* Merge Order List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Files className="w-3.5 h-3.5 text-blue-500" />
                <span>Documents ({displayMergeFiles.length})</span>
              </span>
              <span className="text-[10px] font-normal text-slate-400 lowercase">
                ordre de fusion
              </span>
            </div>

            <div className="space-y-1.5">
              {displayMergeFiles.map((file, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === displayMergeFiles.length - 1;

                return (
                  <div
                    key={file.path}
                    className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatFileSize(file.sizeBytes, language)}
                        </div>
                      </div>
                    </div>

                    {/* Move Up / Down Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => reorderPdfMerge(idx, idx - 1)}
                        className={`p-1.5 rounded-lg transition-all ${
                          isFirst
                            ? 'opacity-30 cursor-not-allowed text-slate-400'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer'
                        }`}
                        title={t.pdfMoveUp}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => reorderPdfMerge(idx, idx + 1)}
                        className={`p-1.5 rounded-lg transition-all ${
                          isLast
                            ? 'opacity-30 cursor-not-allowed text-slate-400'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer'
                        }`}
                        title={t.pdfMoveDown}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Merged output file name */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              {t.pdfMergeOutputNameLabel}
            </label>
            <input
              type="text"
              value={pdfMergeOutputName}
              onChange={(e) => setPdfMergeOutputName(e.target.value)}
              placeholder={t.pdfMergeOutputNamePlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-mint-500/30"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t.namingVariablesLabel}{' '}
              <code className="text-mint-500 font-mono font-semibold">{'{nom}'}</code> ={' '}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {displayMergeFiles[0]?.name.replace(/\.[^/.]+$/, '') || 'document'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SPLIT / EXTRACT MODE */}
      {/* ========================================================= */}
      {pdfToolMode === 'split' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                {t.pdfSplitTitle}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.pdfSplitDesc}
            </p>
          </div>

          {/* Action Choice: 1 single PDF vs burst into individual page files */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Mode de découpage
            </label>

            {/* Option 1: Single combined PDF */}
            <button
              type="button"
              onClick={() => setPdfSplitAction('single_pdf')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                pdfSplitAction === 'single_pdf'
                  ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  pdfSplitAction === 'single_pdf' ? 'text-mint-500' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">
                  {t.pdfSplitActionSingle}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  {t.pdfSplitActionSingleDesc}
                </span>
              </div>
            </button>

            {/* Option 2: 1 file per page */}
            <button
              type="button"
              onClick={() => setPdfSplitAction('separate_pdfs')}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                pdfSplitAction === 'separate_pdfs'
                  ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Files
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  pdfSplitAction === 'separate_pdfs' ? 'text-mint-500' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">
                  {t.pdfSplitActionSeparate}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  {t.pdfSplitActionSeparateDesc}
                </span>
              </div>
            </button>
          </div>

          {/* Page Range Input (only needed / active for extraction mode) */}
          {pdfSplitAction === 'single_pdf' && (
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  {t.pdfSplitRangeLabel}
                </label>
                <span className="text-[11px] font-mono font-bold text-mint-500 bg-mint-500/10 px-2 py-0.5 rounded-md">
                  {selectedPdfPages.length} / {activePdfTotalPages}{' '}
                  {language === 'en' ? 'pages' : 'pages'}
                </span>
              </div>

              <input
                type="text"
                value={pdfPageRangeInput}
                onChange={(e) => setPdfPageRangeInput(e.target.value)}
                placeholder={t.pdfSplitRangePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-mint-500/30"
              />

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t.pdfSplitRangeHelp}
              </p>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-mint-500 shrink-0" />
            <span>{t.pdfSafetyNote}</span>
          </div>
        </div>
      )}
    </div>
  );
};
