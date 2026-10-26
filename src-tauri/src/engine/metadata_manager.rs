use anyhow::Result;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub enum MetadataPolicy {
    KeepAll,
    #[default]
    RemoveGps,
    RemoveAll,
}

/// Detects if an image contains EXIF metadata and GPS coordinates.
/// Returns (has_exif, has_gps).
pub fn detect_file_metadata(path: &Path) -> (bool, bool) {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (false, false),
    };

    let mut header = [0u8; 12];
    if file.read_exact(&mut header).is_err() {
        return (false, false);
    }
    let _ = file.seek(SeekFrom::Start(0));

    // JPEG
    if header[0] == 0xFF && header[1] == 0xD8 {
        return detect_jpeg_metadata(&mut file);
    }

    // PNG
    if &header[0..8] == b"\x89PNG\r\n\x1a\n" {
        return detect_png_metadata(&mut file);
    }

    // WebP
    if &header[0..4] == b"RIFF" && &header[8..12] == b"WEBP" {
        return detect_webp_metadata(&mut file);
    }

    (false, false)
}

fn detect_jpeg_metadata(file: &mut File) -> (bool, bool) {
    let mut buf = vec![0u8; 1024 * 512]; // Read up to first 512KB for headers
    let bytes_read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return (false, false),
    };
    buf.truncate(bytes_read);

    let mut has_exif = false;
    let mut has_gps = false;

    let mut i = 2; // Skip SOI (0xFF, 0xD8)
    while i + 4 <= buf.len() {
        if buf[i] != 0xFF {
            break;
        }
        let marker = buf[i + 1];
        if marker == 0xDA || marker == 0xD9 {
            // SOS (Start of Scan) or EOI: headers end here
            break;
        }
        let length = ((buf[i + 2] as usize) << 8) | (buf[i + 3] as usize);
        if length < 2 || i + 2 + length > buf.len() {
            break;
        }

        // APP1 (Exif or XMP)
        if marker == 0xE1 {
            let payload = &buf[i + 4..i + 2 + length];
            if payload.starts_with(b"Exif\0\0") {
                has_exif = true;
                if inspect_exif_has_gps(&payload[6..]) {
                    has_gps = true;
                }
            } else if payload.starts_with(b"http://ns.adobe.com/xap/1.0/\0") {
                // Check XMP text for GPS coordinates
                if let Ok(text) = std::str::from_utf8(payload) {
                    if text.contains("GPSLatitude") || text.contains("GPSLongitude") {
                        has_gps = true;
                    }
                }
            }
        }

        i += 2 + length;
    }

    (has_exif, has_gps)
}

fn detect_png_metadata(file: &mut File) -> (bool, bool) {
    let mut buf = vec![0u8; 1024 * 256];
    let bytes_read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return (false, false),
    };
    buf.truncate(bytes_read);

    let mut has_exif = false;
    let mut has_gps = false;

    let mut i = 8; // Skip PNG 8-byte signature
    while i + 8 <= buf.len() {
        let length = u32::from_be_bytes([buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]) as usize;
        let chunk_type = &buf[i + 4..i + 8];
        let data_start = i + 8;
        let data_end = data_start + length;

        if chunk_type == b"eXIf" && data_end <= buf.len() {
            has_exif = true;
            if inspect_exif_has_gps(&buf[data_start..data_end]) {
                has_gps = true;
            }
        }

        i = data_end + 4; // Skip CRC (4 bytes)
    }

    (has_exif, has_gps)
}

fn detect_webp_metadata(file: &mut File) -> (bool, bool) {
    let mut buf = vec![0u8; 1024 * 256];
    let bytes_read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return (false, false),
    };
    buf.truncate(bytes_read);

    let mut has_exif = false;
    let mut has_gps = false;

    let mut i = 12; // Skip RIFF header (12 bytes)
    while i + 8 <= buf.len() {
        let chunk_type = &buf[i..i + 4];
        let length = u32::from_le_bytes([buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]]) as usize;
        let data_start = i + 8;
        let data_end = data_start + length;

        if chunk_type == b"EXIF" && data_end <= buf.len() {
            has_exif = true;
            let payload = &buf[data_start..data_end];
            let tiff = if payload.starts_with(b"Exif\0\0") {
                &payload[6..]
            } else {
                payload
            };
            if inspect_exif_has_gps(tiff) {
                has_gps = true;
            }
        }

        let pad = length % 2;
        match data_end.checked_add(pad) {
            Some(next_i) => i = next_i,
            None => break,
        }
    }

    (has_exif, has_gps)
}

