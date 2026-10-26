export type FileType = 'image' | 'pdf' | 'unknown';

export type ImageConfigTab = 'presets' | 'manipulate' | 'resize' | 'compress' | 'convert';
export type ImagePreset = string;
export type MetadataPolicy = 'KeepAll' | 'RemoveGps' | 'RemoveAll';

export interface CustomProfile {
  id: string;
  name: string;
  options: ImageTransformOptions;
  createdAt: number;
}

export interface FileItem {
  path: string;
  name: string;
  sizeBytes: number;
  fileType: FileType;
  format: string;
  width?: number;
  height?: number;
  hasGps?: boolean;
  hasExif?: boolean;
}

export type ResizeMode =
  | { type: 'None' }
  | { type: 'Percentage'; percent: number }
  | { type: 'Exact'; width: number; height: number }
  | { type: 'MaxBounds'; maxWidth: number; maxHeight: number };

export type OutputFormat = 'Original' | 'Jpeg' | 'Png' | 'Webp' | 'Avif';

export interface ImageTransformOptions {
  resize_mode: {
    None?: null;
    Percentage?: { percent: number };
    Exact?: { width: number; height: number };
    MaxBounds?: { max_width: number; max_height: number };
  };
  maintain_aspect_ratio: boolean;
  do_not_upscale: boolean;
  format: OutputFormat;
  quality: number; // 1 - 100
  lossless: boolean;
  rotation: number; // 0, 90, 180, 270
  flip_horizontal: boolean;
  flip_vertical: boolean;
  grayscale: boolean;
  metadata_policy: MetadataPolicy;
  compress?: boolean;
  target_size_kb?: number | null;
}

export type PdfProfile = 'Readable' | 'Balanced' | 'Compact';

export interface PdfCompressionOptions {
  profile: PdfProfile;
  optimize_structure: boolean;
  recompress_images: boolean;
  target_size_kb?: number | null;
}

export type DestinationMode =
  | 'FileMintSubfolder'
  | 'SameAsOriginal'
  | { Custom: string };

export interface DestinationConfig {
  mode: DestinationMode;
  custom_suffix: string | null;
  naming_pattern?: string | null;
  overwrite_existing: boolean;
  subfolder_name?: string | null;
}

export interface PreviewResult {
  data_url: string;
  original_data_url?: string | null;
  original_width: number;
  original_height: number;
  new_width: number;
  new_height: number;
  original_bytes: number;
  estimated_bytes: number;
  saved_percentage: number;
  transparency_loss_warning: boolean;
}

export interface ProgressEventPayload {
  current_index: number;
  total_items: number;
  current_file: string;
  success: boolean;
  error_message: string | null;
  saved_bytes: number;
}

export interface ItemSummary {
  file_name: string;
  original_size: number;
  final_size: number;
  success: boolean;
  error: string | null;
  output_path: string | null;
}

export interface BatchSummary {
  total_items: number;
  success_count: number;
  failure_count: number;
  total_original_bytes: number;
  total_final_bytes: number;
  total_saved_bytes: number;
  items: ItemSummary[];
  cancelled: boolean;
}

export interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  release_notes_url: string;
  download_url?: string | null;
  asset_name?: string | null;
  asset_size?: number | null;
  is_downloaded?: boolean;
}

export interface UpdateProgressPayload {
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
}

export type ContextMenuMode = 'disabled' | 'modern' | 'classic';

export interface ContextMenuStatus {
  enabled: boolean;
  mode: ContextMenuMode;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface WatchFolderRule {
  id: string;
  name?: string;
  enabled: boolean;
  watch_path: string;
  output_path: string | null;
  delete_source: boolean;
  profile_id?: string | null;
  image_options?: ImageTransformOptions | null;
  pdf_options?: PdfCompressionOptions | null;
}

export interface WatchFolderConfig {
  rules?: WatchFolderRule[];
  enabled: boolean;
  watch_path: string;
  output_path: string | null;
  delete_source: boolean;
  image_options?: ImageTransformOptions | null;
  pdf_options?: PdfCompressionOptions | null;
  profile_id?: string | null;
}

export interface WatchProcessedEvent {
  rule_id?: string | null;
  file_name: string;
  input_path: string;
  output_path: string;
  original_bytes: number;
  final_bytes: number;
  saved_bytes: number;
  success: boolean;
  error?: string | null;
}
