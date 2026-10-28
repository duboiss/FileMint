import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  FileItem,
  ColorFilter,
  ImageConfigTab,
  ImageTransformOptions,
  CustomProfile,
  PdfCompressionOptions,
  PdfPreviewResponse,
  DestinationConfig,
  PreviewResult,
  ProgressEventPayload,
  BatchSummary,
  UpdateInfo,
  ContextMenuMode,
  ContextMenuStatus,
  ThemeMode,
  WatchFolderConfig,
  WatchFolderRule,
  WatchProcessedEvent,
  AppConfig,
  AppToast,
  PdfToolMode,
  PdfSplitAction,
} from '../types';
import {
  Language,
  TranslationDictionary,
  translations,
  getSystemLanguage,
} from '../i18n/translations';

import packageJson from '../../package.json';
import {
  renderPdfPage1,
  parsePageRange,
  formatPageRange,
  base64ToUint8Array,
} from '../utils/pdfPreviewRenderer';

export const APP_VERSION = packageJson.version;

export const formatFileSize = (bytes: number, language: string = 'fr'): string => {
  const isFr = language === 'fr';
  if (!bytes || bytes <= 0) {
    return isFr ? '0 octet' : '0 B';
  }
  if (bytes < 1024) {
    return isFr ? `${bytes} ${bytes > 1 ? 'octets' : 'octet'}` : `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} ${isFr ? 'Ko' : 'KB'}`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} ${isFr ? 'Mo' : 'MB'}`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${isFr ? 'Go' : 'GB'}`;
};

export const isTauriEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { ipc?: unknown };
    __TAURI_IPC__?: unknown;
  };
  return typeof w.__TAURI_INTERNALS__?.ipc === 'function' || typeof w.__TAURI_IPC__ === 'function';
};

export const getPresetOptions = (
  preset: 'none' | 'web' | 'quality' | 'light' | string
): ImageTransformOptions => {
  if (preset === 'none' || preset === 'preset_none') {
    return {
      resize_mode: { None: null },
      maintain_aspect_ratio: true,
      do_not_upscale: true,
      format: 'Original',
      quality: 100,
      lossless: true,
      rotation: 0,
      flip_horizontal: false,
      flip_vertical: false,
      grayscale: false,
      color_filter: 'none',
      metadata_policy: 'KeepAll',
      compress: false,
    };
  } else if (preset === 'quality' || preset === 'preset_quality') {
    return {
      resize_mode: { None: null },
      maintain_aspect_ratio: true,
      do_not_upscale: true,
      format: 'Original',
      quality: 92,
      lossless: false,
      rotation: 0,
      flip_horizontal: false,
      flip_vertical: false,
      grayscale: false,
      color_filter: 'none',
      metadata_policy: 'RemoveGps',
      compress: true,
    };
  } else if (preset === 'light' || preset === 'preset_light') {
    return {
      resize_mode: { Percentage: { percent: 75 } },
      maintain_aspect_ratio: true,
      do_not_upscale: true,
      format: 'Webp',
      quality: 60,
      lossless: false,
      rotation: 0,
      flip_horizontal: false,
      flip_vertical: false,
      grayscale: false,
      color_filter: 'none',
      metadata_policy: 'RemoveAll',
      compress: true,
    };
  } else {
    return {
      resize_mode: { MaxBounds: { max_width: 1920, max_height: 1080 } },
      maintain_aspect_ratio: true,
      do_not_upscale: true,
      format: 'Webp',
      quality: 75,
      lossless: false,
      rotation: 0,
      flip_horizontal: false,
      flip_vertical: false,
      grayscale: false,
      color_filter: 'none',
      metadata_policy: 'RemoveAll',
      compress: true,
    };
  }
};

export const getDefaultProfiles = (dict?: TranslationDictionary): CustomProfile[] => [
  {
    id: 'preset_none',
    name: dict?.presetNone || 'Aucun',
    options: getPresetOptions('none'),
    createdAt: 0,
  },
  {
    id: 'preset_web',
    name: dict?.presetWeb || 'Web',
    options: getPresetOptions('web'),
    createdAt: 1,
  },
  {
    id: 'preset_quality',
    name: dict?.presetQuality || 'Qualité',
    options: getPresetOptions('quality'),
    createdAt: 2,
  },
  {
    id: 'preset_light',
    name: dict?.presetLight || 'Léger',
    options: getPresetOptions('light'),
    createdAt: 3,
  },
];

export const hasActiveImageChanges = (options: ImageTransformOptions): boolean => {
  const isResizeActive = Object.keys(options.resize_mode)[0] !== 'None';
  const isFormatActive = options.format !== 'Original';
  const isCompressionActive = options.compress !== false;
  const isManipulationsActive =
    (options.rotation || 0) % 360 !== 0 ||
    Boolean(options.flip_horizontal) ||
    Boolean(options.flip_vertical) ||
    Boolean(options.grayscale) ||
    Boolean(options.color_filter && options.color_filter !== 'none');
  const isMetadataActive = options.metadata_policy !== 'KeepAll';
  const isTargetSizeActive = Boolean(
    options.target_size_kb && options.target_size_kb > 0 && options.compress !== false
  );

  return (
    isResizeActive ||
    isFormatActive ||
    isCompressionActive ||
    isManipulationsActive ||
    isMetadataActive ||
    isTargetSizeActive
  );
};

export const formatResizeSummary = (options: ImageTransformOptions): string => {
  if (options.resize_mode.Percentage?.percent) {
    return `${options.resize_mode.Percentage.percent}%`;
  }
  if (options.resize_mode.MaxBounds) {
    return `Max ${options.resize_mode.MaxBounds.max_width}×${options.resize_mode.MaxBounds.max_height}`;
  }
  if (options.resize_mode.Exact) {
    return `${options.resize_mode.Exact.width || 'auto'}×${options.resize_mode.Exact.height || 'auto'}`;
  }
  return '100%';
};

export const createProfilesExportJson = (profiles: CustomProfile[]): string => {
  const payload = {
    version: 1,
    app: 'FileMint',
    exportedAt: new Date().toISOString(),
    profiles,
  };
  return JSON.stringify(payload, null, 2);
};

export const validateAndSanitizeProfiles = (data: unknown): CustomProfile[] | null => {
  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).profiles)) {
    list = (data as Record<string, unknown>).profiles as unknown[];
  } else {
    return null;
  }

  const validProfiles: CustomProfile[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') continue;
    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 50)
        : `Profil ${i + 1}`;
    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `profile_${Date.now()}_${i}`;
    const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now();

    const rawOpt = (item.options || {}) as Record<string, unknown>;
    const sanitizedOptions: ImageTransformOptions = {
      resize_mode:
        rawOpt.resize_mode && typeof rawOpt.resize_mode === 'object'
          ? (rawOpt.resize_mode as ImageTransformOptions['resize_mode'])
          : { None: null },
      maintain_aspect_ratio: rawOpt.maintain_aspect_ratio !== false,
      do_not_upscale: rawOpt.do_not_upscale !== false,
      format: ['Original', 'Jpeg', 'Png', 'Webp', 'Avif'].includes(rawOpt.format as string)
        ? (rawOpt.format as ImageTransformOptions['format'])
        : 'Webp',
      quality:
        typeof rawOpt.quality === 'number' && rawOpt.quality >= 1 && rawOpt.quality <= 100
          ? Math.round(rawOpt.quality)
          : 80,
      lossless: Boolean(rawOpt.lossless),
      rotation:
        typeof rawOpt.rotation === 'number'
          ? ((Math.round(rawOpt.rotation) % 360) + 360) % 360
          : 0,
      flip_horizontal: Boolean(rawOpt.flip_horizontal),
      flip_vertical: Boolean(rawOpt.flip_vertical),
      grayscale: Boolean(rawOpt.grayscale),
      color_filter:
        rawOpt.color_filter && ['none', 'grayscale', 'sepia', 'invert', 'binarize'].includes(rawOpt.color_filter as string)
          ? (rawOpt.color_filter as ColorFilter)
          : rawOpt.grayscale
          ? 'grayscale'
          : 'none',
      metadata_policy: ['KeepAll', 'RemoveGps', 'RemoveAll'].includes(
        rawOpt.metadata_policy as string
      )
        ? (rawOpt.metadata_policy as ImageTransformOptions['metadata_policy'])
        : 'RemoveGps',
      compress: rawOpt.compress !== false,
    };

    const nonNoneCount = validProfiles.filter((p) => p.id !== 'preset_none').length;
    if (id !== 'preset_none' && nonNoneCount >= MAX_CUSTOM_PROFILES) continue;

    validProfiles.push({
      id,
      name,
      options: sanitizedOptions,
      createdAt,
    });
  }

  return validProfiles.length > 0 ? validProfiles : null;
};

const getInitialTab = (): ImageConfigTab => {
  try {
    return (localStorage.getItem('filemint_default_tab') as ImageConfigTab) || 'presets';
  } catch {
    return 'presets';
  }
};

const getInitialPresetId = (profiles: CustomProfile[]): string => {
  try {
    const migrated = localStorage.getItem('filemint_default_preset_v2');
    if (!migrated) {
      localStorage.setItem('filemint_default_preset_v2', 'true');
      const saved = localStorage.getItem('filemint_default_preset');
      if (!saved || saved === 'web' || saved === 'preset_web') {
        localStorage.setItem('filemint_default_preset', 'preset_none');
        return 'preset_none';
      }
    }

    const saved = localStorage.getItem('filemint_default_preset');
    if (saved) {
      // Map legacy names if present
      const mapped =
        saved === 'none'
          ? 'preset_none'
          : saved === 'web'
          ? 'preset_web'
          : saved === 'quality'
          ? 'preset_quality'
          : saved === 'light'
          ? 'preset_light'
          : saved;
      if (profiles.some((p) => p.id === mapped)) {
        return mapped;
      }
    }
  } catch {}
  return profiles.find((p) => p.id === 'preset_none')?.id || profiles[0]?.id || 'preset_none';
};

const getInitialContextMenuMode = (): ContextMenuMode => {
  try {
    const saved = localStorage.getItem('filemint_context_menu_mode') as ContextMenuMode;
    if (saved === 'disabled' || saved === 'classic' || saved === 'modern') {
      return saved;
    }
  } catch {}
  return 'modern';
};

const getInitialNamingPattern = (): string => {
  try {
    return localStorage.getItem('filemint_naming_pattern') || '{nom}';
  } catch {
    return '{nom}';
  }
};

const getInitialSubfolderName = (): string => {
  try {
    return localStorage.getItem('filemint_subfolder_name') || 'FileMint';
  } catch {
    return 'FileMint';
  }
};

const getInitialDestMode = (): DestinationConfig['mode'] => {
  try {
    const stored = localStorage.getItem('filemint_default_dest_mode');
    if (stored === 'SameAsOriginal') return 'SameAsOriginal';
    if (stored === 'Custom') {
      const customPath = localStorage.getItem('filemint_custom_folder');
      if (customPath) return { Custom: customPath };
    }
    return 'FileMintSubfolder';
  } catch {
    return 'FileMintSubfolder';
  }
};