/// Inspects raw TIFF bytes to determine whether tag 0x8825 (GPSInfo) exists in IFD0.
pub fn inspect_exif_has_gps(tiff: &[u8]) -> bool {
    if tiff.len() < 8 {
        return false;
    }

    let is_le = match &tiff[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return false,
    };

    let read_u16 = |offset: usize| -> Option<u16> {
        if offset + 2 > tiff.len() {
            return None;
        }
        let b = [tiff[offset], tiff[offset + 1]];
        Some(if is_le {
            u16::from_le_bytes(b)
        } else {
            u16::from_be_bytes(b)
        })
    };

    let read_u32 = |offset: usize| -> Option<u32> {
        if offset + 4 > tiff.len() {
            return None;
        }
        let b = [
            tiff[offset],
            tiff[offset + 1],
            tiff[offset + 2],
            tiff[offset + 3],
        ];
        Some(if is_le {
            u32::from_le_bytes(b)
        } else {
            u32::from_be_bytes(b)
        })
    };

    let ifd0_offset = match read_u32(4) {
        Some(off) => off as usize,
        None => return false,
    };

    let num_entries = match read_u16(ifd0_offset) {
        Some(n) => n as usize,
        None => return false,
    };

    for i in 0..num_entries {
        let entry_offset = ifd0_offset + 2 + i * 12;
        if let Some(tag) = read_u16(entry_offset) {
            if tag == 0x8825 {
                return true;
            }
        } else {
            break;
        }
    }

    false
}

/// Extracts the raw EXIF payload (with "Exif\0\0" prefix) from an input file.
pub fn extract_exif_payload(path: &Path) -> Option<Vec<u8>> {
    let mut file = File::open(path).ok()?;
    // [PERF-02] Read up to first 512KB for headers instead of loading multi-GB file into RAM
    let mut buf = vec![0u8; 1024 * 512];
    let n = file.read(&mut buf).ok()?;
    buf.truncate(n);

    if buf.len() < 4 {
        return None;
    }

    // JPEG
    if buf[0] == 0xFF && buf[1] == 0xD8 {
        let mut i = 2;
        while i + 4 <= buf.len() {
            if buf[i] != 0xFF {
                break;
            }
            let marker = buf[i + 1];
            if marker == 0xDA || marker == 0xD9 {
                break;
            }
            let length = ((buf[i + 2] as usize) << 8) | (buf[i + 3] as usize);
            if length < 2 || i + 2 + length > buf.len() {
                break;
            }

            if marker == 0xE1 {
                let payload = &buf[i + 4..i + 2 + length];
                if payload.starts_with(b"Exif\0\0") {
                    return Some(payload.to_vec());
                }
            }
            i += 2 + length;
        }
    }

    // WebP
    if buf.starts_with(b"RIFF") && buf.len() > 12 && &buf[8..12] == b"WEBP" {
        let mut i = 12;
        while i + 8 <= buf.len() {
            let chunk_type = &buf[i..i + 4];
            let length =
                u32::from_le_bytes([buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]]) as usize;
            let data_start = i + 8;
            let data_end = data_start + length;
            if chunk_type == b"EXIF" && data_end <= buf.len() {
                let payload = &buf[data_start..data_end];
                if payload.starts_with(b"Exif\0\0") {
                    return Some(payload.to_vec());
                } else {
                    let mut prefixed = b"Exif\0\0".to_vec();
                    prefixed.extend_from_slice(payload);
                    return Some(prefixed);
                }
            }
            i = data_end + (length % 2);
        }
    }

    // PNG
    if buf.starts_with(b"\x89PNG\r\n\x1a\n") {
        let mut i = 8;
        while i + 8 <= buf.len() {
            let length = u32::from_be_bytes([buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]) as usize;
            let chunk_type = &buf[i + 4..i + 8];
            let data_start = i + 8;
            let data_end = data_start + length;
            if chunk_type == b"eXIf" && data_end <= buf.len() {
                let payload = &buf[data_start..data_end];
                let mut prefixed = b"Exif\0\0".to_vec();
                prefixed.extend_from_slice(payload);
                return Some(prefixed);
            }
            i = data_end + 4;
        }
    }

    None
}

