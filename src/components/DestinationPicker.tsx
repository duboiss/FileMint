import React, { useState } from 'react';
import { useFileMintStore } from '../store/useFileMintStore';
import { open } from '@tauri-apps/plugin-dialog';
import { Folder, Play, AlertCircle, ChevronDown, ChevronUp, Tag, Sparkles } from 'lucide-react';
import { FileItem, ImageTransformOptions, PdfCompressionOptions, PreviewResult } from '../types';

export const formatPreviewName = (
  pattern: string,
  sampleFile: FileItem | undefined,
  imageOptions: ImageTransformOptions,
  pdfOptions: PdfCompressionOptions,
  preview: PreviewResult | null,
  index: number = 1,
  language: string = 'fr'
): string => {
  const isPdf = sampleFile?.fileType === 'pdf';
  const stem = sampleFile ? sampleFile.name.replace(/\.[^/.]+$/, '') : (isPdf ? 'Document-2026' : 'Photo-2026');
  const ext = sampleFile
    ? isPdf
      ? 'pdf'
      : imageOptions.format === 'Original'
      ? (sampleFile.format.toLowerCase() === 'jpeg' ? 'jpg' : sampleFile.format.toLowerCase())
      : imageOptions.format.toLowerCase() === 'jpeg'
      ? 'jpg'
      : imageOptions.format.toLowerCase()
    : isPdf
    ? 'pdf'
    : 'webp';

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const yearStr = String(now.getFullYear());
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const dayStr = String(now.getDate()).padStart(2, '0');

  let res = pattern || '{nom}';

  if (isPdf) {
    // Clean up image-specific placeholders for PDF
    res = res.replace(/_?\{largeur\}x\{hauteur\}/g, '');
    res = res.replace(/_?\{width\}x\{height\}/g, '');
    res = res.replace(/_?\{largeur\}/g, '');
    res = res.replace(/_?\{hauteur\}/g, '');
    res = res.replace(/_?\{width\}/g, '');
    res = res.replace(/_?\{height\}/g, '');
    res = res.replace(/_?q\{qualite\}/g, '');
    res = res.replace(/_?q\{quality\}/g, '');
    res = res.replace(/_?\{qualite\}/g, '');
    res = res.replace(/_?\{quality\}/g, '');
    res = res.replace(/_?\{format\}/g, '');
    res = res.replace(/_?\{ext\}/g, '');

    const profileSlug = pdfOptions.profile === 'Readable'
      ? (language === 'en' ? 'readable' : 'lisible')
      : pdfOptions.profile === 'Balanced'
      ? (language === 'en' ? 'balanced' : 'equilibre')
      : 'compact';

    res = res.split('{profil}').join(profileSlug);
    res = res.split('{profile}').join(profileSlug);
  } else {
    // Clean up PDF-specific placeholders for images
    res = res.replace(/_?\{profil\}/g, '');
    res = res.replace(/_?\{profile\}/g, '');

    const w = preview ? preview.new_width : sampleFile?.width || 1920;
    const h = preview ? preview.new_height : sampleFile?.height || 1080;
    const q = imageOptions.quality || 80;

    res = res.split('{largeur}').join(String(w));
    res = res.split('{width}').join(String(w));
    res = res.split('{w}').join(String(w));
    res = res.split('{hauteur}').join(String(h));
    res = res.split('{height}').join(String(h));
    res = res.split('{h}').join(String(h));
    res = res.split('{qualite}').join(String(q));
    res = res.split('{qualité}').join(String(q));
    res = res.split('{quality}').join(String(q));
    res = res.split('{q}').join(String(q));
  }

  const index_2 = String(index).padStart(2, '0');
  const index_3 = String(index).padStart(3, '0');

  const replacements: [string, string][] = [
    ['{nom}', stem],
    ['{name}', stem],
    ['{index3}', index_3],
    ['{compteur3}', index_3],
    ['{index}', index_2],
    ['{compteur}', index_2],
    ['{count}', index_2],
    ['{i}', String(index)],
    ['{date}', dateStr],
    ['{annee}', yearStr],
    ['{année}', yearStr],
    ['{year}', yearStr],
    ['{mois}', monthStr],
    ['{month}', monthStr],
    ['{jour}', dayStr],
    ['{day}', dayStr],
    ['{format}', ext],
    ['{ext}', ext],
  ];

  for (const [key, val] of replacements) {
    res = res.split(key).join(val);
  }

  // Sanitize forbidden filename characters and clean adjacent separators
  res = res.replace(/[/\\:*?"<>|]/g, '_');
  res = res.replace(/__+/g, '_').replace(/--+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '').trim();
  if (!res) res = stem;

  return `${res}.${ext}`;
};

export const DestinationPicker: React.FC = () => {
  const {
    destinationConfig,
    setDestinationConfig,
    startBatch,
    files,
    activePreviewIndex,
    imageOptions,
    pdfOptions,
    preview,
    language,
    t,
  } = useFileMintStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmOverwriteModal, setConfirmOverwriteModal] = useState(false);

  const currentPattern = destinationConfig.naming_pattern || '{nom}';
  const subfolderName = destinationConfig.subfolder_name || 'FileMint';

  const handlePatternChange = (newPattern: string) => {
    setDestinationConfig({ naming_pattern: newPattern });
  };

  const handleInsertTag = (tag: string) => {
    handlePatternChange(currentPattern + tag);
  };

  const handleLaunch = () => {
    if (
      destinationConfig.mode === 'SameAsOriginal' &&
      !destinationConfig.custom_suffix &&
      !destinationConfig.naming_pattern &&
      !destinationConfig.overwrite_existing
    ) {
      setConfirmOverwriteModal(true);
      return;
    }
    startBatch();
  };

  const sampleFile = files[activePreviewIndex] || files[0];
  const isAllPdf = files.length > 0 && files.every((f) => f.fileType === 'pdf');
  const isAllImages = files.length > 0 && files.every((f) => f.fileType === 'image');
  const isPdfContext = sampleFile ? sampleFile.fileType === 'pdf' : isAllPdf;
  const isSingleFile = files.length <= 1;

  const previewGeneratedName = formatPreviewName(
    currentPattern,
    sampleFile,
    imageOptions,
    pdfOptions,
    preview,
    1,
    language
  );

  const handleSelectCustomFolder = async () => {
    try {
      const selected = await open({
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

  const getModeString = () => {
    if (destinationConfig.mode === 'FileMintSubfolder') return 'FileMintSubfolder';
    if (destinationConfig.mode === 'SameAsOriginal') return 'SameAsOriginal';
    return 'Custom';
  };

  // Context-aware presets
  const quickPresets = isPdfContext
    ? [
        { label: '{nom}', pattern: '{nom}' },
        { label: '{nom}_{profil}', pattern: '{nom}_{profil}' },
        { label: '{nom}_opt', pattern: '{nom}_opt' },
        ...(isSingleFile
          ? [{ label: '{date}_{nom}', pattern: '{date}_{nom}' }]
          : [{ label: '{date}_{nom}_{index}', pattern: '{date}_{nom}_{index}' }]
        ),
      ]
    : [
        { label: '{nom}', pattern: '{nom}' },
        { label: '{nom}_{largeur}x{hauteur}', pattern: '{nom}_{largeur}x{hauteur}' },
        { label: '{nom}_q{qualite}', pattern: '{nom}_q{qualite}' },
        ...(isSingleFile
          ? [{ label: '{date}_{nom}', pattern: '{date}_{nom}' }]
          : [{ label: '{date}_{nom}_{index}', pattern: '{date}_{nom}_{index}' }]
        ),
      ];

  // Context-aware clickable tags
  const tagsToDisplay = isPdfContext
    ? [
        { tag: '{nom}', label: t.tagOriginalName },
        { tag: '{profil}', label: t.tagPdfProfile },
        { tag: '{date}', label: t.tagDate },
        ...(!isSingleFile ? [{ tag: '{index}', label: t.tagIndex }] : []),
      ]
    : !isAllImages && !isAllPdf
    ? [
        { tag: '{nom}', label: t.tagOriginalName },
        { tag: '{largeur}', label: t.tagWidth },
        { tag: '{hauteur}', label: t.tagHeight },
        { tag: '{qualite}', label: t.tagQuality },
        { tag: '{profil}', label: t.tagPdfProfile },
        { tag: '{date}', label: t.tagDate },
        { tag: '{format}', label: t.tagFormat },
        ...(!isSingleFile ? [{ tag: '{index}', label: t.tagIndex }] : []),
      ]
    : [
        { tag: '{nom}', label: t.tagOriginalName },
        { tag: '{largeur}', label: t.tagWidth },
        { tag: '{hauteur}', label: t.tagHeight },
        { tag: '{qualite}', label: t.tagQuality },
        { tag: '{date}', label: t.tagDate },
        { tag: '{format}', label: t.tagFormat },
        ...(!isSingleFile ? [{ tag: '{index}', label: t.tagIndex }] : []),
      ];

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-4 px-6 flex flex-col gap-3 select-none backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
            <Folder className="w-4 h-4 text-mint-500" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>{t.destinationFolder} :</span>
              <span className="font-mono text-mint-600 dark:text-mint-400">
                {destinationConfig.mode === 'FileMintSubfolder' && `./${subfolderName}/ (${t.modeSubfolder})`}
                {destinationConfig.mode === 'SameAsOriginal' && t.modeSame}
                {typeof destinationConfig.mode === 'object' && `${t.modeCustom} : ${destinationConfig.mode.Custom}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{destinationConfig.mode === 'FileMintSubfolder' ? t.modeSubfolderDesc : t.modeSameDesc}</span>
              {currentPattern !== '{nom}' && (
                <span className="font-mono text-[10px] text-mint-600 dark:text-mint-400 bg-mint-500/10 px-1.5 py-0.2 rounded">
                  {currentPattern}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <span>{t.destinationAndNaming}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleLaunch}
            disabled={files.length === 0}
            className="px-6 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-600 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-mint-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{t.launchBatch} ({files.length})</span>
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4 text-xs mt-1">
          {/* Destination Folder */}
          <div className="space-y-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
              {t.destinationFolder}
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => setDestinationConfig({ mode: 'FileMintSubfolder' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  getModeString() === 'FileMintSubfolder'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm ring-1 ring-mint-500/20'
                    : 'border-transparent bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-medium text-xs">{t.modeSubfolder}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  ./{subfolderName}/
                </div>
              </button>

              <button
                onClick={() => setDestinationConfig({ mode: 'SameAsOriginal' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  getModeString() === 'SameAsOriginal'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm ring-1 ring-mint-500/20'
                    : 'border-transparent bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-medium text-xs">{t.modeSame}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{t.modeSameDesc}</div>
              </button>

              <button
                onClick={handleSelectCustomFolder}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  getModeString() === 'Custom'
                    ? 'border-mint-500 bg-white dark:bg-slate-900 font-semibold text-mint-600 dark:text-mint-400 shadow-sm ring-1 ring-mint-500/20'
                    : 'border-transparent bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-medium text-xs">{t.modeCustom}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {typeof destinationConfig.mode === 'object' ? destinationConfig.mode.Custom : t.chooseCustom}
                </div>
              </button>
            </div>

            {/* Inline Subfolder Name Customizer */}
            {getModeString() === 'FileMintSubfolder' && (
              <div className="flex items-center gap-2 pt-1 px-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                  {t.subfolderNameLabel} :
                </span>
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={destinationConfig.subfolder_name || 'FileMint'}
                    onChange={(e) => setDestinationConfig({ subfolder_name: e.target.value })}
                    placeholder={t.subfolderNamePlaceholder}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-mint-500"
                  />
                </div>
                <span className="text-[10px] font-mono text-mint-600 dark:text-mint-400">
                  (./{subfolderName}/)
                </span>
              </div>
            )}
          </div>

          {/* Batch renaming pattern with masks */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-mint-500" />
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                  {t.namingPatternTitle}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {t.namingPatternDesc}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={currentPattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  placeholder={isPdfContext ? t.namingPatternPdfPlaceholder : t.namingPatternPlaceholder}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-mint-500"
                />
              </div>

              {/* Quick preset chips */}
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {quickPresets.map((p) => (
                  <button
                    key={p.pattern}
                    type="button"
                    onClick={() => handlePatternChange(p.pattern)}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                      currentPattern === p.pattern
                        ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clickable tags to append */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 mr-1">{t.namingVariablesLabel}</span>
              {tagsToDisplay.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertTag(item.tag)}
                  className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 hover:bg-mint-500/15 hover:text-mint-600 dark:hover:text-mint-400 text-slate-600 dark:text-slate-300 text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1"
                  title={`Insérer ${item.tag} (${item.label})`}
                >
                  <span className="text-mint-500 font-bold">+</span>
                  <span>{item.tag}</span>
                </button>
              ))}
            </div>

            {/* Live generated preview */}
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                <span>{t.namingPatternPreview}</span>
              </span>
              <span className="font-mono text-mint-600 dark:text-mint-400 font-bold truncate max-w-sm">
                {previewGeneratedName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite confirmation modal */}
      {confirmOverwriteModal && (
        <div
          onClick={() => setConfirmOverwriteModal(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4 cursor-default"
          >
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
              {t.overwriteModalTitle}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.overwriteModalWarning}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOverwriteModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  setDestinationConfig({ overwrite_existing: true });
                  setConfirmOverwriteModal(false);
                  startBatch();
                }}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
