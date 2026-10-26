import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  FileItem,
  ImageConfigTab,
  ImageTransformOptions,
  CustomProfile,
  PdfCompressionOptions,
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
} from '../types';
import {
  Language,
  TranslationDictionary,
  translations,
  getSystemLanguage,
} from '../i18n/translations';

import packageJson from '../../package.json';

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
  return '100% (Original)';
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
      metadata_policy: ['KeepAll', 'RemoveGps', 'RemoveAll'].includes(
        rawOpt.metadata_policy as string
      )
        ? (rawOpt.metadata_policy as ImageTransformOptions['metadata_policy'])
        : 'RemoveGps',
      compress: rawOpt.compress !== false,
    };

    validProfiles.push({
      id,
      name,
      options: sanitizedOptions,
      createdAt,
    });
    if (validProfiles.length >= MAX_CUSTOM_PROFILES) break;
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

const getInitialWatchFolders = (): WatchFolderRule[] => {
  try {
    const raw = localStorage.getItem(WATCH_FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure preset_none is available
        const hasNone = parsed.some((p: CustomProfile) => p.id === 'preset_none');
        if (!hasNone) {
          const noneProfile: CustomProfile = {
            id: 'preset_none',
            name: dict?.presetNone || 'Aucun',
            options: getPresetOptions('none'),
            createdAt: 0,
          };
          const merged = [noneProfile, ...parsed].slice(0, MAX_CUSTOM_PROFILES);
          saveCustomProfilesToStorage(merged);
          return merged;
        }
        return parsed.slice(0, MAX_CUSTOM_PROFILES);
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
    localStorage.setItem(CUSTOM_PROFILES_STORAGE_KEY, JSON.stringify(profiles.slice(0, MAX_CUSTOM_PROFILES)));
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

  const areaRatio = (targetW * targetH) / (origW * origH);
  const isCompressionDisabled = imageOptions.compress === false;
  const isNoTransform =
    imageOptions.format === 'Original' &&
    Object.keys(imageOptions.resize_mode)[0] === 'None' &&
    (imageOptions.rotation || 0) === 0 &&
    !imageOptions.flip_horizontal &&
    !imageOptions.flip_vertical &&
    !imageOptions.grayscale;

  let estimatedBytes: number;
  let savedPercentage: number;

  if (imageOptions.target_size_kb && imageOptions.target_size_kb > 0 && !isCompressionDisabled) {
    const targetBytes = imageOptions.target_size_kb * 1024;
    estimatedBytes = Math.min(activeFile.sizeBytes, targetBytes);
    savedPercentage = activeFile.sizeBytes > 0
      ? Math.max(0, Math.round(((activeFile.sizeBytes - estimatedBytes) / activeFile.sizeBytes) * 100))
      : 0;
  } else if (isCompressionDisabled && isNoTransform) {
    estimatedBytes = activeFile.sizeBytes;
    savedPercentage = 0;
  } else {
    const qualityFactor = isCompressionDisabled ? 1.0 : Math.max(0.1, imageOptions.quality / 100);
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

  const filterStyle = imageOptions.grayscale ? 'filter: grayscale(100%);' : '';
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    ${graphicContent}
    <rect x="20" y="20" width="300" height="42" rx="12" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.1)"/>
    <text x="35" y="47" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="600">${targetW} × ${targetH} px • ${
    imageOptions.format === 'Original' ? activeFile.format : imageOptions.format
  }${imageOptions.grayscale ? ' • N&B' : ''}${imageOptions.rotation ? ` • ${imageOptions.rotation}°` : ''}</text>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return {
    data_url: dataUrl,
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

  language: Language;
  showWelcomeModal: boolean;
  t: TranslationDictionary;

  settingsOpen: boolean;
  updateCheckEnabled: boolean;
  updateInfo: UpdateInfo | null;
  updateDownloading: boolean;
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
  setDestinationConfig: (config: Partial<DestinationConfig>) => void;
  refreshPreview: () => Promise<void>;
  startBatch: () => Promise<void>;
  cancelBatch: () => Promise<void>;
  resetToHome: () => void;
  checkUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  toggleContextMenu: (enable: boolean, mode?: ContextMenuMode) => Promise<void>;
  initSettings: () => Promise<void>;
}

let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequestId = 0;

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
      ? JSON.parse(JSON.stringify(initialActiveProfile.options))
      : getPresetOptions('none'),
    customProfiles: initialProfiles,
    activeCustomProfileId: initialActiveProfile?.id || null,

    pdfOptions: {
      profile: 'Balanced',
      optimize_structure: true,
      recompress_images: true,
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
    },

    resetLifetimeStats: () => {
      saveLifetimeStatsToStorage(0, 0);
      set({ lifetimeSavedBytes: 0, lifetimeFilesCount: 0 });
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
      setTimeout(() => {
        set({ watchToastVisible: false });
      }, 5000);
    },

    dismissWatchToast: () => {
      set({ watchToastVisible: false });
    },

    settingsOpen: false,
    updateCheckEnabled: getInitialUpdateCheckEnabled(),
    updateInfo: null,
    updateDownloading: false,
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
      set({ language: lang, t: translations[lang] });
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
    },
    setTheme: (theme: ThemeMode) => {
      try {
        localStorage.setItem('filemint_theme', theme);
      } catch (err) {
        console.warn('Erreur sauvegarde thème :', err);
      }
      set({ theme });
      applyThemeToDom(theme);
    },

    setDefaultImageTab: (tab: ImageConfigTab) => {
      set({ defaultImageTab: tab });
      try {
        localStorage.setItem('filemint_default_tab', tab);
      } catch {}
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
        set({
          files: updated,
          screen: 'config',
          activePreviewIndex: 0,
          ...(isFirstUpload && defaultProfile
            ? {
                selectedImagePreset: defaultProfile.id,
                activeCustomProfileId: defaultProfile.id,
                imageOptions: JSON.parse(JSON.stringify(defaultProfile.options)),
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
          ? JSON.parse(JSON.stringify(defaultProfile.options))
          : getPresetOptions('none'),
      });
      get().refreshPreview();
    },

    removeFile: (index) => {
      const files = get().files.filter((_, i) => i !== index);
      if (files.length === 0) {
        set({ files: [], screen: 'home', preview: null, activePreviewIndex: 0 });
      } else {
        const newActive = Math.min(get().activePreviewIndex, files.length - 1);
        set({ files, activePreviewIndex: newActive });
        get().refreshPreview();
      }
    },

    clearFiles: () => set({ files: [], screen: 'home', preview: null, activePreviewIndex: 0 }),

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
      const current = get().imageOptions.grayscale || false;
      get().setImageOptions({ grayscale: !current });
    },

    resetManipulations: () => {
      get().setImageOptions({
        rotation: 0,
        flip_horizontal: false,
        flip_vertical: false,
        grayscale: false,
      });
    },

    applyImagePreset: (presetId) => {
      get().applyCustomProfile(presetId);
    },

    saveCustomProfile: (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const current = get().customProfiles;
      if (current.length >= MAX_CUSTOM_PROFILES) return false;

      const newProfile: CustomProfile = {
        id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmed,
        options: JSON.parse(JSON.stringify(get().imageOptions)),
        createdAt: Date.now(),
      };

      const updated = [newProfile, ...current].slice(0, MAX_CUSTOM_PROFILES);
      saveCustomProfilesToStorage(updated);
      set({
        customProfiles: updated,
        selectedImagePreset: newProfile.id,
        activeCustomProfileId: newProfile.id,
      });
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
        imageOptions: JSON.parse(JSON.stringify(profile.options)),
        selectedImagePreset: id,
        activeCustomProfileId: id,
      });
      get().refreshPreview();
    },

    deleteCustomProfile: (id: string) => {
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
    },

    renameCustomProfile: (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return false;
      const updated = get().customProfiles.map((p) =>
        p.id === id ? { ...p, name: trimmed } : p
      );
      saveCustomProfilesToStorage(updated);
      set({ customProfiles: updated });
      return true;
    },

    updateCustomProfileOptions: (id: string) => {
      const current = get().customProfiles;
      const target = current.find((p) => p.id === id);
      if (!target) return false;
      const currentOptions = JSON.parse(JSON.stringify(get().imageOptions));
      const updated = current.map((p) =>
        p.id === id ? { ...p, options: currentOptions } : p
      );
      saveCustomProfilesToStorage(updated);
      set({
        customProfiles: updated,
        activeCustomProfileId: id,
        selectedImagePreset: id,
      });
      return true;
    },

    restoreDefaultProfiles: () => {
      const defaults = getDefaultProfiles(get().t);
      saveCustomProfilesToStorage(defaults);
      set({
        customProfiles: defaults,
        activeCustomProfileId: defaults[0].id,
        selectedImagePreset: defaults[0].id,
        imageOptions: JSON.parse(JSON.stringify(defaults[0].options)),
        defaultImagePreset: defaults[0].id,
      });
      try {
        localStorage.setItem('filemint_default_preset', defaults[0].id);
      } catch {}
      get().refreshPreview();
    },

    importCustomProfiles: (profiles: CustomProfile[]) => {
      if (!profiles || profiles.length === 0) return false;
      const sanitized = profiles.slice(0, MAX_CUSTOM_PROFILES);
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
          ? JSON.parse(JSON.stringify(firstProfile.options))
          : getPresetOptions('none'),
      });
      get().refreshPreview();
      return true;
    },

    setPdfOptions: (options) => {
      set((state) => ({
        pdfOptions: { ...state.pdfOptions, ...options },
      }));
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
    },

    refreshPreview: async () => {
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = null;
      }

      const { files, activePreviewIndex, imageOptions } = get();
      const activeFile = files[activePreviewIndex];
      if (!activeFile || activeFile.fileType !== 'image') {
        set({ preview: null, previewLoading: false });
        return;
      }

      const reqId = ++previewRequestId;
      set({ previewLoading: true });

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
      const { files, imageOptions, pdfOptions, destinationConfig } = get();
      if (files.length === 0) return;

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
          ? JSON.parse(JSON.stringify(defaultProfile.options))
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
          set({ updateInfo: info });
        }
      } catch {
        // Silently ignore if offline
      }
    },

    installUpdate: async () => {
      const info = get().updateInfo;
      if (!info || !info.download_url || !info.asset_name) return;
      set({ updateDownloading: true, updateProgress: 0, updateError: null });

      try {
        await invoke('download_and_install_update', {
          downloadUrl: info.download_url,
          assetName: info.asset_name,
        });
      } catch (err: unknown) {
        console.error('Update failed:', err);
        set({
          updateDownloading: false,
          updateError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setContextMenuMode: async (mode: ContextMenuMode) => {
      try {
        localStorage.setItem('filemint_context_menu_mode', mode);
      } catch {}
      set({ contextMenuMode: mode });
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
      } catch (err) {
        console.error('Erreur menu contextuel :', err);
      } finally {
        set({ contextMenuLoading: false });
      }
    },

    initSettings: async () => {
      if (!isTauriEnv()) return;
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

      try {
        const watchFolders = get().watchFolders;
        if (watchFolders.some((f) => f.enabled && f.watch_path)) {
          syncWatchFoldersToBackend(watchFolders, get());
        }
      } catch {}
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
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleSystemThemeChange);
    }
  } catch (err) {
    console.warn('Erreur écoute prefers-color-scheme :', err);
  }
}
