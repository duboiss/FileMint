use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{
    imageops::FilterType, DynamicImage, GenericImageView, ImageBuffer, ImageEncoder, ImageFormat,
    Rgb,
};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::metadata_manager::{self, MetadataPolicy};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size_bytes: u64,
    pub has_alpha: bool,
    #[serde(default)]
    pub has_gps: bool,
    #[serde(default)]
    pub has_exif: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResizeMode {
    Exact { width: u32, height: u32 },
    Percentage { percent: u32 },
    MaxBounds { max_width: u32, max_height: u32 },
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OutputFormat {
    Original,
    Jpeg,
    Png,
    Webp,
    Avif,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageTransformOptions {
    pub resize_mode: ResizeMode,
    pub maintain_aspect_ratio: bool,
    pub do_not_upscale: bool,
    pub format: OutputFormat,
    pub quality: u8, // 1 - 100
    pub lossless: bool,
    #[serde(default)]
    pub rotation: u16, // 0, 90, 180, 270
    #[serde(default)]
    pub flip_horizontal: bool,
    #[serde(default)]
    pub flip_vertical: bool,
    #[serde(default)]
    pub grayscale: bool,
    #[serde(default)]
    pub metadata_policy: MetadataPolicy,
    #[serde(default = "default_compress")]
    pub compress: bool,
}

fn default_compress() -> bool {
    true
}

impl Default for ImageTransformOptions {
    fn default() -> Self {
        Self {
            resize_mode: ResizeMode::None,
            maintain_aspect_ratio: true,
            do_not_upscale: true,
            format: OutputFormat::Original,
            quality: 80,
            lossless: false,
            rotation: 0,
            flip_horizontal: false,
            flip_vertical: false,
            grayscale: false,
            metadata_policy: MetadataPolicy::RemoveGps,
            compress: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewResult {
    pub data_url: String,
    pub original_width: u32,
    pub original_height: u32,
    pub new_width: u32,
    pub new_height: u32,
    pub original_bytes: u64,
    pub estimated_bytes: u64,
    pub saved_percentage: f32,
    pub transparency_loss_warning: bool,
}

#[cfg(target_os = "windows")]
pub fn decode_image_via_wic(path: &Path) -> Result<DynamicImage> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Graphics::Imaging::*;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let path_str = path.to_str().ok_or_else(|| anyhow!("Chemin invalide"))?;
        let hstring = HSTRING::from(path_str);

        let decoder = factory.CreateDecoderFromFilename(
            PCWSTR(hstring.as_ptr()),
            None,
            windows::Win32::Foundation::GENERIC_READ,
            WICDecodeMetadataCacheOnDemand,
        )?;

        let frame = decoder.GetFrame(0)?;
        let mut width = 0u32;
        let mut height = 0u32;
        frame.GetSize(&mut width, &mut height)?;

        let converter = factory.CreateFormatConverter()?;
        converter.Initialize(
            &frame,
            &GUID_WICPixelFormat32bppRGBA,
            WICBitmapDitherTypeNone,
            None,
            0.0,
            WICBitmapPaletteTypeCustom,
        )?;

        let stride = width * 4;
        let buffer_size = (stride * height) as usize;
        let mut buffer = vec![0u8; buffer_size];
        converter.CopyPixels(std::ptr::null(), stride, &mut buffer)?;

        let image_buffer = ImageBuffer::<image::Rgba<u8>, _>::from_raw(width, height, buffer)
            .ok_or_else(|| anyhow!("Impossible de créer le buffer d'image depuis WIC"))?;

        Ok(DynamicImage::ImageRgba8(image_buffer))
    }
}

pub fn load_dynamic_image(path: &Path) -> Result<(DynamicImage, ImageFormat)> {
    if let Ok(reader) = image::ImageReader::open(path).and_then(|r| r.with_guessed_format()) {
        if let Some(format) = reader.format() {
            if let Ok(img) = reader.decode() {
                return Ok((img, format));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(img) = decode_image_via_wic(path) {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let format = match ext.as_str() {
                "avif" => ImageFormat::Avif,
                "png" => ImageFormat::Png,
                _ => ImageFormat::Jpeg,
            };
            return Ok((img, format));
        }
    }

    Err(anyhow!("Format d'image non reconnu ou fichier illisible"))
}

pub fn apply_transformations(
    mut img: DynamicImage,
    options: &ImageTransformOptions,
) -> DynamicImage {
    match options.rotation % 360 {
        90 => img = img.rotate90(),
        180 => img = img.rotate180(),
        270 => img = img.rotate270(),
        _ => {}
    }

    if options.flip_horizontal {
        img = img.fliph();
    }
    if options.flip_vertical {
        img = img.flipv();
    }

    if options.grayscale {
        img = img.grayscale();
    }

    img
}

pub fn get_metadata(path: &Path) -> Result<ImageMetadata> {
    let file = File::open(path)?;
    let size_bytes = file.metadata()?.len();
    let (has_exif, has_gps) = metadata_manager::detect_file_metadata(path);

    if let Ok(reader) = image::ImageReader::open(path).and_then(|r| r.with_guessed_format()) {
        if let Some(format) = reader.format() {
            if let Ok((width, height)) = reader.into_dimensions() {
                let format_str = match format {
                    ImageFormat::Jpeg => "JPEG",
                    ImageFormat::Png => "PNG",
                    ImageFormat::WebP => "WebP",
                    ImageFormat::Bmp => "BMP",
                    ImageFormat::Gif => "GIF",
                    ImageFormat::Tiff => "TIFF",
                    ImageFormat::Avif => "AVIF",
                    _ => "Autre",
                }
                .to_string();

                let has_alpha = matches!(
                    format,
                    ImageFormat::Png | ImageFormat::WebP | ImageFormat::Gif | ImageFormat::Avif
                );

                return Ok(ImageMetadata {
                    width,
                    height,
                    format: format_str,
                    size_bytes,
                    has_alpha,
                    has_gps,
                    has_exif,
                });
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(img) = decode_image_via_wic(path) {
            let (width, height) = img.dimensions();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_uppercase();
            let format_str = if ext == "HEIC" || ext == "HEIF" {
                "HEIC".to_string()
            } else {
                ext
            };
            return Ok(ImageMetadata {
                width,
                height,
                format: format_str,
                size_bytes,
                has_alpha: img.color().has_alpha(),
                has_gps,
                has_exif,
            });
        }
    }

    Err(anyhow!("Format d'image non reconnu ou illisible"))
}

pub fn calculate_target_dimensions(
    orig_w: u32,
    orig_h: u32,
    options: &ImageTransformOptions,
) -> (u32, u32) {
    match &options.resize_mode {
        ResizeMode::None => (orig_w, orig_h),
        ResizeMode::Percentage { percent } => {
            let factor = (*percent as f64) / 100.0;
            let w = ((orig_w as f64) * factor).round().max(1.0) as u32;
            let h = ((orig_h as f64) * factor).round().max(1.0) as u32;
            (w, h)
        }
        ResizeMode::Exact { width, height } => {
            if options.maintain_aspect_ratio {
                let ratio = (orig_w as f64) / (orig_h as f64);
                if *width > 0 && *height == 0 {
                    let h = ((*width as f64) / ratio).round().max(1.0) as u32;
                    (*width, h)
                } else if *height > 0 && *width == 0 {
                    let w = ((*height as f64) * ratio).round().max(1.0) as u32;
                    (w, *height)
                } else {
                    let factor_w = (*width as f64) / (orig_w as f64);
                    let factor_h = (*height as f64) / (orig_h as f64);
                    let factor = factor_w.min(factor_h);
                    let target_w = ((orig_w as f64) * factor).round().max(1.0) as u32;
                    let target_h = ((orig_h as f64) * factor).round().max(1.0) as u32;
                    (target_w, target_h)
                }
            } else {
                let w = if *width > 0 { *width } else { orig_w };
                let h = if *height > 0 { *height } else { orig_h };
                (w, h)
            }
        }
        ResizeMode::MaxBounds {
            max_width,
            max_height,
        } => {
            if options.do_not_upscale && orig_w <= *max_width && orig_h <= *max_height {
                return (orig_w, orig_h);
            }
            let factor_w = (*max_width as f64) / (orig_w as f64);
            let factor_h = (*max_height as f64) / (orig_h as f64);
            let factor = factor_w.min(factor_h);
            if options.do_not_upscale && factor >= 1.0 {
                return (orig_w, orig_h);
            }
            let w = ((orig_w as f64) * factor).round().max(1.0) as u32;
            let h = ((orig_h as f64) * factor).round().max(1.0) as u32;
            (w, h)
        }
    }
}

pub fn process_image_to_memory(
    img: &DynamicImage,
    orig_format: ImageFormat,
    options: &ImageTransformOptions,
) -> Result<(Vec<u8>, ImageFormat, u32, u32, bool)> {
    let transformed = apply_transformations(img.clone(), options);
    let (t_w, t_h) = transformed.dimensions();

    let (new_w, new_h) = calculate_target_dimensions(t_w, t_h, options);

    // High quality resampling (Lanczos3)
    let processed_img = if new_w != t_w || new_h != t_h {
        transformed.resize_exact(new_w, new_h, FilterType::Lanczos3)
    } else {
        transformed
    };

    let target_format = match options.format {
        OutputFormat::Original => orig_format,
        OutputFormat::Jpeg => ImageFormat::Jpeg,
        OutputFormat::Png => ImageFormat::Png,
        OutputFormat::Webp => ImageFormat::WebP,
        OutputFormat::Avif => ImageFormat::Avif,
    };

    let mut transparency_warning = false;
    let final_img = match target_format {
        ImageFormat::Jpeg => {
            // Composite transparent alpha onto white background to prevent dark artifacts in JPEG
            if processed_img.color().has_alpha() {
                transparency_warning = true;
                let rgba = processed_img.to_rgba8();
                let mut rgb = ImageBuffer::new(new_w, new_h);
                for (x, y, pixel) in rgba.enumerate_pixels() {
                    let alpha = (pixel[3] as f32) / 255.0;
                    let r = ((pixel[0] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    let g = ((pixel[1] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    let b = ((pixel[2] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    rgb.put_pixel(x, y, Rgb([r, g, b]));
                }
                DynamicImage::ImageRgb8(rgb)
            } else {
                DynamicImage::ImageRgb8(processed_img.to_rgb8())
            }
        }
        _ => processed_img,
    };

    let mut output_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut output_bytes);

    let effective_quality = if !options.compress {
        100
    } else {
        options.quality.clamp(1, 100)
    };

    match target_format {
        ImageFormat::Jpeg => {
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, effective_quality);
            encoder.encode_image(&final_img)?;
        }
        ImageFormat::Png => {
            if options.lossless && options.compress {
                final_img.write_to(&mut cursor, ImageFormat::Png)?;
                // Lossless optimization via oxipng
                let oxi_options = oxipng::Options::from_preset(2);
                if let Ok(optimized) = oxipng::optimize_from_memory(&output_bytes, &oxi_options) {
                    output_bytes = optimized;
                }
            } else {
                final_img.write_to(&mut cursor, ImageFormat::Png)?;
            }
        }
        ImageFormat::WebP => {
            final_img.write_to(&mut cursor, ImageFormat::WebP)?;
        }
        ImageFormat::Avif => {
            let encoder = image::codecs::avif::AvifEncoder::new_with_speed_quality(
                &mut cursor,
                6,
                effective_quality,
            );
            let color = final_img.color();
            encoder.write_image(final_img.as_bytes(), new_w, new_h, color.into())?;
        }
        other => {
            final_img.write_to(&mut cursor, other)?;
        }
    }

    Ok((
        output_bytes,
        target_format,
        new_w,
        new_h,
        transparency_warning,
    ))
}

struct PreviewCacheEntry {
    path: PathBuf,
    modified: Option<std::time::SystemTime>,
    orig_w: u32,
    orig_h: u32,
    original_bytes: u64,
    orig_format: ImageFormat,
    base_preview: DynamicImage,
}

static PREVIEW_CACHE: Mutex<Option<PreviewCacheEntry>> = Mutex::new(None);

pub fn generate_preview(path: &Path, options: &ImageTransformOptions) -> Result<PreviewResult> {
    let metadata = std::fs::metadata(path)?;
    let file_bytes = metadata.len();
    let modified = metadata.modified().ok();

    let cached = {
        let guard = PREVIEW_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        guard.as_ref().and_then(|c| {
            if c.path == path && c.modified == modified {
                Some((
                    c.orig_w,
                    c.orig_h,
                    c.original_bytes,
                    c.orig_format,
                    c.base_preview.clone(),
                ))
            } else {
                None
            }
        })
    };

    let (orig_w, orig_h, original_bytes, orig_format, base_preview) = match cached {
        Some(data) => data,
        None => {
            let (img, orig_format) = load_dynamic_image(path)?;
            let (ow, oh) = img.dimensions();

            // Downscale to max 900px for instant responsive UI interactions
            let max_dim = 900u32;
            let base_preview = if ow > max_dim || oh > max_dim {
                img.thumbnail(max_dim, max_dim)
            } else {
                img
            };

            let mut guard = PREVIEW_CACHE.lock().unwrap_or_else(|e| e.into_inner());
            *guard = Some(PreviewCacheEntry {
                path: path.to_path_buf(),
                modified,
                orig_w: ow,
                orig_h: oh,
                original_bytes: file_bytes,
                orig_format,
                base_preview: base_preview.clone(),
            });

            (ow, oh, file_bytes, orig_format, base_preview)
        }
    };

    let transformed_preview = apply_transformations(base_preview, options);
    let (eff_orig_w, eff_orig_h) = if !options.rotation.is_multiple_of(180) {
        (orig_h, orig_w)
    } else {
        (orig_w, orig_h)
    };

    let (target_w, target_h) = calculate_target_dimensions(eff_orig_w, eff_orig_h, options);

    // Downscale preview image if target dimensions are smaller than base preview
    let (bw, bh) = transformed_preview.dimensions();
    let render_img = if target_w < bw || target_h < bh {
        let factor =
            ((target_w as f64) / (eff_orig_w as f64)).min((target_h as f64) / (eff_orig_h as f64));
        let rw = ((eff_orig_w as f64) * factor).round().max(1.0) as u32;
        let rh = ((eff_orig_h as f64) * factor).round().max(1.0) as u32;
        transformed_preview.resize_exact(rw.min(bw), rh.min(bh), FilterType::Triangle)
    } else {
        transformed_preview
    };

    let target_format = match options.format {
        OutputFormat::Original => orig_format,
        OutputFormat::Jpeg => ImageFormat::Jpeg,
        OutputFormat::Png => ImageFormat::Png,
        OutputFormat::Webp => ImageFormat::WebP,
        OutputFormat::Avif => ImageFormat::Avif,
    };

    let mut transparency_warning = false;
    let mut preview_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut preview_bytes);
    let mime_type: &'static str;

    let has_alpha = render_img.color().has_alpha();

    let effective_quality = if !options.compress {
        100
    } else {
        options.quality.clamp(1, 100)
    };

    match target_format {
        ImageFormat::Jpeg => {
            let final_img: DynamicImage = if has_alpha {
                transparency_warning = true;
                let rgba = render_img.to_rgba8();
                let (w, h) = rgba.dimensions();
                let mut rgb = ImageBuffer::new(w, h);
                for (x, y, pixel) in rgba.enumerate_pixels() {
                    let alpha = (pixel[3] as f32) / 255.0;
                    let r = ((pixel[0] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    let g = ((pixel[1] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    let b = ((pixel[2] as f32) * alpha + 255.0 * (1.0 - alpha)) as u8;
                    rgb.put_pixel(x, y, Rgb([r, g, b]));
                }
                DynamicImage::ImageRgb8(rgb)
            } else {
                DynamicImage::ImageRgb8(render_img.to_rgb8())
            };

            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, effective_quality);
            encoder.encode_image(&final_img)?;
            mime_type = "image/jpeg";
        }
        ImageFormat::Png => {
            render_img.write_to(&mut cursor, ImageFormat::Png)?;
            mime_type = "image/png";
        }
        ImageFormat::WebP | ImageFormat::Avif => {
            // Fast live preview: PNG if alpha is present, or quality-adjusted JPEG for sub-3ms preview
            if has_alpha {
                render_img.write_to(&mut cursor, ImageFormat::Png)?;
                mime_type = "image/png";
            } else {
                let rgb_img = DynamicImage::ImageRgb8(render_img.to_rgb8());
                let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut cursor,
                    effective_quality,
                );
                encoder.encode_image(&rgb_img)?;
                mime_type = "image/jpeg";
            }
        }
        other => {
            render_img.write_to(&mut cursor, other)?;
            mime_type = "image/png";
        }
    }

    // Estimate output size based on target pixel area and format ratio
    let area_ratio = ((target_w as f64) * (target_h as f64)) / ((orig_w as f64) * (orig_h as f64));
    let (estimated_bytes, saved_percentage) = if !options.compress {
        let is_format_same = matches!(options.format, OutputFormat::Original);
        let has_pixel_transformations = options.rotation != 0
            || options.flip_horizontal
            || options.flip_vertical
            || options.grayscale
            || !matches!(options.resize_mode, ResizeMode::None);

        if is_format_same && !has_pixel_transformations {
            (original_bytes, 0.0)
        } else {
            let compression_ratio = match target_format {
                ImageFormat::Avif => 0.58,
                ImageFormat::WebP => 0.70,
                ImageFormat::Png => 0.90,
                ImageFormat::Jpeg => 0.80,
                _ => 0.80,
            };
            let est = ((original_bytes as f64) * area_ratio * compression_ratio)
                .round()
                .max(1024.0) as u64;
            let saved = if original_bytes > 0 {
                let diff = (original_bytes as f64) - (est as f64);
                ((diff / (original_bytes as f64)) * 100.0).max(0.0) as f32
            } else {
                0.0
            };
            (est, saved)
        }
    } else {
        let q_ratio = (options.quality as f64) / 100.0;
        let compression_ratio = match target_format {
            ImageFormat::Avif => 0.18 + q_ratio * 0.40,
            ImageFormat::WebP => 0.25 + q_ratio * 0.45,
            ImageFormat::Png => {
                if options.lossless {
                    0.70
                } else {
                    0.85
                }
            }
            ImageFormat::Jpeg => 0.15 + q_ratio * 0.65,
            _ => 0.30 + q_ratio * 0.50,
        };
        let est = ((original_bytes as f64) * area_ratio * compression_ratio)
            .round()
            .max(1024.0) as u64;

        let saved = if original_bytes > 0 {
            let diff = (original_bytes as f64) - (est as f64);
            ((diff / (original_bytes as f64)) * 100.0).max(0.0) as f32
        } else {
            0.0
        };
        (est, saved)
    };

    let b64 = BASE64.encode(&preview_bytes);
    let data_url = format!("data:{};base64,{}", mime_type, b64);

    Ok(PreviewResult {
        data_url,
        original_width: eff_orig_w,
        original_height: eff_orig_h,
        new_width: target_w,
        new_height: target_h,
        original_bytes,
        estimated_bytes,
        saved_percentage,
        transparency_loss_warning: transparency_warning,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_dimensions_percentage() {
        let opts = ImageTransformOptions {
            resize_mode: ResizeMode::Percentage { percent: 50 },
            ..Default::default()
        };
        let (w, h) = calculate_target_dimensions(4000, 3000, &opts);
        assert_eq!((w, h), (2000, 1500));
    }

    #[test]
    fn test_calculate_dimensions_max_bounds_aspect_ratio() {
        let opts = ImageTransformOptions {
            resize_mode: ResizeMode::MaxBounds {
                max_width: 1920,
                max_height: 1080,
            },
            maintain_aspect_ratio: true,
            do_not_upscale: true,
            ..Default::default()
        };
        let (w, h) = calculate_target_dimensions(4000, 2000, &opts);
        assert_eq!((w, h), (1920, 960));
    }

    #[test]
    fn test_do_not_upscale() {
        let opts = ImageTransformOptions {
            resize_mode: ResizeMode::MaxBounds {
                max_width: 1920,
                max_height: 1080,
            },
            maintain_aspect_ratio: true,
            do_not_upscale: true,
            ..Default::default()
        };
        let (w, h) = calculate_target_dimensions(800, 600, &opts);
        assert_eq!((w, h), (800, 600));
    }

    #[test]
    fn test_transformations_rotation() {
        let img = DynamicImage::new_rgb8(100, 50);
        let opts_90 = ImageTransformOptions {
            rotation: 90,
            ..Default::default()
        };
        let res_90 = apply_transformations(img.clone(), &opts_90);
        assert_eq!(res_90.dimensions(), (50, 100));

        let opts_180 = ImageTransformOptions {
            rotation: 180,
            ..Default::default()
        };
        let res_180 = apply_transformations(img.clone(), &opts_180);
        assert_eq!(res_180.dimensions(), (100, 50));

        let opts_270 = ImageTransformOptions {
            rotation: 270,
            ..Default::default()
        };
        let res_270 = apply_transformations(img.clone(), &opts_270);
        assert_eq!(res_270.dimensions(), (50, 100));
    }

    #[test]
    fn test_transformations_flips() {
        let mut img = DynamicImage::new_rgb8(2, 1);
        img.as_mut_rgb8().unwrap().put_pixel(0, 0, Rgb([255, 0, 0]));
        img.as_mut_rgb8().unwrap().put_pixel(1, 0, Rgb([0, 255, 0]));

        let opts_flip = ImageTransformOptions {
            flip_horizontal: true,
            ..Default::default()
        };
        let res_flip = apply_transformations(img, &opts_flip);
        let p0 = res_flip.as_rgb8().unwrap().get_pixel(0, 0);
        let p1 = res_flip.as_rgb8().unwrap().get_pixel(1, 0);
        assert_eq!(*p0, Rgb([0, 255, 0]));
        assert_eq!(*p1, Rgb([255, 0, 0]));
    }

    #[test]
    fn test_transformations_grayscale() {
        let mut img = DynamicImage::new_rgb8(1, 1);
        img.as_mut_rgb8().unwrap().put_pixel(0, 0, Rgb([255, 0, 0]));

        let opts_gray = ImageTransformOptions {
            grayscale: true,
            ..Default::default()
        };
        let res_gray = apply_transformations(img, &opts_gray);
        let p = res_gray.as_luma8().unwrap().get_pixel(0, 0);
        // Red 255 converted to luma is ~54
        assert!(p[0] > 0);
    }

    #[test]
    fn test_avif_encoding_full() {
        let img = DynamicImage::new_rgb8(100, 100);
        let opts = ImageTransformOptions {
            format: OutputFormat::Avif,
            quality: 75,
            ..Default::default()
        };
        let res = process_image_to_memory(&img, ImageFormat::Jpeg, &opts);
        assert!(res.is_ok());
        let (bytes, format, w, h, _) = res.unwrap();
        assert_eq!(format, ImageFormat::Avif);
        assert_eq!((w, h), (100, 100));
        assert!(!bytes.is_empty());
    }

    #[test]
    fn test_compress_disabled() {
        let img = DynamicImage::new_rgb8(50, 50);
        let opts = ImageTransformOptions {
            compress: false,
            format: OutputFormat::Jpeg,
            ..Default::default()
        };
        let res = process_image_to_memory(&img, ImageFormat::Jpeg, &opts);
        assert!(res.is_ok());
        let (bytes, format, w, h, _) = res.unwrap();
        assert_eq!(format, ImageFormat::Jpeg);
        assert_eq!((w, h), (50, 50));
        assert!(!bytes.is_empty());
    }
}