export const getSystemTheme = (): 'dark' | 'light' => {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
};

export const applyThemeToDom = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'system' ? getSystemTheme() === 'dark' : theme === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const getInitialTheme = (): ThemeMode => {
  try {
    const saved = localStorage.getItem('filemint_theme');
    if (saved === 'system' || saved === 'light' || saved === 'dark') {
      return saved as ThemeMode;
    }
  } catch {
    // Fallback if storage access is restricted
  }
  return 'system';
};

const getInitialUpdateCheckEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem('filemint_update_check');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {}
  return true;
};

const getInitialLanguageData = (): { language: Language; showWelcome: boolean } => {
  try {
    const saved = localStorage.getItem('filemint_language');
    if (saved === 'fr' || saved === 'en') {
      return { language: saved as Language, showWelcome: false };
    }
  } catch {
    // Fallback if storage access is restricted
  }
  return { language: getSystemLanguage(), showWelcome: true };
};

const CUSTOM_PROFILES_STORAGE_KEY = 'filemint_custom_presets';
export const MAX_CUSTOM_PROFILES = 20;

const LIFETIME_SAVED_BYTES_KEY = 'filemint_lifetime_bytes_saved';
const LIFETIME_FILES_COUNT_KEY = 'filemint_lifetime_files_count';

