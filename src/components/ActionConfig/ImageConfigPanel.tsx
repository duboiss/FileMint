import React, { useState, useEffect } from 'react';
import { useFileMintStore, formatResizeSummary } from '../../store/useFileMintStore';
import { OutputFormat, ImageConfigTab } from '../../types';
import {
  Sliders,
  Maximize2,
  RefreshCw,
  AlertTriangle,
  Check,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Palette,
  Undo,
  Sparkles,
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  X,
  MapPin,
  MapPinOff,
  Shield,
  Camera,
  Target,
} from 'lucide-react';

export const ImageConfigPanel: React.FC = () => {
  const {
    imageOptions,
    setImageOptions,
    setRotation,
    rotateClockwise,
    toggleFlipHorizontal,
    toggleFlipVertical,
    toggleGrayscale,
    resetManipulations,
    customProfiles,
    activeCustomProfileId,
    saveCustomProfile,
    applyCustomProfile,
    deleteCustomProfile,
    renameCustomProfile,
    updateCustomProfileOptions,
    restoreDefaultProfiles,
    defaultImageTab,
    files,
    activePreviewIndex,
    preview,
    t,
    language,
  } = useFileMintStore();

  const [activeTab, setActiveTab] = useState<ImageConfigTab>(defaultImageTab);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [updatedFeedbackId, setUpdatedFeedbackId] = useState<string | null>(null);
  const [imageTargetUnit, setImageTargetUnit] = useState<'kb' | 'mb'>('kb');

  useEffect(() => {
    setActiveTab(defaultImageTab);
  }, [defaultImageTab]);

  const activeFile = files[activePreviewIndex];

  // Helper to extract active resize mode
  const resizeType = Object.keys(imageOptions.resize_mode)[0] || 'None';

  const hasActiveManipulations =
    (imageOptions.rotation || 0) !== 0 ||
    imageOptions.flip_horizontal ||
    imageOptions.flip_vertical ||
    imageOptions.grayscale;

  const handleSaveNewProfile = () => {
    const success = saveCustomProfile(newProfileName);
    if (success) {
      setIsCreatingProfile(false);
      setNewProfileName('');
    }
  };

  const handleSaveRename = (id: string) => {
    if (editingProfileName.trim()) {
      renameCustomProfile(id, editingProfileName);
    }
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleUpdateProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = updateCustomProfileOptions(id);
    if (success) {
      setUpdatedFeedbackId(id);
      setTimeout(() => {
        setUpdatedFeedbackId((curr) => (curr === id ? null : curr));
      }, 1500);
    }
  };

  const renderProfileSummary = (options: typeof imageOptions) => {
    const formatLabel = options.format === 'Original' ? t.keepOriginal : options.format;
    const resizeLabel = formatResizeSummary(options);
    const qualityLabel = options.compress === false ? t.noCompression : `Q${options.quality}`;

    const exceptionParts: string[] = [];
    if ((options.rotation || 0) % 360 !== 0) {
      exceptionParts.push(`${(options.rotation || 0) % 360}°`);
    }
    if (options.flip_horizontal || options.flip_vertical) {
      exceptionParts.push(t.mirrorSummary);
    }
    if (options.grayscale) {
      exceptionParts.push(t.bwSummary);
    }
    if (options.metadata_policy === 'RemoveGps') {
      exceptionParts.push(t.noGpsSummary);
    } else if (options.metadata_policy === 'RemoveAll') {
      exceptionParts.push(t.noExifSummary);
    }

    return (
      <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] leading-tight min-w-0">
        <span className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold tracking-wider uppercase shrink-0">
          {formatLabel}
        </span>

        <span className="text-slate-500 dark:text-slate-400 truncate">
          {resizeLabel} • {qualityLabel}
        </span>

        {exceptionParts.length > 0 && (
          <span
            className="px-1.5 py-0.5 rounded bg-mint-500/10 text-mint-600 dark:text-mint-400 font-sans font-medium shrink-0"
            title={exceptionParts.join(', ')}
          >
            {exceptionParts.join(' · ')}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/40 px-4 pt-4 pb-5 overflow-y-auto select-none">
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/50 dark:bg-slate-800/60 rounded-2xl mb-5 text-[11px] font-semibold border border-slate-300/40 dark:border-slate-700/50 shadow-inner">
        {(
          [
            { id: 'presets', label: t.tabPresets },
            { id: 'manipulate', label: t.tabManipulate, hasBadge: hasActiveManipulations },
            { id: 'resize', label: t.tabResize },
            { id: 'compress', label: t.tabCompress },
            { id: 'convert', label: t.tabConvert },
          ] as Array<{ id: ImageConfigTab; label: string; hasBadge?: boolean }>
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ImageConfigTab)}
              className={`flex-auto py-2 px-2 rounded-xl transition-all relative flex items-center justify-center cursor-pointer select-none ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-mint-600 dark:text-mint-400 font-bold shadow-sm shadow-slate-900/10 dark:shadow-black/40 border border-slate-200/90 dark:border-slate-700/90 ring-1 ring-mint-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/40 font-medium'
              }`}
            >
              <span className="tracking-tight whitespace-nowrap">{tab.label}</span>
              {tab.hasBadge && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-mint-500 animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between h-7 min-h-[28px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Bookmark className="w-3.5 h-3.5 text-mint-500 shrink-0" />
              <span>{t.tabPresets}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {customProfiles.length}/20
              </span>
            </div>

            <div className="flex items-center gap-1">
              {customProfiles.length < 20 && !isCreatingProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProfile(true);
                    setNewProfileName('');
                  }}
                  className="text-xs text-mint-600 dark:text-mint-400 hover:text-mint-500 font-semibold flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-mint-500/10 transition-colors cursor-pointer"
                  title={t.saveCurrentAsProfile}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.createProfile}</span>
                </button>
              )}

              <button
                type="button"
                onClick={restoreDefaultProfiles}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={t.restoreDefaultProfiles}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isCreatingProfile && (
            <div className="p-3.5 rounded-2xl border border-mint-500/50 bg-mint-500/5 dark:bg-mint-500/10 space-y-2.5 animate-fadeIn">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>{t.saveCurrentAsProfile}</span>
                <span className="text-[10px] font-mono text-slate-400">{customProfiles.length}/20</span>
              </div>

              <input
                type="text"
                autoFocus
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNewProfile();
                  if (e.key === 'Escape') {
                    setIsCreatingProfile(false);
                    setNewProfileName('');
                  }
                }}
                placeholder={t.profileNamePlaceholder}
                maxLength={40}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-mint-500 focus:ring-1 focus:ring-mint-500"
              />

              <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                {renderProfileSummary(imageOptions)}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProfile(false);
                    setNewProfileName('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewProfile}
                  disabled={!newProfileName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-mint-500 hover:bg-mint-600 disabled:opacity-50 text-slate-950 transition-all shadow-sm cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </div>
          )}

          {customProfiles.length === 0 && !isCreatingProfile && (
            <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 space-y-3">
              <p className="text-xs font-medium">{t.noCustomProfiles}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                {t.noCustomProfilesDesc}
              </p>
              <button
                type="button"
                onClick={restoreDefaultProfiles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-mint-500/15 text-mint-600 dark:text-mint-400 text-xs font-semibold hover:bg-mint-500/25 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.restoreDefaultProfiles}</span>
              </button>
            </div>
          )}

          {customProfiles.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {customProfiles.map((profile) => {
                const isActive = activeCustomProfileId === profile.id;
                const isEditing = editingProfileId === profile.id;

                return (
                  <div
                    key={profile.id}
                    onClick={() => {
                      if (!isEditing) applyCustomProfile(profile.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
                      isActive
                        ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingProfileName}
                            onChange={(e) => setEditingProfileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(profile.id);
                              if (e.key === 'Escape') setEditingProfileId(null);
                            }}
                            className="px-2 py-1 text-xs rounded-lg border border-mint-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none w-full"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(profile.id)}
                            className="p-1 rounded-md bg-mint-500 text-slate-950 hover:bg-mint-600 cursor-pointer"
                            title={t.save}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProfileId(null)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title={t.cancel}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <span className="truncate">{profile.name}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-mint-500 shrink-0" />
                            )}
                            {updatedFeedbackId === profile.id && (
                              <span className="text-[10px] text-mint-600 dark:text-mint-400 font-normal animate-fadeIn">
                                • {t.profileUpdated}
                              </span>
                            )}
                          </div>
                          {renderProfileSummary(profile.options)}
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isActive && <Check className="w-4 h-4 text-mint-500 shrink-0 mr-1" />}

                        <button
                          type="button"
                          onClick={(e) => handleUpdateProfile(profile.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-mint-500 hover:bg-mint-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          title={t.updateProfileWithCurrent}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProfileId(profile.id);
                            setEditingProfileName(profile.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          title={t.renameProfile}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomProfile(profile.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          title={t.deleteProfile}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manipulate' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between h-7 min-h-[28px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-mint-500 shrink-0" />
              <span className="whitespace-nowrap">{t.manipulationTitle}</span>
            </div>
            {hasActiveManipulations && (
              <button
                type="button"
                onClick={resetManipulations}
                className="text-[11px] text-slate-400 hover:text-mint-500 dark:hover:text-mint-400 flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-2 font-medium whitespace-nowrap"
                title={t.resetManipulations}
              >
                <Undo className="w-3 h-3 shrink-0" />
                <span>{t.reset}</span>
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.rotationTitle}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 font-mono text-slate-500 dark:text-slate-300">
                {(imageOptions.rotation || 0) % 360}°
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { angle: 0, label: t.rotate0 },
                { angle: 90, label: t.rotate90 },
                { angle: 180, label: t.rotate180 },
                { angle: 270, label: t.rotate270 },
              ].map(({ angle, label }) => {
                const isActive = ((imageOptions.rotation || 0) % 360) === angle;
                return (
                  <button
                    key={angle}
                    type="button"
                    onClick={() => setRotation(angle)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'border-mint-500 bg-mint-500/10 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <RotateCw
                      className="w-4 h-4 transition-transform duration-300"
                      style={{ transform: `rotate(${angle}deg)` }}
                    />
                    <span className="text-[10px] truncate max-w-full">{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={rotateClockwise}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-mint-500 hover:bg-mint-500/5 text-slate-700 dark:text-slate-300 hover:text-mint-600 dark:hover:text-mint-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t.rotateCwQuick} (+90°)</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <FlipHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.flipTitle}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleFlipHorizontal}
                className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  imageOptions.flip_horizontal
                    ? 'border-mint-500 bg-mint-500/10 text-mint-600 dark:text-mint-400 font-semibold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={t.flipHorizontal}
              >
                <FlipHorizontal className="w-4 h-4 shrink-0" />
                <span className="text-xs whitespace-nowrap">{t.flipHorizontalLabel}</span>
                {imageOptions.flip_horizontal && (
                  <Check className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleFlipVertical}
                className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  imageOptions.flip_vertical
                    ? 'border-mint-500 bg-mint-500/10 text-mint-600 dark:text-mint-400 font-semibold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={t.flipVertical}
              >
                <FlipVertical className="w-4 h-4 shrink-0" />
                <span className="text-xs whitespace-nowrap">{t.flipVerticalLabel}</span>
                {imageOptions.flip_vertical && (
                  <Check className="w-3.5 h-3.5 text-mint-500 shrink-0" />
                )}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Palette className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.colorEffectsTitle}</span>
            </div>

            <button
              type="button"
              onClick={toggleGrayscale}
              className={`p-3 rounded-xl border w-full text-left flex items-center justify-between transition-all cursor-pointer ${
                imageOptions.grayscale
                  ? 'border-mint-500 bg-mint-500/10 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`p-2 rounded-lg ${imageOptions.grayscale ? 'bg-mint-500/20 text-mint-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  <Palette className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <span className="text-xs font-semibold block">{t.grayscale}</span>
                  <span className="text-[11px] text-slate-400 font-normal leading-tight block mt-0.5">{t.grayscaleDesc}</span>
                </div>
              </div>
              {imageOptions.grayscale && <Check className="w-4 h-4 text-mint-500 shrink-0 ml-2" />}
            </button>
          </div>

          {hasActiveManipulations && (
            <button
              type="button"
              onClick={resetManipulations}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 hover:bg-amber-500/5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>{t.resetManipulations}</span>
            </button>
          )}
        </div>
      )}

      {activeTab === 'resize' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between h-7 min-h-[28px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Maximize2 className="w-3.5 h-3.5 text-mint-500 shrink-0" />
              <span>{t.resizeMode}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setImageOptions({ resize_mode: { None: null } })}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                resizeType === 'None'
                  ? 'border-mint-500 bg-mint-500/10 font-bold text-mint-600 dark:text-mint-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40'
              }`}
            >
              {t.resizeNone}
            </button>
            <button
              onClick={() =>
                setImageOptions({
                  resize_mode: { Percentage: { percent: 50 } },
                })
              }
              className={`p-2.5 rounded-xl border text-center transition-all ${
                resizeType === 'Percentage'
                  ? 'border-mint-500 bg-mint-500/10 font-bold text-mint-600 dark:text-mint-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40'
              }`}
            >
              {t.resizePercentage}
            </button>
            <button
              onClick={() =>
                setImageOptions({
                  resize_mode: { MaxBounds: { max_width: 1920, max_height: 1080 } },
                })
              }
              className={`p-2.5 rounded-xl border text-center transition-all ${
                resizeType === 'MaxBounds'
                  ? 'border-mint-500 bg-mint-500/10 font-bold text-mint-600 dark:text-mint-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40'
              }`}
            >
              {t.resizeMaxBounds}
            </button>
            <button
              onClick={() =>
                setImageOptions({
                  resize_mode: {
                    Exact: {
                      width: activeFile?.width || 1200,
                      height: activeFile?.height || 800,
                    },
                  },
                })
              }
              className={`p-2.5 rounded-xl border text-center transition-all ${
                resizeType === 'Exact'
                  ? 'border-mint-500 bg-mint-500/10 font-bold text-mint-600 dark:text-mint-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40'
              }`}
            >
              {t.resizeExact}
            </button>
          </div>

          {resizeType === 'Percentage' && (
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">{t.targetPercentage}</span>
                <span className="font-mono font-bold text-mint-500">
                  {imageOptions.resize_mode.Percentage?.percent || 50}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={imageOptions.resize_mode.Percentage?.percent || 50}
                onChange={(e) =>
                  setImageOptions({
                    resize_mode: { Percentage: { percent: Number(e.target.value) } },
                  })
                }
                className="w-full accent-mint-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                {[10, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() =>
                      setImageOptions({
                        resize_mode: { Percentage: { percent: pct } },
                      })
                    }
                    className={`hover:text-mint-500 transition-colors cursor-pointer ${
                      (imageOptions.resize_mode.Percentage?.percent || 50) === pct
                        ? 'text-mint-500 font-bold'
                        : ''
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {resizeType === 'MaxBounds' && (
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs text-slate-500 block">{t.maxDimensions}</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">{t.maxWidth}</label>
                  <input
                    type="number"
                    min="1"
                    value={imageOptions.resize_mode.MaxBounds?.max_width || 1920}
                    onChange={(e) =>
                      setImageOptions({
                        resize_mode: {
                          MaxBounds: {
                            max_width: Number(e.target.value),
                            max_height: imageOptions.resize_mode.MaxBounds?.max_height || 1080,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">{t.maxHeight}</label>
                  <input
                    type="number"
                    min="1"
                    value={imageOptions.resize_mode.MaxBounds?.max_height || 1080}
                    onChange={(e) =>
                      setImageOptions({
                        resize_mode: {
                          MaxBounds: {
                            max_width: imageOptions.resize_mode.MaxBounds?.max_width || 1920,
                            max_height: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {resizeType === 'Exact' && (
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs text-slate-500 block">{t.exactDimensions}</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">{t.width}</label>
                  <input
                    type="number"
                    min="1"
                    value={imageOptions.resize_mode.Exact?.width || 0}
                    onChange={(e) =>
                      setImageOptions({
                        resize_mode: {
                          Exact: {
                            width: Number(e.target.value),
                            height: imageOptions.resize_mode.Exact?.height || 0,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">{t.height}</label>
                  <input
                    type="number"
                    min="1"
                    value={imageOptions.resize_mode.Exact?.height || 0}
                    onChange={(e) =>
                      setImageOptions({
                        resize_mode: {
                          Exact: {
                            width: imageOptions.resize_mode.Exact?.width || 0,
                            height: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={imageOptions.maintain_aspect_ratio}
                onChange={(e) => setImageOptions({ maintain_aspect_ratio: e.target.checked })}
                className="rounded text-mint-500 accent-mint-500"
              />
              <span>{t.maintainAspect}</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={imageOptions.do_not_upscale}
                onChange={(e) => setImageOptions({ do_not_upscale: e.target.checked })}
                className="rounded text-mint-500 accent-mint-500"
              />
              <span>{t.doNotUpscale}</span>
            </label>
          </div>
        </div>
      )}

      {activeTab === 'compress' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between h-7 min-h-[28px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Sliders className="w-3.5 h-3.5 text-mint-500 shrink-0" />
              <span>{t.compressionLevel}</span>
            </div>
          </div>

          {/* Main compression toggle */}
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 pr-1">
              <div
                className={`p-2 rounded-xl shrink-0 transition-colors ${
                  imageOptions.compress !== false
                    ? 'bg-mint-500/15 text-mint-600 dark:text-mint-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>{t.enableCompression}</span>
                  {imageOptions.compress === false && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                      {t.noCompressionBadge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {imageOptions.compress !== false ? t.enableCompressionDesc : t.noCompressionDesc}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={imageOptions.compress !== false}
              onClick={() =>
                setImageOptions({ compress: imageOptions.compress === false ? true : false })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-2 ${
                imageOptions.compress !== false ? 'bg-mint-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  imageOptions.compress !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {imageOptions.compress === false ? (
            <div className="p-4 rounded-2xl bg-mint-500/10 border border-mint-500/30 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-mint-600 dark:text-mint-400">
                <Check className="w-4 h-4 shrink-0" />
                <span>{t.noCompressionTitle}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.noCompressionNotice}
              </p>
              <button
                type="button"
                onClick={() => setImageOptions({ compress: true })}
                className="text-xs text-mint-600 dark:text-mint-400 hover:text-mint-500 font-semibold underline underline-offset-2 cursor-pointer pt-0.5 block"
              >
                {t.enableCompression}
              </button>
            </div>
          ) : (
            <>
              {/* Mode switch: Manual quality vs Target size */}
              <div className="grid grid-cols-2 p-1 bg-slate-200/50 dark:bg-slate-800/60 rounded-2xl border border-slate-300/40 dark:border-slate-700/50 text-[11px] font-semibold shadow-inner">
                <button
                  type="button"
                  onClick={() => setImageOptions({ target_size_kb: null, compress: true })}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !imageOptions.target_size_kb
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-mint-500" />
                  <span>{t.compressionModeQuality}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImageOptions({
                      target_size_kb: imageOptions.target_size_kb || 500,
                      compress: true,
                    })
                  }
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    Boolean(imageOptions.target_size_kb)
                      ? 'bg-white dark:bg-slate-900 text-mint-600 dark:text-mint-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-mint-500" />
                  <span>{t.compressionModeTargetSize}</span>
                </button>
              </div>

              {/* Target Size mode card */}
              {Boolean(imageOptions.target_size_kb) ? (
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-mint-500" />
                      <span>{t.targetSizeTitle}</span>
                    </span>
                    <span className="font-mono font-bold text-mint-500 text-sm bg-mint-500/10 px-2.5 py-0.5 rounded-lg border border-mint-500/20">
                      ≤ {(imageOptions.target_size_kb || 500) >= 1024
                        ? `${((imageOptions.target_size_kb || 500) / 1024).toFixed(
                            (imageOptions.target_size_kb || 500) % 1024 === 0 ? 0 : 1
                          )} ${language === 'en' ? 'MB' : 'Mo'}`
                        : `${imageOptions.target_size_kb || 500} ${language === 'en' ? 'KB' : 'Ko'}`}
                    </span>
                  </div>

                  {/* Quick pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {t.targetSizeQuickPills}
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: language === 'en' ? '200 KB' : '200 Ko', kb: 200 },
                        { label: language === 'en' ? '500 KB' : '500 Ko', kb: 500 },
                        { label: language === 'en' ? '1 MB' : '1 Mo', kb: 1024 },
                        { label: language === 'en' ? '2 MB' : '2 Mo', kb: 2048 },
                        { label: language === 'en' ? '5 MB' : '5 Mo', kb: 5120 },
                      ].map((item) => {
                        const isSelected = imageOptions.target_size_kb === item.kb;
                        return (
                          <button
                            key={item.kb}
                            type="button"
                            onClick={() => setImageOptions({ target_size_kb: item.kb, compress: true })}
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
                        min="20"
                        max="50000"
                        step={imageTargetUnit === 'mb' ? '0.1' : '50'}
                        value={
                          imageTargetUnit === 'mb'
                            ? Number(((imageOptions.target_size_kb || 500) / 1024).toFixed(2))
                            : imageOptions.target_size_kb || 500
                        }
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          const kb = imageTargetUnit === 'mb' ? Math.round(val * 1024) : Math.round(val);
                          setImageOptions({ target_size_kb: kb, compress: true });
                        }}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/30"
                      />
                      <div className="flex items-center p-0.5 bg-slate-200/50 dark:bg-slate-800/60 rounded-xl border border-slate-300/40 dark:border-slate-700/50 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setImageTargetUnit('kb')}
                          className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                            imageTargetUnit === 'kb'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                          }`}
                        >
                          {language === 'en' ? 'KB' : 'Ko'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageTargetUnit('mb')}
                          className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                            imageTargetUnit === 'mb'
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
                    {t.targetSizeDesc}
                  </div>
                </div>
              ) : (
                /* Manual Quality mode card */
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-slate-500">{t.encodingQuality}</span>
                    <span className="font-mono font-bold text-mint-500 text-sm bg-mint-500/10 px-2.5 py-0.5 rounded-lg border border-mint-500/20">
                      {imageOptions.quality} / 100
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setImageOptions({ quality: 50, compress: true })}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        imageOptions.quality <= 55
                          ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-xs font-semibold">{t.qualityLight}</span>
                      <span className="text-[10px] opacity-70 font-mono">50</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageOptions({ quality: 75, compress: true })}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        imageOptions.quality > 55 && imageOptions.quality < 90
                          ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-xs font-semibold">{t.qualityBalanced}</span>
                      <span className="text-[10px] opacity-70 font-mono">75</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageOptions({ quality: 100, compress: true })}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        imageOptions.quality >= 90
                          ? 'border-mint-500 bg-mint-500/15 text-mint-600 dark:text-mint-400 font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-xs font-semibold">{t.qualityMax}</span>
                      <span className="text-[10px] opacity-70 font-mono">100</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={imageOptions.quality}
                      onChange={(e) =>
                        setImageOptions({ quality: Number(e.target.value), compress: true })
                      }
                      className="w-full accent-mint-500 cursor-pointer"
                    />
                    <div className="relative h-4 text-[10px] text-slate-400 font-mono">
                      <button
                        type="button"
                        onClick={() => setImageOptions({ quality: 10, compress: true })}
                        className="absolute left-0 hover:text-mint-500 transition-colors cursor-pointer"
                        title="Qualité minimum (10)"
                      >
                        10
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageOptions({ quality: 50, compress: true })}
                        className={`absolute left-[44.4%] -translate-x-1/2 hover:text-mint-500 transition-colors cursor-pointer ${
                          imageOptions.quality === 50 ? 'text-mint-500 font-bold' : ''
                        }`}
                        title="Qualité 50 (Léger)"
                      >
                        50
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageOptions({ quality: 75, compress: true })}
                        className={`absolute left-[72.2%] -translate-x-1/2 hover:text-mint-500 transition-colors cursor-pointer font-medium ${
                          imageOptions.quality === 75 ? 'text-mint-500 font-bold' : ''
                        }`}
                        title="Qualité 75 (Équilibré)"
                      >
                        75
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageOptions({ quality: 100, compress: true })}
                        className="absolute right-0 hover:text-mint-500 transition-colors cursor-pointer"
                        title="Qualité maximum (100)"
                      >
                        100
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-800/30">
                <input
                  type="checkbox"
                  checked={imageOptions.lossless}
                  onChange={(e) => setImageOptions({ lossless: e.target.checked })}
                  className="rounded text-mint-500 accent-mint-500"
                />
                <div>
                  <span className="font-medium block">{t.lossless}</span>
                  <span className="text-[11px] text-slate-400">{t.losslessDesc}</span>
                </div>
              </label>
            </>
          )}

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Shield className="w-3.5 h-3.5 text-mint-500" />
                <span>{t.metadataPrivacyTitle}</span>
              </div>
              {activeFile?.hasGps && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>📍</span>
                  <span>{t.gpsDetectedBadge}</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.metadataPrivacyDesc}
            </p>

            {activeFile?.hasGps && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-200">
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-medium">{t.gpsDetectedNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setImageOptions({ metadata_policy: 'RemoveGps' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  imageOptions.metadata_policy === 'RemoveGps'
                    ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <MapPinOff className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                      {t.metadataRemoveGps}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-mint-500/20 text-mint-600 dark:text-mint-400">
                      {t.recommended}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                    {t.metadataRemoveGpsDesc}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImageOptions({ metadata_policy: 'RemoveAll' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  imageOptions.metadata_policy === 'RemoveAll'
                    ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 block">
                    {t.metadataRemoveAll}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                    {t.metadataRemoveAllDesc}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImageOptions({ metadata_policy: 'KeepAll' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  imageOptions.metadata_policy === 'KeepAll'
                    ? 'border-mint-500 bg-mint-500/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-mint-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Camera className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 block">
                    {t.metadataKeepAll}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                    {t.metadataKeepAllDesc}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'convert' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between h-7 min-h-[28px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 text-mint-500 shrink-0" />
              <span>{t.outputFormatTitle}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {(['Original', 'Webp', 'Avif', 'Jpeg', 'Png'] as OutputFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setImageOptions({ format: fmt })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  imageOptions.format === fmt
                    ? 'border-mint-500 bg-mint-500/10 font-bold text-mint-600 dark:text-mint-400'
                    : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>{fmt === 'Original' ? t.keepOriginal : fmt}</span>
                  {fmt === 'Avif' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold uppercase">
                      AV1
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {fmt === 'Webp' && t.webpDesc}
                  {fmt === 'Avif' && t.avifDesc}
                  {fmt === 'Jpeg' && t.jpegDesc}
                  {fmt === 'Png' && t.pngDesc}
                  {fmt === 'Original' && t.keepOriginalDesc}
                </div>
              </button>
            ))}
          </div>

          {/* Warn user if converting alpha-transparent PNG to JPEG */}
          {preview?.transparency_loss_warning && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">{t.transparencyWarning}</span>
                <span>
                  {t.transparencyWarningDesc}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