/// Creates a sanitized copy of the EXIF payload with tag 0x8825 (GPSInfo) removed
/// and all underlying GPS data zeroed out.
pub fn strip_gps_from_exif(exif_payload: &[u8]) -> Vec<u8> {
    if !exif_payload.starts_with(b"Exif\0\0") || exif_payload.len() < 14 {
        return exif_payload.to_vec();
    }

    let mut result = exif_payload.to_vec();
    let tiff_start = 6;
    let tiff_len = result.len() - tiff_start;

    let is_le = match &result[tiff_start..tiff_start + 2] {
        b"II" => true,
        b"MM" => false,
        _ => return result,
    };

    let read_u16 = |slice: &[u8], offset: usize| -> Option<u16> {
        if offset + 2 > slice.len() {
            return None;
        }
        let b = [slice[offset], slice[offset + 1]];
        Some(if is_le {
            u16::from_le_bytes(b)
        } else {
            u16::from_be_bytes(b)
        })
    };

    let read_u32 = |slice: &[u8], offset: usize| -> Option<u32> {
        if offset + 4 > slice.len() {
            return None;
        }
        let b = [
            slice[offset],
            slice[offset + 1],
            slice[offset + 2],
            slice[offset + 3],
        ];
        Some(if is_le {
            u32::from_le_bytes(b)
        } else {
            u32::from_be_bytes(b)
        })
    };

    let tiff = &result[tiff_start..];
    let ifd0_offset = match read_u32(tiff, 4) {
        Some(off) => off as usize,
        None => return result,
    };

    let num_entries = match read_u16(tiff, ifd0_offset) {
        Some(n) => n as usize,
        None => return result,
    };

    let mut gps_tag_index: Option<usize> = None;
    let mut gps_sub_ifd_offset: Option<usize> = None;
    let mut zero_ranges: Vec<(usize, usize)> = Vec::new();

    {
        let tiff = &result[tiff_start..];
        for i in 0..num_entries {
            let entry_offset = ifd0_offset + 2 + i * 12;
            if let Some(tag) = read_u16(tiff, entry_offset) {
                if tag == 0x8825 {
                    gps_tag_index = Some(i);
                    if let Some(val_off) = read_u32(tiff, entry_offset + 8) {
                        gps_sub_ifd_offset = Some(val_off as usize);
                    }
                    break;
                }
            }
        }

        // Collect GPS sub-IFD entries and value ranges to zero
        if let Some(gps_off) = gps_sub_ifd_offset {
            if gps_off < tiff_len {
                if let Some(gps_count) = read_u16(tiff, gps_off) {
                    let gps_count = gps_count as usize;
                    for j in 0..gps_count {
                        let entry_off = gps_off + 2 + j * 12;
                        if entry_off + 12 <= tiff_len {
                            if let (Some(typ), Some(cnt), Some(v_off)) = (
                                read_u16(tiff, entry_off + 2),
                                read_u32(tiff, entry_off + 4),
                                read_u32(tiff, entry_off + 8),
                            ) {
                                let type_size = match typ {
                                    1 | 2 | 6 | 7 => 1,
                                    3 | 8 => 2,
                                    4 | 9 | 11 => 4,
                                    5 | 10 | 12 => 8,
                                    _ => 1,
                                };
                                let total_bytes = (cnt as usize).saturating_mul(type_size);
                                if total_bytes > 4 && v_off >= 8 && (v_off as usize) < tiff_len {
                                    let target_start = tiff_start + (v_off as usize);
                                    let target_end = target_start + total_bytes;
                                    zero_ranges.push((target_start, target_end));
                                }
                            }
                        }
                    }
                    // Zero out the GPS IFD directory itself
                    let gps_ifd_start = tiff_start + gps_off;
                    let gps_ifd_end = gps_ifd_start + 2 + gps_count * 12 + 4;
                    zero_ranges.push((gps_ifd_start, gps_ifd_end));
                }
            }
        }
    }

    // Now zero out collected GPS ranges
    for (start, end) in zero_ranges {
        let s = start.min(result.len());
        let e = end.min(result.len());
        if s < e {
            result[s..e].fill(0);
        }
    }

    // Remove the GPS entry from IFD0 by shifting subsequent entries left by 12 bytes
    if let Some(idx) = gps_tag_index {
        let abs_ifd0 = tiff_start + ifd0_offset;
        let entry_start = abs_ifd0 + 2 + idx * 12;
        let next_entry_start = entry_start + 12;

        let end_of_ifd = abs_ifd0 + 2 + num_entries * 12 + 4; // includes 4-byte next-IFD offset
        if next_entry_start < end_of_ifd && end_of_ifd <= result.len() {
            result.copy_within(next_entry_start..end_of_ifd, entry_start);
            // Zero out trailing 12 bytes
            result[end_of_ifd - 12..end_of_ifd].fill(0);
        } else if entry_start + 12 <= result.len() {
            result[entry_start..entry_start + 12].fill(0);
        }

        // Decrement num_entries in IFD0
        let new_count = (num_entries.saturating_sub(1)) as u16;
        let count_bytes = if is_le {
            new_count.to_le_bytes()
        } else {
            new_count.to_be_bytes()
        };
        result[abs_ifd0] = count_bytes[0];
        result[abs_ifd0 + 1] = count_bytes[1];
    }

    result
}