const getInitialLifetimeSavedBytes = (): number => {
  try {
    const raw = localStorage.getItem(LIFETIME_SAVED_BYTES_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
};

const getInitialLifetimeFilesCount = (): number => {
  try {
    const raw = localStorage.getItem(LIFETIME_FILES_COUNT_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
};

const saveLifetimeStatsToStorage = (bytesSaved: number, filesCount: number) => {
  try {
    localStorage.setItem(LIFETIME_SAVED_BYTES_KEY, String(Math.max(0, bytesSaved)));
    localStorage.setItem(LIFETIME_FILES_COUNT_KEY, String(Math.max(0, filesCount)));
  } catch {}
};

const WATCH_FOLDERS_STORAGE_KEY = 'filemint_watch_folders';
const LEGACY_WATCH_FOLDER_KEY = 'filemint_watch_folder_config';

export const validateAndSanitizeWatchFolders = (data: unknown): WatchFolderRule[] => {
  if (!Array.isArray(data)) return [];
  const sanitized: WatchFolderRule[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id.trim()) continue;
    if (typeof obj.watch_path !== 'string') continue;

    sanitized.push({
      id: obj.id.trim(),
      name: typeof obj.name === 'string' ? obj.name.trim() : '',
      enabled: Boolean(obj.enabled),
      watch_path: obj.watch_path.trim(),
      output_path: typeof obj.output_path === 'string' && obj.output_path.trim() ? obj.output_path.trim() : null,
      delete_source: Boolean(obj.delete_source),
      profile_id: typeof obj.profile_id === 'string' && obj.profile_id.trim() ? obj.profile_id.trim() : null,
      image_options: obj.image_options && typeof obj.image_options === 'object' ? (obj.image_options as any) : null,
      pdf_options: obj.pdf_options && typeof obj.pdf_options === 'object' ? (obj.pdf_options as any) : null,
    });
  }
  return sanitized;
};

const getInitialWatchFolders = (): WatchFolderRule[] => {
  try {
    const raw = localStorage.getItem(WATCH_FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = validateAndSanitizeWatchFolders(parsed);
      if (validated.length > 0) {
        return validated;
      }
    }
    // Check legacy single watch folder configuration
    const legacyRaw = localStorage.getItem(LEGACY_WATCH_FOLDER_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && (legacy.watch_path || legacy.enabled)) {
        const migrated: WatchFolderRule = {
          id: 'watch_default',
          name: '',
          enabled: Boolean(legacy.enabled),
          watch_path: legacy.watch_path || '',
          output_path: legacy.output_path || null,
          delete_source: Boolean(legacy.delete_source),
          profile_id: legacy.profile_id || null,
          image_options: legacy.image_options || null,
          pdf_options: legacy.pdf_options || null,
        };
        saveWatchFoldersToStorage([migrated]);
        return [migrated];
      }
    }
  } catch {}
  return [];
};

const saveWatchFoldersToStorage = (folders: WatchFolderRule[]) => {
  try {
    localStorage.setItem(WATCH_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch {}
};

const getInitialWatchFolderConfig = (rules: WatchFolderRule[]): WatchFolderConfig => {
  const first = rules[0];
  if (first) {
    return {
      rules,
      enabled: first.enabled,
      watch_path: first.watch_path,
      output_path: first.output_path,
      delete_source: first.delete_source,
      profile_id: first.profile_id,
      image_options: first.image_options,
      pdf_options: first.pdf_options,
    };
  }
  return {
    rules: [],
    enabled: false,
    watch_path: '',
    output_path: null,
    delete_source: false,
  };
};

const loadCustomProfilesFromStorage = (dict?: TranslationDictionary): CustomProfile[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = validateAndSanitizeProfiles(parsed);
      if (validated && validated.length > 0) {
        // Ensure preset_none is available
        const hasNone = validated.some((p: CustomProfile) => p.id === 'preset_none');
        const noneProfile: CustomProfile = hasNone
          ? validated.find((p: CustomProfile) => p.id === 'preset_none')!
          : {
              id: 'preset_none',
              name: dict?.presetNone || 'Aucun',
              options: getPresetOptions('none'),
              createdAt: 0,
            };
        const nonNone = validated
          .filter((p: CustomProfile) => p.id !== 'preset_none')
          .slice(0, MAX_CUSTOM_PROFILES);
        const merged = [noneProfile, ...nonNone];
        saveCustomProfilesToStorage(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Error loading custom profiles from storage:', err);
  }
  const defaults = getDefaultProfiles(dict);
  saveCustomProfilesToStorage(defaults);
  return defaults;
};

const saveCustomProfilesToStorage = (profiles: CustomProfile[]) => {
  try {
    const noneItem = profiles.find((p) => p.id === 'preset_none');
    const nonNone = profiles.filter((p) => p.id !== 'preset_none').slice(0, MAX_CUSTOM_PROFILES);
    const toSave = noneItem ? [noneItem, ...nonNone] : nonNone;
    localStorage.setItem(CUSTOM_PROFILES_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn('Error saving custom profiles to storage:', err);
  }
};

const generateLocalBrowserPreview = (
  activeFile: FileItem,
  imageOptions: ImageTransformOptions
): PreviewResult => {
  const isRotated = (imageOptions.rotation || 0) % 180 !== 0;
  const rawW = activeFile.width || 1920;
  const rawH = activeFile.height || 1080;
  const origW = isRotated ? rawH : rawW;
  const origH = isRotated ? rawW : rawH;

  let targetW = origW;
  let targetH = origH;

  if (imageOptions.resize_mode.Percentage?.percent) {
    const p = imageOptions.resize_mode.Percentage.percent / 100;
    targetW = Math.max(1, Math.round(origW * p));
    targetH = Math.max(1, Math.round(origH * p));
  } else if (imageOptions.resize_mode.MaxBounds) {
    const maxW = imageOptions.resize_mode.MaxBounds.max_width;
    const maxH = imageOptions.resize_mode.MaxBounds.max_height;
    const factorW = maxW / origW;
    const factorH = maxH / origH;
    const factor = Math.min(factorW, factorH);
    if (!imageOptions.do_not_upscale || factor < 1.0) {
      targetW = Math.max(1, Math.round(origW * factor));
      targetH = Math.max(1, Math.round(origH * factor));
    }
  } else if (imageOptions.resize_mode.Exact) {
    targetW = Math.max(1, imageOptions.resize_mode.Exact.width || origW);
    targetH = Math.max(1, imageOptions.resize_mode.Exact.height || origH);
  }

  const activeColorFilter =
    imageOptions.color_filter || (imageOptions.grayscale ? 'grayscale' : 'none');

  const areaRatio = (targetW * targetH) / (origW * origH);
  const isCompressionDisabled = imageOptions.compress === false;

  let estimatedBytes: number;
  let savedPercentage: number;

  if (imageOptions.target_size_kb && imageOptions.target_size_kb > 0 && !isCompressionDisabled) {
    const targetBytes = imageOptions.target_size_kb * 1024;
    estimatedBytes = Math.min(activeFile.sizeBytes, targetBytes);
    savedPercentage = activeFile.sizeBytes > 0
      ? Math.max(0, Math.round(((activeFile.sizeBytes - estimatedBytes) / activeFile.sizeBytes) * 100))
      : 0;
  } else if (isCompressionDisabled) {
    const isFormatOriginal = imageOptions.format === 'Original';
    const formatCompressionFactor = isFormatOriginal
      ? 1.0
      : imageOptions.format === 'Avif'
      ? 0.58
      : imageOptions.format === 'Webp'
      ? 0.70
      : imageOptions.format === 'Png'
      ? 0.90
      : 0.80;

    estimatedBytes = Math.max(
      1024,
      Math.round(activeFile.sizeBytes * areaRatio * formatCompressionFactor)
    );
    savedPercentage =
      activeFile.sizeBytes > 0 && activeFile.sizeBytes > estimatedBytes
        ? Math.max(0, Math.round(((activeFile.sizeBytes - estimatedBytes) / activeFile.sizeBytes) * 100))
        : 0;
  } else {
    const qualityFactor = Math.max(0.1, imageOptions.quality / 100);
    const formatCompressionFactor =
      imageOptions.format === 'Avif'
        ? 0.48
        : imageOptions.format === 'Webp'
        ? 0.65
        : imageOptions.format === 'Png'
        ? imageOptions.lossless
          ? 0.85
          : 0.95
        : 0.75;

    estimatedBytes = Math.max(
      1024,
      Math.round(activeFile.sizeBytes * areaRatio * qualityFactor * formatCompressionFactor)
    );
    savedPercentage = Math.max(
      0,
      Math.round(((activeFile.sizeBytes - estimatedBytes) / activeFile.sizeBytes) * 100)
    );
  }
  const isJpegWithAlpha = imageOptions.format === 'Jpeg' && activeFile.format === 'PNG';

  const isLogo = activeFile.name.toLowerCase().includes('logo');
  const bgFill = isJpegWithAlpha ? '#ffffff' : '#0f172a';

  let filterStyle = '';
  if (activeColorFilter === 'grayscale') {
    filterStyle = 'filter: grayscale(100%);';
  } else if (activeColorFilter === 'sepia') {
    filterStyle = 'filter: sepia(100%);';
  } else if (activeColorFilter === 'invert') {
    filterStyle = 'filter: invert(100%);';
  } else if (activeColorFilter === 'binarize') {
    filterStyle = 'filter: grayscale(100%) contrast(5000%);';
  }

  const transformStyle = `transform-origin: center; ${
    imageOptions.flip_horizontal ? 'scaleX(-1) ' : ''
  }${imageOptions.flip_vertical ? 'scaleY(-1) ' : ''}${
    imageOptions.rotation ? `rotate(${imageOptions.rotation}deg)` : ''
  }`;

  let graphicContent = '';
  if (isLogo) {
    graphicContent = `
      <rect width="100%" height="100%" fill="${bgFill}"/>
      ${
        !isJpegWithAlpha
          ? `
      <pattern id="checkers" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#1e293b"/>
        <rect x="10" width="10" height="10" fill="#0f172a"/>
        <rect y="10" width="10" height="10" fill="#0f172a"/>
        <rect x="10" y="10" width="10" height="10" fill="#1e293b"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#checkers)" opacity="0.6"/>
      `
          : ''
      }
      <g style="${filterStyle} ${transformStyle}">
        <g transform="translate(144, 40) scale(0.65)">
          <rect x="32" y="32" width="448" height="448" rx="104" fill="#22c55e"/>
          <path d="M168 112 H304 L376 184 V384 C376 397.25 365.25 408 352 408 H168 C154.75 408 144 397.25 144 384 V136 C144 122.75 154.75 112 168 112 Z" fill="#ffffff" opacity="0.95"/>
          <path d="M304 112 V184 H376 Z" fill="#dcfce7"/>
          <path d="M216 268 L248 300 L320 220" stroke="#16a34a" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </g>
      </g>
    `;
  } else {
    graphicContent = `
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="60%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#bae6fd"/>
        </linearGradient>
        <linearGradient id="mntGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <g style="${filterStyle} ${transformStyle}">
        <rect width="100%" height="100%" fill="url(#skyGrad)"/>
        <circle cx="620" cy="120" r="45" fill="#fef08a" opacity="0.9"/>
        <polygon points="100,500 360,180 620,500" fill="url(#mntGrad)"/>
        <polygon points="360,180 430,270 380,260 360,275 340,260 290,270" fill="#ffffff" opacity="0.95"/>
        <polygon points="400,500 580,250 760,500" fill="#1e293b"/>
        <polygon points="580,250 630,320 595,310 580,325 565,310 530,320" fill="#ffffff" opacity="0.95"/>
        <polygon points="0,500 200,310 400,500" fill="#475569"/>
      </g>
    `;
  }

  const filterBadge =
    activeColorFilter === 'grayscale'
      ? ' • N&B'
      : activeColorFilter === 'sepia'
      ? ' • Sépia'
      : activeColorFilter === 'invert'
      ? ' • Négatif'
      : activeColorFilter === 'binarize'
      ? ' • N&B Pur'
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    ${graphicContent}
    <rect x="20" y="20" width="300" height="42" rx="12" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.1)"/>
    <text x="35" y="47" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="600">${targetW} × ${targetH} px • ${
    imageOptions.format === 'Original' ? activeFile.format : imageOptions.format
  }${filterBadge}${imageOptions.rotation ? ` • ${imageOptions.rotation}°` : ''}</text>
  </svg>`;

  const origSvgGraphic = isLogo
    ? `<rect width="100%" height="100%" fill="#0f172a"/>
      <pattern id="origCheckers" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#1e293b"/>
        <rect x="10" width="10" height="10" fill="#0f172a"/>
        <rect y="10" width="10" height="10" fill="#0f172a"/>
        <rect x="10" y="10" width="10" height="10" fill="#1e293b"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#origCheckers)" opacity="0.6"/>
      <g>
        <g transform="translate(144, 40) scale(0.65)">
          <rect x="32" y="32" width="448" height="448" rx="104" fill="#22c55e"/>
          <path d="M168 112 H304 L376 184 V384 C376 397.25 365.25 408 352 408 H168 C154.75 408 144 397.25 144 384 V136 C144 122.75 154.75 112 168 112 Z" fill="#ffffff" opacity="0.95"/>
          <path d="M304 112 V184 H376 Z" fill="#dcfce7"/>
          <path d="M216 268 L248 300 L320 220" stroke="#16a34a" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </g>
      </g>`
    : `<defs>
        <linearGradient id="origSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="60%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#bae6fd"/>
        </linearGradient>
        <linearGradient id="origMntGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <g>
        <rect width="100%" height="100%" fill="url(#origSkyGrad)"/>
        <circle cx="620" cy="120" r="45" fill="#fef08a" opacity="0.9"/>
        <polygon points="100,500 360,180 620,500" fill="url(#origMntGrad)"/>
        <polygon points="360,180 430,270 380,260 360,275 340,260 290,270" fill="#ffffff" opacity="0.95"/>
        <polygon points="400,500 580,250 760,500" fill="#1e293b"/>
        <polygon points="580,250 630,320 595,310 580,325 565,310 530,320" fill="#ffffff" opacity="0.95"/>
        <polygon points="0,500 200,310 400,500" fill="#475569"/>
      </g>`;

  const origSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    ${origSvgGraphic}
    <rect x="20" y="20" width="220" height="42" rx="12" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.1)"/>
    <text x="35" y="47" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="600">${origW} × ${origH} px • Original</text>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const originalDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(origSvg)}`;

  return {
    data_url: dataUrl,
    original_data_url: originalDataUrl,
    original_width: origW,
    original_height: origH,
    new_width: targetW,
    new_height: targetH,
    original_bytes: activeFile.sizeBytes,
    estimated_bytes: estimatedBytes,
    saved_percentage: savedPercentage,
    transparency_loss_warning: isJpegWithAlpha,
  };
};

interface FileMintState {
  screen: 'home' | 'config' | 'results';
  files: FileItem[];
  activePreviewIndex: number;
  preview: PreviewResult | null;
  previewLoading: boolean;

  defaultImageTab: ImageConfigTab;
  defaultImagePreset: string;

  imageOptions: ImageTransformOptions;
  selectedImagePreset: string;
  customProfiles: CustomProfile[];
  activeCustomProfileId: string | null;

  pdfOptions: PdfCompressionOptions;
  destinationConfig: DestinationConfig;

  batchRunning: boolean;
  batchProgress: ProgressEventPayload | null;
  batchSummary: BatchSummary | null;

  lifetimeSavedBytes: number;
  lifetimeFilesCount: number;
  recordBatchCompletion: (summary: BatchSummary) => void;
  resetLifetimeStats: () => void;

  watchFolders: WatchFolderRule[];
  watchFolderConfig: WatchFolderConfig;
  lastWatchEvent: WatchProcessedEvent | null;
  watchToastVisible: boolean;
  setWatchFolders: (rules: WatchFolderRule[]) => Promise<void>;
  addWatchFolder: (rule?: Partial<WatchFolderRule>) => Promise<string>;
  updateWatchFolder: (id: string, update: Partial<WatchFolderRule>) => Promise<void>;
  removeWatchFolder: (id: string) => Promise<void>;
  toggleWatchFolder: (id: string, enabled?: boolean) => Promise<void>;
  setWatchFolderConfig: (config: Partial<WatchFolderConfig>) => Promise<void>;
  recordWatchProcessed: (event: WatchProcessedEvent) => void;
  dismissWatchToast: () => void;

  appToast: AppToast | null;
  showAppToast: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
  dismissAppToast: () => void;

  language: Language;
  showWelcomeModal: boolean;
  t: TranslationDictionary;

  settingsOpen: boolean;
  updateCheckEnabled: boolean;
  updateInfo: UpdateInfo | null;
  updateDownloading: boolean;
  updateDownloaded: boolean;
  updateInstalling: boolean;
  updateProgress: number;
  updateError: string | null;
  contextMenuEnabled: boolean;
  contextMenuMode: ContextMenuMode;
  contextMenuLoading: boolean;
  theme: ThemeMode;

  setLanguage: (lang: Language) => void;
  setWelcomeModalOpen: (open: boolean) => void;
  setScreen: (screen: 'home' | 'config' | 'results') => void;
  setSettingsOpen: (open: boolean) => void;
  setUpdateCheckEnabled: (enabled: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setDefaultImageTab: (tab: ImageConfigTab) => void;
  setDefaultImagePreset: (presetId: string) => void;
  setContextMenuMode: (mode: ContextMenuMode) => Promise<void>;
  addFiles: (paths: string[]) => Promise<void>;
  addDemoFiles: () => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  setActivePreviewIndex: (index: number) => void;
  setImageOptions: (options: Partial<ImageTransformOptions>) => void;
  setRotation: (rotation: number) => void;
  rotateClockwise: () => void;
  toggleFlipHorizontal: () => void;
  toggleFlipVertical: () => void;
  toggleGrayscale: () => void;
  setColorFilter: (filter: ColorFilter) => void;
  resetManipulations: () => void;
  applyImagePreset: (presetId: string) => void;
  saveCustomProfile: (name: string) => boolean;
  applyCustomProfile: (id: string) => void;
  deleteCustomProfile: (id: string) => void;
  renameCustomProfile: (id: string, newName: string) => boolean;
  updateCustomProfileOptions: (id: string) => boolean;
  restoreDefaultProfiles: () => void;
  importCustomProfiles: (profiles: CustomProfile[]) => boolean;
  setPdfOptions: (options: Partial<PdfCompressionOptions>) => void;
  pdfToolMode: PdfToolMode;
  pdfMergeOrder: string[];
  pdfMergeOutputName: string;
  pdfSplitAction: PdfSplitAction;
  selectedPdfPages: number[];
  pdfPageRangeInput: string;
  activePdfTotalPages: number;
  setPdfToolMode: (mode: PdfToolMode) => void;
  setPdfMergeOrder: (order: string[]) => void;
  reorderPdfMerge: (fromIdx: number, toIdx: number) => void;
  setPdfMergeOutputName: (name: string) => void;
  setPdfSplitAction: (action: PdfSplitAction) => void;
  setSelectedPdfPages: (pages: number[]) => void;
  togglePdfPageSelection: (pageNum: number) => void;
  selectAllPdfPages: () => void;
  deselectAllPdfPages: () => void;
  invertPdfPageSelection: () => void;
  setPdfPageRangeInput: (input: string) => void;
  setActivePdfTotalPages: (total: number) => void;
  executePdfMerge: () => Promise<boolean>;
  executePdfSplit: () => Promise<boolean>;
  setDestinationConfig: (config: Partial<DestinationConfig>) => void;
  refreshPreview: () => Promise<void>;
  startBatch: () => Promise<void>;
  cancelBatch: () => Promise<void>;
  resetToHome: () => void;
  checkUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installAndRestart: () => Promise<void>;
  toggleContextMenu: (enable: boolean, mode?: ContextMenuMode) => Promise<void>;
  initSettings: () => Promise<void>;
}

let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequestId = 0;
let watchToastTimer: ReturnType<typeof setTimeout> | null = null;
let appToastTimer: ReturnType<typeof setTimeout> | null = null;

const syncWatchFoldersToBackend = async (
  rules: WatchFolderRule[],
  store: {
    defaultImagePreset: string;
    customProfiles: CustomProfile[];
    imageOptions: ImageTransformOptions;
    pdfOptions: PdfCompressionOptions;
  }
) => {
  if (!isTauriEnv()) return;
  const resolved = rules.map((r) => {
    const profileId = r.profile_id || store.defaultImagePreset;
    const profile =
      store.customProfiles.find((p) => p.id === profileId) ||
      store.customProfiles[0];
    const imageOptions =
      r.image_options || (profile ? profile.options : store.imageOptions);
    return {
      ...r,
      image_options: imageOptions,
      pdf_options: store.pdfOptions,
    };
  });
  try {
    await invoke('set_watch_folder_rules', { rules: resolved });
  } catch (err) {
    console.error('Erreur synchronisation dossiers surveillés :', err);
  }
};

let saveConfigTimer: ReturnType<typeof setTimeout> | null = null;
export const persistConfigToDisk = () => {
  if (!isTauriEnv()) return;
  if (saveConfigTimer) clearTimeout(saveConfigTimer);
  saveConfigTimer = setTimeout(() => {
    try {
      const state = useFileMintStore.getState();
      let defaultDestModeStr = 'subfolder';
      if (typeof state.destinationConfig.mode === 'string') {
        if (state.destinationConfig.mode === 'SameAsOriginal') {
          defaultDestModeStr = 'original';
        } else {
          defaultDestModeStr = 'subfolder';
        }
      } else if (
        state.destinationConfig.mode &&
        typeof state.destinationConfig.mode === 'object' &&
        'Custom' in state.destinationConfig.mode
      ) {
        defaultDestModeStr = 'custom';
      }

      const config: AppConfig = {
        language: state.language,
        theme: state.theme,
        context_menu_mode: state.contextMenuMode,
        naming_pattern: state.destinationConfig.naming_pattern || '{nom}',
        subfolder_name: state.destinationConfig.subfolder_name || 'FileMint',
        default_dest_mode: defaultDestModeStr,
        custom_folder: localStorage.getItem('filemint_custom_folder') || null,
        default_tab: state.defaultImageTab,
        default_preset: state.defaultImagePreset,
        update_check: state.updateCheckEnabled,
        lifetime_saved_bytes: state.lifetimeSavedBytes,
        lifetime_files_count: state.lifetimeFilesCount,
        custom_profiles: state.customProfiles,
        watch_folders: state.watchFolders,
      };
      invoke('save_app_config', { config }).catch((err) => {
        console.warn('Failed to persist config to disk:', err);
      });
    } catch (e) {
      console.warn('Failed to prepare config for disk persistence:', e);
    }
  }, 300);
};

export const resolveDestinationDir = (
  firstFilePath: string,
  destConfig: DestinationConfig
): string => {
  if (typeof destConfig.mode === 'object' && 'Custom' in destConfig.mode) {
    return destConfig.mode.Custom;
  }
  const lastSlash = Math.max(firstFilePath.lastIndexOf('/'), firstFilePath.lastIndexOf('\\'));
  const parentDir = lastSlash >= 0 ? firstFilePath.substring(0, lastSlash) : '.';
  if (destConfig.mode === 'SameAsOriginal') {
    return parentDir;
  }
  const subfolderName = localStorage.getItem('filemint_subfolder_name') || 'FileMint';
  const sep = firstFilePath.includes('\\') ? '\\' : '/';
  return `${parentDir}${sep}${subfolderName}`;
};

export const useFileMintStore = create<FileMintState>((set, get) => {
  const initialLangData = getInitialLanguageData();
  const initialProfiles = loadCustomProfilesFromStorage(translations[initialLangData.language]);
  const initialPresetId = getInitialPresetId(initialProfiles);
  const initialActiveProfile = initialProfiles.find((p) => p.id === initialPresetId) || initialProfiles[0];
  const initialTab = getInitialTab();
  const initialTheme = getInitialTheme();
  applyThemeToDom(initialTheme);
  const initialWatchFolders = getInitialWatchFolders();

  return {
    screen: 'home',
    files: [],
    activePreviewIndex: 0,
    preview: null,
    previewLoading: false,

    language: initialLangData.language,
    showWelcomeModal: initialLangData.showWelcome,
    t: translations[initialLangData.language],

    defaultImageTab: initialTab,
    defaultImagePreset: initialPresetId,
    selectedImagePreset: initialActiveProfile?.id || 'preset_none',
    imageOptions: initialActiveProfile
      ? structuredClone(initialActiveProfile.options)
      : getPresetOptions('none'),
    customProfiles: initialProfiles,
    activeCustomProfileId: initialActiveProfile?.id || null,

    pdfOptions: {
      profile: 'Balanced',
      optimize_structure: true,
      recompress_images: true,
    },

    pdfToolMode: 'compress',
    pdfMergeOrder: [],
    pdfMergeOutputName: '{nom}_fusion.pdf',
    pdfSplitAction: 'single_pdf',
    selectedPdfPages: [],
    pdfPageRangeInput: '',
    activePdfTotalPages: 1,

    setPdfToolMode: (mode: PdfToolMode) => {
      set({ pdfToolMode: mode });
    },

    setPdfMergeOrder: (order: string[]) => {
      set({ pdfMergeOrder: order });
    },

    reorderPdfMerge: (fromIdx: number, toIdx: number) => {
      const order = [...get().pdfMergeOrder];
      if (fromIdx < 0 || fromIdx >= order.length || toIdx < 0 || toIdx >= order.length) return;
      const [item] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, item);
      set({ pdfMergeOrder: order });
    },

    setPdfMergeOutputName: (name: string) => {
      set({ pdfMergeOutputName: name });
    },

    setPdfSplitAction: (action: PdfSplitAction) => {
      set({ pdfSplitAction: action });
    },

    setSelectedPdfPages: (pages: number[]) => {
      const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
      set({
        selectedPdfPages: sorted,
        pdfPageRangeInput: formatPageRange(sorted),
      });
    },

    togglePdfPageSelection: (pageNum: number) => {
      const current = get().selectedPdfPages;
      const next = current.includes(pageNum)
        ? current.filter((p) => p !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b);
      set({
        selectedPdfPages: next,
        pdfPageRangeInput: formatPageRange(next),
      });
    },

    selectAllPdfPages: () => {
      const total = get().activePdfTotalPages;
      const all = Array.from({ length: total }, (_, i) => i + 1);
      set({
        selectedPdfPages: all,
        pdfPageRangeInput: formatPageRange(all),
      });
    },

    deselectAllPdfPages: () => {
      set({
        selectedPdfPages: [],
        pdfPageRangeInput: '',
      });
    },

    invertPdfPageSelection: () => {
      const total = get().activePdfTotalPages;
      const currentSet = new Set(get().selectedPdfPages);
      const inverted: number[] = [];
      for (let p = 1; p <= total; p++) {
        if (!currentSet.has(p)) inverted.push(p);
      }
      set({
        selectedPdfPages: inverted,
        pdfPageRangeInput: formatPageRange(inverted),
      });
    },

    setPdfPageRangeInput: (input: string) => {
      const total = get().activePdfTotalPages;
      const parsed = parsePageRange(input, total);
      set({
        pdfPageRangeInput: input,
        selectedPdfPages: parsed,
      });
    },

    setActivePdfTotalPages: (total: number) => {
      set({ activePdfTotalPages: Math.max(1, total) });
    },

    destinationConfig: {
      mode: getInitialDestMode(),
      custom_suffix: null,
      naming_pattern: getInitialNamingPattern(),
      overwrite_existing: false,
      subfolder_name: getInitialSubfolderName(),
    },

    batchRunning: false,
    batchProgress: null,
    batchSummary: null,

    lifetimeSavedBytes: getInitialLifetimeSavedBytes(),
    lifetimeFilesCount: getInitialLifetimeFilesCount(),

    recordBatchCompletion: (summary: BatchSummary) => {
      const addSaved = Math.max(0, summary.total_saved_bytes);
      const addFiles = summary.success_count;
      const nextSaved = get().lifetimeSavedBytes + addSaved;
      const nextFiles = get().lifetimeFilesCount + addFiles;
      saveLifetimeStatsToStorage(nextSaved, nextFiles);
      set({ lifetimeSavedBytes: nextSaved, lifetimeFilesCount: nextFiles });
      persistConfigToDisk();
    },

    resetLifetimeStats: () => {
      saveLifetimeStatsToStorage(0, 0);
      set({ lifetimeSavedBytes: 0, lifetimeFilesCount: 0 });
      persistConfigToDisk();
    },

    watchFolders: initialWatchFolders,
    watchFolderConfig: getInitialWatchFolderConfig(initialWatchFolders),
    lastWatchEvent: null,
    watchToastVisible: false,

    setWatchFolders: async (rules: WatchFolderRule[]) => {
      saveWatchFoldersToStorage(rules);
      set({
        watchFolders: rules,
        watchFolderConfig: getInitialWatchFolderConfig(rules),
      });
      persistConfigToDisk();
      await syncWatchFoldersToBackend(rules, get());
    },

    addWatchFolder: async (rule?: Partial<WatchFolderRule>): Promise<string> => {
      const id = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRule: WatchFolderRule = {
        id,
        name: rule?.name || '',
        enabled: rule?.enabled ?? true,
        watch_path: rule?.watch_path || '',
        output_path: rule?.output_path ?? null,
        delete_source: rule?.delete_source ?? false,
        profile_id: rule?.profile_id ?? null,
      };
      const updated = [...get().watchFolders, newRule];
      await get().setWatchFolders(updated);
      return id;
    },

    updateWatchFolder: async (id: string, update: Partial<WatchFolderRule>) => {
      const updated = get().watchFolders.map((r) => {
        if (r.id !== id) return r;
        return { ...r, ...update };
      });
      await get().setWatchFolders(updated);
    },

    removeWatchFolder: async (id: string) => {
      const updated = get().watchFolders.filter((r) => r.id !== id);
      await get().setWatchFolders(updated);
    },

    toggleWatchFolder: async (id: string, enabled?: boolean) => {
      const updated = get().watchFolders.map((r) => {
        if (r.id !== id) return r;
        const nextEnabled = enabled !== undefined ? enabled : !r.enabled;
        return { ...r, enabled: nextEnabled };
      });
      await get().setWatchFolders(updated);
    },

    setWatchFolderConfig: async (configUpdate: Partial<WatchFolderConfig>) => {
      const currentRules = get().watchFolders;
      if (currentRules.length === 0) {
        await get().addWatchFolder(configUpdate);
      } else {
        await get().updateWatchFolder(currentRules[0].id, configUpdate);
      }
    },

    recordWatchProcessed: (event: WatchProcessedEvent) => {
      const nextSaved = get().lifetimeSavedBytes + Math.max(0, event.saved_bytes);
      const nextFiles = get().lifetimeFilesCount + 1;
      saveLifetimeStatsToStorage(nextSaved, nextFiles);
      set({
        lifetimeSavedBytes: nextSaved,
        lifetimeFilesCount: nextFiles,
        lastWatchEvent: event,
        watchToastVisible: true,
      });

      if (watchToastTimer) {
        clearTimeout(watchToastTimer);
      }
      watchToastTimer = setTimeout(() => {
        set({ watchToastVisible: false });
        watchToastTimer = null;
      }, 5000);
    },

    dismissWatchToast: () => {
      if (watchToastTimer) {
        clearTimeout(watchToastTimer);
        watchToastTimer = null;
      }
      set({ watchToastVisible: false });
    },

    appToast: null,

    showAppToast: (title: string, description?: string, type: 'success' | 'info' | 'error' = 'success') => {
      if (appToastTimer) {
        clearTimeout(appToastTimer);
        appToastTimer = null;
      }
      const id = `toast_${Date.now()}`;
      set({ appToast: { id, title, description, type } });
      appToastTimer = setTimeout(() => {
        set({ appToast: null });
        appToastTimer = null;
      }, 4500);
    },

    dismissAppToast: () => {
      if (appToastTimer) {
        clearTimeout(appToastTimer);
        appToastTimer = null;
      }
      set({ appToast: null });
    },

    settingsOpen: false,
    updateCheckEnabled: getInitialUpdateCheckEnabled(),
    updateInfo: null,
    updateDownloading: false,
    updateDownloaded: false,
    updateInstalling: false,
    updateProgress: 0,
    updateError: null,
    contextMenuEnabled: false,
    contextMenuMode: getInitialContextMenuMode(),
    contextMenuLoading: false,
    theme: initialTheme,

    setLanguage: (lang: Language) => {
      try {
        localStorage.setItem('filemint_language', lang);
      } catch (err) {
        console.warn('Erreur sauvegarde langue :', err);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
      set({ language: lang, t: translations[lang] });
      persistConfigToDisk();
      // Only refresh classic context menu labels if classic mode is currently enabled
      if (get().contextMenuEnabled && get().contextMenuMode === 'classic' && isTauriEnv()) {
        get().toggleContextMenu(true, 'classic');
      }
    },

    setWelcomeModalOpen: (open: boolean) => {
      set({ showWelcomeModal: open });
    },

    setScreen: (screen) => set({ screen }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    setUpdateCheckEnabled: (enabled: boolean) => {
      try {
        localStorage.setItem('filemint_update_check', String(enabled));
      } catch {}
      set({ updateCheckEnabled: enabled });
      persistConfigToDisk();
    },
    setTheme: (theme: ThemeMode) => {
      try {
        localStorage.setItem('filemint_theme', theme);
      } catch (err) {
        console.warn('Erreur sauvegarde thème :', err);
      }
      set({ theme });
      applyThemeToDom(theme);
      persistConfigToDisk();
    },

    setDefaultImageTab: (tab: ImageConfigTab) => {
      set({ defaultImageTab: tab });
      try {
        localStorage.setItem('filemint_default_tab', tab);
      } catch {}
      persistConfigToDisk();
    },

    setDefaultImagePreset: (presetId: string) => {
      set({ defaultImagePreset: presetId });
      const profile = get().customProfiles.find((p) => p.id === presetId);
      if (profile) {
        get().applyCustomProfile(presetId);
      }
      try {
        localStorage.setItem('filemint_default_preset', presetId);
      } catch {}
      persistConfigToDisk();

      // Keep watch folders in sync
      const watchFolders = get().watchFolders;
      if (watchFolders.length > 0 && isTauriEnv()) {
        syncWatchFoldersToBackend(watchFolders, get());
      }
    },

    addFiles: async (paths: string[]) => {
      if (!isTauriEnv()) {
        get().addDemoFiles();
        return;
      }

      try {
        const rawMetadata = await invoke<
          Array<{
            path: string;
            name: string;
            size_bytes: number;
            file_type: 'image' | 'pdf' | 'unknown';
            format: string;
            width?: number;
            height?: number;
            has_gps?: boolean;
            has_exif?: boolean;
          }>
        >('get_files_metadata', { paths });

        const newFiles: FileItem[] = rawMetadata.map((m) => ({
          path: m.path,
          name: m.name,
          sizeBytes: m.size_bytes,
          fileType: m.file_type,
          format: m.format,
          width: m.width,
          height: m.height,
          hasGps: m.has_gps ?? false,
          hasExif: m.has_exif ?? false,
        }));

        if (newFiles.length === 0) return;

        const currentFiles = get().files;
        const existingPaths = new Set(currentFiles.map((f) => f.path));
        const filteredNew = newFiles.filter((f) => !existingPaths.has(f.path));

        const isFirstUpload = currentFiles.length === 0;
        const defaultPresetId = get().defaultImagePreset;
        const defaultProfile =
          get().customProfiles.find((p) => p.id === defaultPresetId) || get().customProfiles[0];

        const updated = [...currentFiles, ...filteredNew];
        const pdfPaths = updated.filter((f) => f.fileType === 'pdf').map((f) => f.path);
        const existingOrder = get().pdfMergeOrder;
        const newOrder = [
          ...existingOrder.filter((p) => pdfPaths.includes(p)),
          ...pdfPaths.filter((p) => !existingOrder.includes(p)),
        ];

        set({
          files: updated,
          pdfMergeOrder: newOrder,
          screen: 'config',
          activePreviewIndex: 0,
          ...(isFirstUpload && defaultProfile
            ? {
                selectedImagePreset: defaultProfile.id,
                activeCustomProfileId: defaultProfile.id,
                imageOptions: structuredClone(defaultProfile.options),
              }
            : {}),
        });

        await get().refreshPreview();
      } catch (err) {
        console.warn('Fallback aperçu Web suite à :', err);
        get().addDemoFiles();
      }
    },

    addDemoFiles: () => {
      const defaultPresetId = get().defaultImagePreset;
      const defaultProfile =
        get().customProfiles.find((p) => p.id === defaultPresetId) || get().customProfiles[0];
      const demo: FileItem[] = [
        {
          path: 'C:\\Photos\\Montagne-2026.jpg',
          name: 'Montagne-2026.jpg',
          sizeBytes: 4850000,
          fileType: 'image',
          format: 'JPEG',
          width: 4032,
          height: 3024,
          hasGps: true,
          hasExif: true,
        },
        {
          path: 'C:\\Documents\\Facture-Scanee-2026.pdf',
          name: 'Facture-Scanee-2026.pdf',
          sizeBytes: 8900000,
          fileType: 'pdf',
          format: 'PDF',
        },
        {
          path: 'C:\\Design\\Logo-FileMint.png',
          name: 'Logo-FileMint.png',
          sizeBytes: 920000,
          fileType: 'image',
          format: 'PNG',
          width: 1024,
          height: 1024,
        },
      ];
      set({
        files: demo,
        screen: 'config',
        activePreviewIndex: 0,
        selectedImagePreset: defaultProfile?.id || 'preset_none',
        activeCustomProfileId: defaultProfile?.id || null,
        imageOptions: defaultProfile
          ? structuredClone(defaultProfile.options)
          : getPresetOptions('none'),
      });
      get().refreshPreview();
    },

    removeFile: (index) => {
      const removed = get().files[index];
      const files = get().files.filter((_, i) => i !== index);
      const newMergeOrder = removed ? get().pdfMergeOrder.filter((p) => p !== removed.path) : get().pdfMergeOrder;
      if (files.length === 0) {
        set({ files: [], pdfMergeOrder: [], screen: 'home', preview: null, activePreviewIndex: 0 });
      } else {
        const newActive = Math.min(get().activePreviewIndex, files.length - 1);
        set({ files, pdfMergeOrder: newMergeOrder, activePreviewIndex: newActive });
        get().refreshPreview();
      }
    },

    clearFiles: () => set({ files: [], pdfMergeOrder: [], screen: 'home', preview: null, activePreviewIndex: 0 }),

    setActivePreviewIndex: (index) => {
      set({ activePreviewIndex: index });
      get().refreshPreview();
    },

    setImageOptions: (options) => {
      set((state) => ({
        imageOptions: { ...state.imageOptions, ...options },
        selectedImagePreset: 'custom',
        activeCustomProfileId: null,
      }));

      // Short debounce (80ms) for smooth slider responsiveness without flooding IPC
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
      previewDebounceTimer = setTimeout(() => {
        get().refreshPreview();
      }, 80);
    },

    setRotation: (rotation: number) => {
      const normalized = ((rotation % 360) + 360) % 360;
      get().setImageOptions({ rotation: normalized });
    },

    rotateClockwise: () => {
      const current = get().imageOptions.rotation || 0;
      const next = (current + 90) % 360;
      get().setImageOptions({ rotation: next });
    },

    toggleFlipHorizontal: () => {
      const current = get().imageOptions.flip_horizontal || false;
      get().setImageOptions({ flip_horizontal: !current });
    },

    toggleFlipVertical: () => {
      const current = get().imageOptions.flip_vertical || false;
      get().setImageOptions({ flip_vertical: !current });
    },

    toggleGrayscale: () => {
      const isGray =
        get().imageOptions.color_filter === 'grayscale' || Boolean(get().imageOptions.grayscale);
      get().setImageOptions({
        color_filter: isGray ? 'none' : 'grayscale',
        grayscale: !isGray,
      });
    },

    setColorFilter: (filter: ColorFilter) => {
      get().setImageOptions({
        color_filter: filter,
        grayscale: filter === 'grayscale',
      });
    },

    resetManipulations: () => {
      get().setImageOptions({
        rotation: 0,
        flip_horizontal: false,
        flip_vertical: false,
        grayscale: false,
        color_filter: 'none',
      });
    },

    applyImagePreset: (presetId) => {
      get().applyCustomProfile(presetId);
    },

    saveCustomProfile: (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const current = get().customProfiles;
      const nonNoneProfiles = current.filter((p) => p.id !== 'preset_none');
      if (nonNoneProfiles.length >= MAX_CUSTOM_PROFILES) return false;

      const newProfile: CustomProfile = {
        id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmed,
        options: structuredClone(get().imageOptions),
        createdAt: Date.now(),
      };

      const noneProfile = current.find((p) => p.id === 'preset_none');
      const updatedNonNone = [newProfile, ...nonNoneProfiles].slice(0, MAX_CUSTOM_PROFILES);
      const updated = noneProfile ? [noneProfile, ...updatedNonNone] : updatedNonNone;
      saveCustomProfilesToStorage(updated);
      set({
        customProfiles: updated,
        selectedImagePreset: newProfile.id,
        activeCustomProfileId: newProfile.id,
      });
      persistConfigToDisk();
      return true;
    },

    applyCustomProfile: (id: string) => {
      const profile = get().customProfiles.find((p) => p.id === id);
      if (!profile) return;
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = null;
      }
      set({
        imageOptions: structuredClone(profile.options),
        selectedImagePreset: id,
        activeCustomProfileId: id,
      });
      get().refreshPreview();
    },

    deleteCustomProfile: (id: string) => {
      if (id === 'preset_none') return;
      const updated = get().customProfiles.filter((p) => p.id !== id);
      saveCustomProfilesToStorage(updated);
      set((state) => {
        const nextActiveId =
          state.activeCustomProfileId === id ? (updated[0]?.id || null) : state.activeCustomProfileId;
        const nextDefaultId =
          state.defaultImagePreset === id ? (updated[0]?.id || '') : state.defaultImagePreset;
        try {
          localStorage.setItem('filemint_default_preset', nextDefaultId);
        } catch {}
        return {
          customProfiles: updated,
          activeCustomProfileId: nextActiveId,
          defaultImagePreset: nextDefaultId,
        };
      });
      persistConfigToDisk();
    },

    renameCustomProfile: (id: string, newName: string) => {
      if (id === 'preset_none') return false;
      const trimmed = newName.trim();
      if (!trimmed) return false;
      const updated = get().customProfiles.map((p) =>
        p.id === id ? { ...p, name: trimmed } : p
      );
      saveCustomProfilesToStorage(updated);
      set({ customProfiles: updated });
      persistConfigToDisk();
      return true;
    },

    updateCustomProfileOptions: (id: string) => {
      if (id === 'preset_none') return false;
      const current = get().customProfiles;
      const target = current.find((p) => p.id === id);
      if (!target) return false;
      const currentOptions = structuredClone(get().imageOptions);
      const updated = current.map((p) =>
        p.id === id ? { ...p, options: currentOptions } : p
      );
      saveCustomProfilesToStorage(updated);
      set({
        customProfiles: updated,
        activeCustomProfileId: id,
        selectedImagePreset: id,
      });
      persistConfigToDisk();
      return true;
    },

    restoreDefaultProfiles: () => {
      const defaults = getDefaultProfiles(get().t);
      saveCustomProfilesToStorage(defaults);
      set({
        customProfiles: defaults,
        activeCustomProfileId: defaults[0].id,
        selectedImagePreset: defaults[0].id,
        imageOptions: structuredClone(defaults[0].options),
        defaultImagePreset: defaults[0].id,
      });
      try {
        localStorage.setItem('filemint_default_preset', defaults[0].id);
      } catch {}
      persistConfigToDisk();
      get().refreshPreview();
    },

    importCustomProfiles: (profiles: CustomProfile[]) => {
      if (!profiles || profiles.length === 0) return false;
      const validated = validateAndSanitizeProfiles(profiles);
      if (!validated || validated.length === 0) return false;

      const noneItem = validated.find((p) => p.id === 'preset_none') || {
        id: 'preset_none',
        name: get().t.presetNone || 'Aucun',
        options: getPresetOptions('none'),
        createdAt: 0,
      };
      const nonNone = validated.filter((p) => p.id !== 'preset_none').slice(0, MAX_CUSTOM_PROFILES);
      const sanitized = [noneItem, ...nonNone];
      saveCustomProfilesToStorage(sanitized);
      const firstProfile = sanitized[0];
      const newDefaultId = firstProfile ? firstProfile.id : '';
      try {
        localStorage.setItem('filemint_default_preset', newDefaultId);
      } catch {}
      set({
        customProfiles: sanitized,
        activeCustomProfileId: newDefaultId || null,
        selectedImagePreset: newDefaultId || 'preset_none',
        defaultImagePreset: newDefaultId,
        imageOptions: firstProfile
          ? structuredClone(firstProfile.options)
          : getPresetOptions('none'),
      });
      persistConfigToDisk();
      get().refreshPreview();
      return true;
    },

    setPdfOptions: (options) => {
      set((state) => ({
        pdfOptions: { ...state.pdfOptions, ...options },
      }));

      // Debounce preview update to keep slider and profile switches silky smooth
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
      previewDebounceTimer = setTimeout(() => {
        get().refreshPreview();
      }, 100);
    },

    setDestinationConfig: (config) => {
      if (config.naming_pattern !== undefined) {
        try {
          localStorage.setItem('filemint_naming_pattern', config.naming_pattern || '{nom}');
        } catch {}
      }
      if (config.subfolder_name !== undefined) {
        try {
          localStorage.setItem('filemint_subfolder_name', config.subfolder_name || 'FileMint');
        } catch {}
      }
      if (config.mode !== undefined) {
        try {
          if (typeof config.mode === 'string') {
            localStorage.setItem('filemint_default_dest_mode', config.mode);
          } else if (config.mode && typeof config.mode === 'object' && 'Custom' in config.mode) {
            localStorage.setItem('filemint_default_dest_mode', 'Custom');
            localStorage.setItem('filemint_custom_folder', config.mode.Custom);
          }
        } catch {}
      }
      set((state) => ({
        destinationConfig: { ...state.destinationConfig, ...config },
      }));
      persistConfigToDisk();
    },

    refreshPreview: async () => {
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = null;
      }

      const { files, activePreviewIndex, imageOptions, pdfOptions } = get();
      const activeFile = files[activePreviewIndex];
      if (!activeFile || (activeFile.fileType !== 'image' && activeFile.fileType !== 'pdf')) {
        set({ preview: null, previewLoading: false });
        return;
      }

      const reqId = ++previewRequestId;
      set({ previewLoading: true });

      // PDF Page 1 high-performance preview
      if (activeFile.fileType === 'pdf') {
        if (!isTauriEnv()) {
          const isTargetSize = Boolean(pdfOptions.target_size_kb && pdfOptions.target_size_kb > 0);
          const targetBytes = (pdfOptions.target_size_kb || 0) * 1024;
          const estimatedPercent = isTargetSize
            ? (activeFile.sizeBytes > 0 && activeFile.sizeBytes > targetBytes
                ? Math.round(((activeFile.sizeBytes - targetBytes) / activeFile.sizeBytes) * 100)
                : 0)
            : (pdfOptions.profile === 'Compact' ? 65 : pdfOptions.profile === 'Balanced' ? 45 : 25);
          const estimatedFinal = isTargetSize
            ? Math.min(activeFile.sizeBytes, targetBytes)
            : Math.round(activeFile.sizeBytes * (1 - estimatedPercent / 100));

          if (reqId === previewRequestId) {
            set({
              preview: {
                data_url: '',
                original_data_url: '',
                original_width: 800,
                original_height: 1100,
                new_width: 800,
                new_height: 1100,
                original_bytes: activeFile.sizeBytes,
                estimated_bytes: estimatedFinal,
                saved_percentage: estimatedPercent,
                transparency_loss_warning: false,
              },
              previewLoading: false,
            });
          }
          return;
        }

        try {
          const res = await invoke<PdfPreviewResponse>('generate_pdf_preview', {
            path: activeFile.path,
            options: pdfOptions,
          });

          const origBytes = base64ToUint8Array(res.original_page_pdf_base64);
          const compBytes = base64ToUint8Array(res.compressed_page_pdf_base64);

          const [origPage, compPage] = await Promise.all([
            renderPdfPage1(origBytes),
            renderPdfPage1(compBytes),
          ]);

          if (reqId === previewRequestId) {
            const currentSelected = get().selectedPdfPages;
            const updatedSelected =
              currentSelected.length === 0
                ? Array.from({ length: res.total_pages }, (_, i) => i + 1)
                : currentSelected.filter((p) => p <= res.total_pages);

            set({
              activePdfTotalPages: res.total_pages,
              selectedPdfPages: updatedSelected,
              pdfPageRangeInput: formatPageRange(updatedSelected),
              preview: {
                original_data_url: origPage.dataUrl,
                data_url: compPage.dataUrl,
                original_bytes: res.original_bytes,
                estimated_bytes: res.estimated_bytes,
                saved_percentage: res.saved_percentage,
                original_width: origPage.width,
                original_height: origPage.height,
                new_width: compPage.width,
                new_height: compPage.height,
                transparency_loss_warning: false,
              },
              previewLoading: false,
            });
          }
        } catch (err) {
          console.error("Erreur lors de la génération de la prévisualisation PDF :", err);
          if (reqId === previewRequestId) {
            set({ preview: null, previewLoading: false });
          }
        }
        return;
      }

      // Image preview
      if (!isTauriEnv()) {
        const localResult = generateLocalBrowserPreview(activeFile, imageOptions);
        if (reqId === previewRequestId) {
          set({ preview: localResult, previewLoading: false });
        }
        return;
      }

      try {
        const preview = await invoke<PreviewResult>('generate_image_preview', {
          path: activeFile.path,
          options: imageOptions,
        });
        if (reqId === previewRequestId) {
          set({ preview, previewLoading: false });
        }
      } catch (err) {
        console.warn("Invoke natif indisponible, utilisation du moteur de prévisualisation local :", err);
        const localResult = generateLocalBrowserPreview(activeFile, imageOptions);
        if (reqId === previewRequestId) {
          set({ preview: localResult, previewLoading: false });
        }
      }
    },

    startBatch: async () => {
      const {
        files,
        imageOptions,
        pdfOptions,
        destinationConfig,
        pdfToolMode,
        activePreviewIndex,
      } = get();
      if (files.length === 0) return;

      const activeFile = files[activePreviewIndex];
      const pdfFiles = files.filter((f) => f.fileType === 'pdf');

      if (pdfFiles.length >= 2 && pdfToolMode === 'merge') {
        const ok = await get().executePdfMerge();
        if (ok) return;
      }

      if (activeFile?.fileType === 'pdf' && pdfToolMode === 'split') {
        const ok = await get().executePdfSplit();
        if (ok) return;
      }

      set({
        batchRunning: true,
        batchProgress: {
          current_index: 0,
          total_items: files.length,
          current_file: 'Démarrage...',
          success: true,
          error_message: null,
          saved_bytes: 0,
        },
        batchSummary: null,
        screen: 'results',
      });

      if (!isTauriEnv()) {
        let savedTotal = 0;
        for (let i = 0; i < files.length; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const file = files[i];
          const saved = Math.round(file.sizeBytes * 0.55);
          savedTotal += saved;
          set({
            batchProgress: {
              current_index: i + 1,
              total_items: files.length,
              current_file: file.name,
              success: true,
              error_message: null,
              saved_bytes: savedTotal,
            },
          });
        }

        const mockSummary: BatchSummary = {
          total_items: files.length,
          success_count: files.length,
          failure_count: 0,
          total_original_bytes: files.reduce((acc, f) => acc + f.sizeBytes, 0),
          total_final_bytes: files.reduce((acc, f) => acc + Math.round(f.sizeBytes * 0.45), 0),
          total_saved_bytes: savedTotal,
          cancelled: false,
          items: files.map((f) => ({
            file_name: f.name,
            original_size: f.sizeBytes,
            final_size: Math.round(f.sizeBytes * 0.45),
            success: true,
            error: null,
            output_path: `./FileMint/${f.name}`,
          })),
        };
        get().recordBatchCompletion(mockSummary);
        set({
          batchRunning: false,
          batchSummary: mockSummary,
        });
        return;
      }

      const items = files.map((file) => {
        if (file.fileType === 'pdf') {
          return {
            input_path: file.path,
            action: { Pdf: pdfOptions },
          };
        } else {
          return {
            input_path: file.path,
            action: { Image: imageOptions },
          };
        }
      });

      try {
        const summary = await invoke<BatchSummary>('start_batch_processing', {
          request: {
            items,
            destination: destinationConfig,
          },
        });
        get().recordBatchCompletion(summary);
        set({ batchSummary: summary, batchRunning: false });
      } catch (err) {
        console.error('Erreur durant le traitement par lot :', err);
        set({ batchRunning: false });
      }
    },

    cancelBatch: async () => {
      if (!isTauriEnv()) {
        set({ batchRunning: false });
        return;
      }
      try {
        await invoke('cancel_batch_processing');
        set({ batchRunning: false });
      } catch (err) {
        console.error("Erreur lors de l'annulation :", err);
      }
    },

    executePdfMerge: async (): Promise<boolean> => {
      const { files, pdfMergeOrder, pdfMergeOutputName, destinationConfig } = get();
      const pdfFiles = files.filter((f) => f.fileType === 'pdf');
      if (pdfFiles.length < 2) return false;

      const orderedPaths =
        pdfMergeOrder.length > 0
          ? pdfMergeOrder.filter((p) => pdfFiles.some((f) => f.path === p))
          : pdfFiles.map((f) => f.path);

      for (const f of pdfFiles) {
        if (!orderedPaths.includes(f.path)) orderedPaths.push(f.path);
      }

      if (orderedPaths.length < 2) return false;

      const firstFile = pdfFiles.find((f) => f.path === orderedPaths[0]) || pdfFiles[0];
      const destDir = resolveDestinationDir(firstFile.path, destinationConfig);

      const baseNameWithoutExt = firstFile.name.replace(/\.[^/.]+$/, '');
      const rawPattern = pdfMergeOutputName.trim() || '{nom}_fusion.pdf';
      let resolvedFileName = rawPattern
        .replace(/\{nom\}/gi, baseNameWithoutExt)
        .replace(/\{name\}/gi, baseNameWithoutExt);

      if (!resolvedFileName.toLowerCase().endsWith('.pdf')) {
        resolvedFileName += '.pdf';
      }

      const sep = firstFile.path.includes('\\') ? '\\' : '/';
      const finalOutputPath = `${destDir}${sep}${resolvedFileName}`;

      set({
        batchRunning: true,
        batchProgress: {
          current_index: 1,
          total_items: 1,
          current_file: resolvedFileName,
          success: true,
          error_message: null,
          saved_bytes: 0,
        },
        batchSummary: null,
        screen: 'results',
      });

      if (!isTauriEnv()) {
        await new Promise((r) => setTimeout(r, 800));
        const totalOrig = pdfFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
        const finalSize = Math.round(totalOrig * 0.9);
        const mockSummary: BatchSummary = {
          total_items: 1,
          success_count: 1,
          failure_count: 0,
          total_original_bytes: totalOrig,
          total_final_bytes: finalSize,
          total_saved_bytes: totalOrig - finalSize,
          cancelled: false,
          items: [
            {
              file_name: resolvedFileName,
              original_size: totalOrig,
              final_size: finalSize,
              success: true,
              error: null,
              output_path: finalOutputPath,
            },
          ],
        };
        get().recordBatchCompletion(mockSummary);
        set({ batchRunning: false, batchSummary: mockSummary });
        return true;
      }

      try {
        const result = await invoke<{
          original_bytes: number;
          compressed_bytes: number;
          saved_percentage: number;
          pages_count: number;
          image_count_optimized: number;
        }>('merge_pdfs', {
          inputPaths: orderedPaths,
          outputPath: finalOutputPath,
        });

        const summary: BatchSummary = {
          total_items: 1,
          success_count: 1,
          failure_count: 0,
          total_original_bytes: result.original_bytes,
          total_final_bytes: result.compressed_bytes,
          total_saved_bytes: Math.max(0, result.original_bytes - result.compressed_bytes),
          cancelled: false,
          items: [
            {
              file_name: resolvedFileName,
              original_size: result.original_bytes,
              final_size: result.compressed_bytes,
              success: true,
              error: null,
              output_path: finalOutputPath,
            },
          ],
        };

        get().recordBatchCompletion(summary);
        set({ batchRunning: false, batchSummary: summary });
        return true;
      } catch (err: any) {
        console.error('Erreur lors de la fusion PDF :', err);
        set({
          batchRunning: false,
          batchSummary: {
            total_items: 1,
            success_count: 0,
            failure_count: 1,
            total_original_bytes: 0,
            total_final_bytes: 0,
            total_saved_bytes: 0,
            cancelled: false,
            items: [
              {
                file_name: resolvedFileName,
                original_size: 0,
                final_size: 0,
                success: false,
                error: String(err),
                output_path: null,
              },
            ],
          },
        });
        return false;
      }
    },

    executePdfSplit: async (): Promise<boolean> => {
      const {
        files,
        activePreviewIndex,
        pdfSplitAction,
        selectedPdfPages,
        pdfPageRangeInput,
        destinationConfig,
        activePdfTotalPages,
      } = get();

      const activeFile = files[activePreviewIndex];
      if (!activeFile || activeFile.fileType !== 'pdf') return false;

      const destDir = resolveDestinationDir(activeFile.path, destinationConfig);
      const baseNameWithoutExt = activeFile.name.replace(/\.[^/.]+$/, '');
      const sep = activeFile.path.includes('\\') ? '\\' : '/';

      if (pdfSplitAction === 'single_pdf') {
        const pagesToExtract =
          selectedPdfPages.length > 0
            ? selectedPdfPages
            : parsePageRange(pdfPageRangeInput, activePdfTotalPages);

        if (pagesToExtract.length === 0) return false;

        const rangeStr = formatPageRange(pagesToExtract).replace(/[, ]+/g, '_');
        const resolvedFileName = `${baseNameWithoutExt}_pages_${rangeStr}.pdf`;
        const finalOutputPath = `${destDir}${sep}${resolvedFileName}`;

        set({
          batchRunning: true,
          batchProgress: {
            current_index: 1,
            total_items: 1,
            current_file: resolvedFileName,
            success: true,
            error_message: null,
            saved_bytes: 0,
          },
          batchSummary: null,
          screen: 'results',
        });

        if (!isTauriEnv()) {
          await new Promise((r) => setTimeout(r, 600));
          const mockSummary: BatchSummary = {
            total_items: 1,
            success_count: 1,
            failure_count: 0,
            total_original_bytes: activeFile.sizeBytes,
            total_final_bytes: Math.round(
              activeFile.sizeBytes * (pagesToExtract.length / (activePdfTotalPages || 1))
            ),
            total_saved_bytes: 0,
            cancelled: false,
            items: [
              {
                file_name: resolvedFileName,
                original_size: activeFile.sizeBytes,
                final_size: Math.round(
                  activeFile.sizeBytes * (pagesToExtract.length / (activePdfTotalPages || 1))
                ),
                success: true,
                error: null,
                output_path: finalOutputPath,
              },
            ],
          };
          get().recordBatchCompletion(mockSummary);
          set({ batchRunning: false, batchSummary: mockSummary });
          return true;
        }

        try {
          const result = await invoke<{
            original_bytes: number;
            compressed_bytes: number;
            saved_percentage: number;
            pages_count: number;
            image_count_optimized: number;
          }>('extract_pdf_pages', {
            inputPath: activeFile.path,
            pages: pagesToExtract,
            outputPath: finalOutputPath,
          });

          const summary: BatchSummary = {
            total_items: 1,
            success_count: 1,
            failure_count: 0,
            total_original_bytes: result.original_bytes,
            total_final_bytes: result.compressed_bytes,
            total_saved_bytes: Math.max(0, result.original_bytes - result.compressed_bytes),
            cancelled: false,
            items: [
              {
                file_name: resolvedFileName,
                original_size: result.original_bytes,
                final_size: result.compressed_bytes,
                success: true,
                error: null,
                output_path: finalOutputPath,
              },
            ],
          };

          get().recordBatchCompletion(summary);
          set({ batchRunning: false, batchSummary: summary });
          return true;
        } catch (err: any) {
          console.error("Erreur lors de l'extraction PDF :", err);
          return false;
        }
      } else {
        // Split all pages
        set({
          batchRunning: true,
          batchProgress: {
            current_index: 1,
            total_items: activePdfTotalPages || 1,
            current_file: activeFile.name,
            success: true,
            error_message: null,
            saved_bytes: 0,
          },
          batchSummary: null,
          screen: 'results',
        });

        if (!isTauriEnv()) {
          await new Promise((r) => setTimeout(r, 600));
          const total = activePdfTotalPages || 2;
          const mockItems = Array.from({ length: total }, (_, i) => ({
            file_name: `${baseNameWithoutExt}_page_${i + 1}.pdf`,
            original_size: Math.round(activeFile.sizeBytes / total),
            final_size: Math.round(activeFile.sizeBytes / total),
            success: true,
            error: null,
            output_path: `${destDir}${sep}${baseNameWithoutExt}_page_${i + 1}.pdf`,
          }));
          const mockSummary: BatchSummary = {
            total_items: total,
            success_count: total,
            failure_count: 0,
            total_original_bytes: activeFile.sizeBytes,
            total_final_bytes: activeFile.sizeBytes,
            total_saved_bytes: 0,
            cancelled: false,
            items: mockItems,
          };
          get().recordBatchCompletion(mockSummary);
          set({ batchRunning: false, batchSummary: mockSummary });
          return true;
        }

        try {
          const generatedPaths = await invoke<string[]>('split_pdf_all', {
            inputPath: activeFile.path,
            outputDir: destDir,
            baseName: baseNameWithoutExt,
          });

          const items = generatedPaths.map((p) => {
            const lastSep = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
            const fName = lastSep >= 0 ? p.substring(lastSep + 1) : p;
            return {
              file_name: fName,
              original_size: Math.round(activeFile.sizeBytes / (generatedPaths.length || 1)),
              final_size: Math.round(activeFile.sizeBytes / (generatedPaths.length || 1)),
              success: true,
              error: null,
              output_path: p,
            };
          });

          const summary: BatchSummary = {
            total_items: generatedPaths.length,
            success_count: generatedPaths.length,
            failure_count: 0,
            total_original_bytes: activeFile.sizeBytes,
            total_final_bytes: activeFile.sizeBytes,
            total_saved_bytes: 0,
            cancelled: false,
            items,
          };

          get().recordBatchCompletion(summary);
          set({ batchRunning: false, batchSummary: summary });
          return true;
        } catch (err: any) {
          console.error('Erreur lors du découpage PDF :', err);
          return false;
        }
      }
    },

    resetToHome: () => {
      const defaultPresetId = get().defaultImagePreset;
      const defaultProfile =
        get().customProfiles.find((p) => p.id === defaultPresetId) || get().customProfiles[0];
      set({
        files: [],
        screen: 'home',
        preview: null,
        batchProgress: null,
        batchSummary: null,
        batchRunning: false,
        selectedImagePreset: defaultProfile?.id || 'preset_none',
        activeCustomProfileId: defaultProfile?.id || null,
        imageOptions: defaultProfile
          ? structuredClone(defaultProfile.options)
          : getPresetOptions('none'),
      });
    },

    checkUpdates: async () => {
      if (!get().updateCheckEnabled || !isTauriEnv()) return;
      try {
        const info = await invoke<UpdateInfo | null>('check_update', {
          currentVersion: APP_VERSION,
        });
        if (info && info.has_update) {
          const isDownloaded = Boolean(info.is_downloaded);
          set({
            updateInfo: info,
            updateDownloaded: isDownloaded,
          });

          // Téléchargement automatique en arrière-plan si disponible et non encore téléchargé
          if (!isDownloaded && info.download_url && info.asset_name && !get().updateDownloading) {
            get().downloadUpdate();
          }
        }
      } catch {
        // Silently ignore if offline
      }
    },

    downloadUpdate: async () => {
      const info = get().updateInfo;
      if (!info) return;

      // If direct installer is not available for this OS or download URL is missing, open the release page in browser
      if (!info.download_url || !info.asset_name) {
        const targetUrl = info.release_notes_url || 'https://github.com/duboiss/FileMint/releases/latest';
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(targetUrl);
        } catch {
          window.open(targetUrl, '_blank');
        }
        return;
      }

      set({
        updateDownloading: true,
        updateDownloaded: false,
        updateProgress: 0,
        updateError: null,
      });

      try {
        await invoke('download_update', {
          downloadUrl: info.download_url,
          assetName: info.asset_name,
          version: info.latest_version,
        });
        set({
          updateDownloading: false,
          updateDownloaded: true,
          updateProgress: 100,
        });
      } catch (err: unknown) {
        console.error('Update download failed:', err);
        set({
          updateDownloading: false,
          updateDownloaded: false,
          updateError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    installAndRestart: async () => {
      set({ updateInstalling: true, updateError: null });
      try {
        await invoke('install_update');
      } catch (err: unknown) {
        console.error('Install update failed:', err);
        set({
          updateInstalling: false,
          updateError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setContextMenuMode: async (mode: ContextMenuMode) => {
      try {
        localStorage.setItem('filemint_context_menu_mode', mode);
      } catch {}
      set({ contextMenuMode: mode });
      persistConfigToDisk();
      if (mode === 'disabled') {
        await get().toggleContextMenu(false, 'disabled');
      } else {
        await get().toggleContextMenu(true, mode);
      }
    },

    toggleContextMenu: async (enable: boolean, mode?: ContextMenuMode) => {
      const targetMode = mode
        ? mode
        : enable
        ? get().contextMenuMode === 'disabled'
          ? 'modern'
          : get().contextMenuMode
        : 'disabled';
      const shouldEnable = enable && targetMode !== 'disabled';
      // Optimistic update so UI reflects click instantly without perceived freeze
      set({
        contextMenuEnabled: shouldEnable,
        contextMenuMode: targetMode,
        contextMenuLoading: true,
      });
      if (!isTauriEnv()) {
        set({ contextMenuLoading: false });
        return;
      }
      try {
        const res = await invoke<ContextMenuStatus>('toggle_windows_context_menu', {
          enable: shouldEnable,
          mode: targetMode,
          lang: get().language,
        });
        set({
          contextMenuEnabled: res.enabled,
          contextMenuMode: (res.mode as ContextMenuMode) || targetMode,
        });

        if (shouldEnable && res.enabled) {
          get().showAppToast(
            get().t.contextMenuReadyTitle,
            get().t.contextMenuReadyDesc,
            'success'
          );

          if (isTauriEnv()) {
            import('@tauri-apps/plugin-notification')
              .then(({ isPermissionGranted, sendNotification }) => {
                isPermissionGranted()
                  .then((granted) => {
                    if (granted) {
                      sendNotification({
                        title: 'FileMint',
                        body: get().t.contextMenuReadyTitle,
                      });
                    }
                  })
                  .catch(() => {});
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error('Erreur menu contextuel :', err);
      } finally {
        set({ contextMenuLoading: false });
      }
    },

    initSettings: async () => {
      if (!isTauriEnv()) return;

      // 1. Load persistent configuration from disk (%APPDATA%/FileMint/config.json)
      try {
        const diskConfig = await invoke<AppConfig>('get_app_config');
        if (diskConfig) {
          const updates: Partial<FileMintState> = {};

          // Language & Welcome modal
          if (diskConfig.language === 'fr' || diskConfig.language === 'en') {
            const lang = diskConfig.language as Language;
            updates.language = lang;
            updates.showWelcomeModal = false;
            updates.t = translations[lang];
            try {
              localStorage.setItem('filemint_language', lang);
            } catch {}
          }

          // Theme
          if (
            diskConfig.theme === 'light' ||
            diskConfig.theme === 'dark' ||
            diskConfig.theme === 'system'
          ) {
            const theme = diskConfig.theme as ThemeMode;
            updates.theme = theme;
            applyThemeToDom(theme);
            try {
              localStorage.setItem('filemint_theme', theme);
            } catch {}
          }

          // Context Menu Mode
          if (diskConfig.context_menu_mode) {
            updates.contextMenuMode = diskConfig.context_menu_mode as ContextMenuMode;
            try {
              localStorage.setItem('filemint_context_menu_mode', diskConfig.context_menu_mode);
            } catch {}
          }

          // Destination settings
          const nextDest = { ...get().destinationConfig };
          let destChanged = false;
          if (diskConfig.naming_pattern) {
            nextDest.naming_pattern = diskConfig.naming_pattern;
            destChanged = true;
            try {
              localStorage.setItem('filemint_naming_pattern', diskConfig.naming_pattern);
            } catch {}
          }
          if (diskConfig.subfolder_name) {
            nextDest.subfolder_name = diskConfig.subfolder_name;
            destChanged = true;
            try {
              localStorage.setItem('filemint_subfolder_name', diskConfig.subfolder_name);
            } catch {}
          }
          if (diskConfig.custom_folder) {
            try {
              localStorage.setItem('filemint_custom_folder', diskConfig.custom_folder);
            } catch {}
          }
          if (diskConfig.default_dest_mode) {
            if (diskConfig.default_dest_mode === 'original') {
              nextDest.mode = 'SameAsOriginal';
            } else if (diskConfig.default_dest_mode === 'custom' && diskConfig.custom_folder) {
              nextDest.mode = { Custom: diskConfig.custom_folder };
            } else {
              nextDest.mode = 'FileMintSubfolder';
            }
            destChanged = true;
          }
          if (destChanged) {
            updates.destinationConfig = nextDest;
          }

          // Tabs & Presets
          if (diskConfig.default_tab) {
            updates.defaultImageTab = diskConfig.default_tab as ImageConfigTab;
            try {
              localStorage.setItem('filemint_default_tab', diskConfig.default_tab);
            } catch {}
          }
          if (diskConfig.default_preset) {
            updates.defaultImagePreset = diskConfig.default_preset;
            try {
              localStorage.setItem('filemint_default_preset', diskConfig.default_preset);
            } catch {}
          }

          // Update check toggle
          if (typeof diskConfig.update_check === 'boolean') {
            updates.updateCheckEnabled = diskConfig.update_check;
            try {
              localStorage.setItem('filemint_update_check', String(diskConfig.update_check));
            } catch {}
          }

          // Lifetime stats (take max between disk and current)
          const diskSaved = diskConfig.lifetime_saved_bytes || 0;
          const diskFiles = diskConfig.lifetime_files_count || 0;
          const currentSaved = get().lifetimeSavedBytes;
          const currentFiles = get().lifetimeFilesCount;
          if (diskSaved > currentSaved || diskFiles > currentFiles) {
            const finalSaved = Math.max(diskSaved, currentSaved);
            const finalFiles = Math.max(diskFiles, currentFiles);
            updates.lifetimeSavedBytes = finalSaved;
            updates.lifetimeFilesCount = finalFiles;
            saveLifetimeStatsToStorage(finalSaved, finalFiles);
          }

          // Custom profiles
          if (Array.isArray(diskConfig.custom_profiles) && diskConfig.custom_profiles.length > 0) {
            const currentProfiles = get().customProfiles;
            if (
              currentProfiles.length <= 1 ||
              diskConfig.custom_profiles.length > currentProfiles.length
            ) {
              updates.customProfiles = diskConfig.custom_profiles;
              saveCustomProfilesToStorage(diskConfig.custom_profiles);
            }
          }

          // Watch folders
          if (Array.isArray(diskConfig.watch_folders) && diskConfig.watch_folders.length > 0) {
            const currentWatch = get().watchFolders;
            if (currentWatch.length === 0 && diskConfig.watch_folders.length > 0) {
              updates.watchFolders = diskConfig.watch_folders;
              updates.watchFolderConfig = getInitialWatchFolderConfig(diskConfig.watch_folders);
              saveWatchFoldersToStorage(diskConfig.watch_folders);
            }
          }

          if (Object.keys(updates).length > 0) {
            set(updates);
          } else if (!diskConfig.language) {
            // First run on clean installation: save current settings to disk
            persistConfigToDisk();
          }
        }
      } catch (err) {
        console.warn('Failed to load app config from disk:', err);
      }

      // 2. Windows Context Menu status check
      try {
        const savedMode = (localStorage.getItem('filemint_context_menu_mode') as ContextMenuMode) || null;
        const res = await invoke<ContextMenuStatus>('get_windows_context_menu_status');

        if (savedMode === 'disabled') {
          // If user explicitly configured disabled, enforce it and clean up any stray registration
          if (res.enabled) {
            invoke('toggle_windows_context_menu', {
              enable: false,
              mode: 'disabled',
              lang: get().language,
            }).catch(() => {});
          }
          set({
            contextMenuEnabled: false,
            contextMenuMode: 'disabled',
          });
        } else {
          set({
            contextMenuEnabled: res.enabled,
            contextMenuMode: (res.mode as ContextMenuMode) || savedMode || get().contextMenuMode,
          });
        }
      } catch {
        // Silently ignore if not running in Windows shell environment
      }

      // 3. Watch folders backend synchronization
      try {
        const watchFolders = get().watchFolders;
        if (watchFolders.some((f) => f.enabled && f.watch_path)) {
          syncWatchFoldersToBackend(watchFolders, get()).catch((err) =>
            console.warn('Erreur synchronisation dossiers surveillés au démarrage :', err)
          );
        }
      } catch (err) {
        console.warn('Erreur initialisation dossiers surveillés :', err);
      }
    },
  };
});

if (typeof window !== 'undefined' && window.matchMedia) {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      const currentTheme = useFileMintStore.getState().theme;
      if (currentTheme === 'system') {
        applyThemeToDom('system');
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (
      typeof (mediaQuery as unknown as { addListener?: (cb: () => void) => void }).addListener ===
      'function'
    ) {
      (mediaQuery as unknown as { addListener: (cb: () => void) => void }).addListener(
        handleSystemThemeChange
      );
    }
  } catch (err) {
    console.warn('Erreur écoute prefers-color-scheme :', err);
  }
}