/// Applies the metadata policy to the output file bytes.
pub fn apply_metadata_policy(
    source_path: &Path,
    output_bytes: &mut Vec<u8>,
    output_ext: &str,
    policy: MetadataPolicy,
) -> Result<()> {
    if policy == MetadataPolicy::RemoveAll {
        // Output bytes generated by image-rs already have all EXIF stripped
        return Ok(());
    }

    let raw_exif = match extract_exif_payload(source_path) {
        Some(e) => e,
        None => return Ok(()), // Source had no EXIF to preserve
    };

    let final_exif = match policy {
        MetadataPolicy::KeepAll => raw_exif,
        MetadataPolicy::RemoveGps => strip_gps_from_exif(&raw_exif),
        MetadataPolicy::RemoveAll => return Ok(()),
    };

    let ext = output_ext.to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => {
            inject_exif_into_jpeg(output_bytes, &final_exif)?;
        }
        "png" => {
            inject_exif_into_png(output_bytes, &final_exif)?;
        }
        _ => {}
    }

    Ok(())
}

/// Injects an EXIF payload into JPEG bytes immediately after the SOI marker (0xFF, 0xD8).
pub fn inject_exif_into_jpeg(jpeg_bytes: &mut Vec<u8>, exif_payload: &[u8]) -> Result<()> {
    if jpeg_bytes.len() < 2 || jpeg_bytes[0] != 0xFF || jpeg_bytes[1] != 0xD8 {
        return Ok(());
    }

    // Segment length = 2 bytes (for length field) + payload length
    let seg_len = (exif_payload.len() + 2) as u16;
    let seg_len_bytes = seg_len.to_be_bytes();

    let mut segment = Vec::with_capacity(4 + exif_payload.len());
    segment.push(0xFF);
    segment.push(0xE1);
    segment.push(seg_len_bytes[0]);
    segment.push(seg_len_bytes[1]);
    segment.extend_from_slice(exif_payload);

    // Insert right after SOI (index 2)
    jpeg_bytes.splice(2..2, segment);

    Ok(())
}

/// Injects raw TIFF metadata as an eXIf chunk into PNG bytes before IEND.
pub fn inject_exif_into_png(png_bytes: &mut Vec<u8>, exif_payload: &[u8]) -> Result<()> {
    if !png_bytes.starts_with(b"\x89PNG\r\n\x1a\n") || png_bytes.len() < 12 {
        return Ok(());
    }

    let tiff_data = if exif_payload.starts_with(b"Exif\0\0") {
        &exif_payload[6..]
    } else {
        exif_payload
    };

    if tiff_data.is_empty() {
        return Ok(());
    }

    let len = tiff_data.len() as u32;
    let len_bytes = len.to_be_bytes();

    let mut chunk = Vec::with_capacity(12 + tiff_data.len());
    chunk.extend_from_slice(&len_bytes);
    chunk.extend_from_slice(b"eXIf");
    chunk.extend_from_slice(tiff_data);

    // CRC32 calculation using flate2
    let mut crc = flate2::Crc::new();
    crc.update(b"eXIf");
    crc.update(tiff_data);
    chunk.extend_from_slice(&crc.sum().to_be_bytes());

    // Find IEND chunk index and insert right before it
    if let Some(iend_pos) = png_bytes.windows(8).position(|w| &w[4..8] == b"IEND") {
        png_bytes.splice(iend_pos..iend_pos, chunk);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inspect_exif_has_gps_none() {
        // Minimal TIFF header with empty IFD0
        let tiff = vec![
            b'I', b'I', 42, 0, // Header
            8, 0, 0, 0, // Offset to IFD0
            0, 0, // 0 entries
            0, 0, 0, 0, // next IFD = 0
        ];
        assert!(!inspect_exif_has_gps(&tiff));
    }

    #[test]
    fn test_inspect_exif_has_gps_and_strip() {
        // Construct a synthetic TIFF with Make (0x010F) and GPSInfo (0x8825)
        let tiff = vec![
            b'I', b'I', 42, 0, // Header
            8, 0, 0, 0, // Offset to IFD0 (8)
            2, 0, // 2 entries in IFD0
            // Entry 0: Tag 0x010F (Make), type 2 (ASCII), count 4, val "ABC\0"
            0x0F, 0x01, 2, 0, 4, 0, 0, 0, b'A', b'B', b'C', 0,
            // Entry 1: Tag 0x8825 (GPSInfo), type 4 (LONG), count 1, offset 40
            0x25, 0x88, 4, 0, 1, 0, 0, 0, 40, 0, 0, 0, 0, 0, 0,
            0, // Next IFD = 0 (offset 34..38)
            0, 0, // Padding to align to offset 40 (offset 38..40)
            // At offset 40: GPS IFD
            1, 0, // 1 entry in GPS IFD
            // GPSLatitudeRef (tag 0x0001)
            1, 0, 2, 0, 2, 0, 0, 0, b'N', 0, 0, 0, 0, 0, 0, 0,
        ];

        let mut payload = b"Exif\0\0".to_vec();
        payload.extend_from_slice(&tiff);

        assert!(inspect_exif_has_gps(&tiff));

        // Strip GPS
        let stripped = strip_gps_from_exif(&payload);
        let stripped_tiff = &stripped[6..];

        // Should no longer report GPS
        assert!(!inspect_exif_has_gps(stripped_tiff));

        // Number of IFD0 entries should now be 1
        let count = u16::from_le_bytes([stripped_tiff[8], stripped_tiff[9]]);
        assert_eq!(count, 1);

        // Entry 0 should still be Make
        let tag0 = u16::from_le_bytes([stripped_tiff[10], stripped_tiff[11]]);
        assert_eq!(tag0, 0x010F);
    }

    #[test]
    fn test_inject_exif_into_jpeg() {
        let mut jpeg = vec![0xFF, 0xD8, 0xFF, 0xD9]; // SOI + EOI
        let payload = b"Exif\0\0dummydata";
        let res = inject_exif_into_jpeg(&mut jpeg, payload);
        assert!(res.is_ok());

        assert_eq!(jpeg[0], 0xFF);
        assert_eq!(jpeg[1], 0xD8);
        assert_eq!(jpeg[2], 0xFF);
        assert_eq!(jpeg[3], 0xE1);
        let len = ((jpeg[4] as usize) << 8) | (jpeg[5] as usize);
        assert_eq!(len, payload.len() + 2);
        assert_eq!(&jpeg[6..6 + payload.len()], payload);
    }
}
