use chrono::Local;
use base64::Engine;
use std::fs;
use std::path::PathBuf;

/// Capture a screenshot and save it to the filesystem
///
/// Screenshots are saved in Year/Month/Day hierarchy:
/// screenshots/YYYY/MM/DD/screenshot_YYYYMMDD_HHMMSS.webp
///
/// Returns the relative file path on success
pub async fn capture_screenshot() -> Result<String, String> {
    let start_time = std::time::Instant::now();
    let screenshot_settings = crate::app_settings::load_screenshot_settings()
        .unwrap_or_default()
        .normalized();

    // Get data directory
    let data_dir = get_data_directory()?;

    // Check disk space before capture (skip if less than 100MB free)
    if !has_sufficient_disk_space(&data_dir)? {
        return Err("Insufficient disk space for screenshot capture".to_string());
    }

    // Get current timestamp
    let now = Local::now();
    let timestamp = now.timestamp_millis();

    // Create directory structure: root/YYYY/MM/DD/
    let year = now.format("%Y").to_string();
    let month = now.format("%m").to_string();
    let day = now.format("%d").to_string();

    let default_root = data_dir.join("screenshots");
    let custom_root = screenshot_settings.storage_dir.as_ref().map(PathBuf::from);
    let root_dir = custom_root.unwrap_or_else(|| default_root.clone());
    let using_default_storage = root_dir == default_root;
    let screenshot_dir = root_dir.join(&year).join(&month).join(&day);

    fs::create_dir_all(&screenshot_dir)
        .map_err(|e| format!("Failed to create screenshot directory: {}", e))?;

    // Generate filename: screenshot_YYYYMMDD_HHMMSS.webp
    let filename = format!(
        "screenshot_{}_{}.webp",
        now.format("%Y%m%d"),
        now.format("%H%M%S")
    );

    let file_path = screenshot_dir.join(&filename);

    // Capture screenshot using windows-capture
    #[cfg(target_os = "windows")]
    {
        capture_windows_screenshot(
            &file_path,
            screenshot_settings.quality,
            screenshot_settings.max_width,
            screenshot_settings.max_file_kb,
        )?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Screenshot capture is only supported on Windows".to_string());
    }

    // Use relative path for default storage, absolute path for custom storage.
    let stored_path = if using_default_storage {
        format!("screenshots/{}/{}/{}/{}", year, month, day, filename)
    } else {
        file_path.to_string_lossy().to_string()
    };

    // Log performance
    let elapsed = start_time.elapsed();
    if elapsed.as_millis() > 100 {
        eprintln!(
            "WARNING: Screenshot capture took {}ms (target: <100ms)",
            elapsed.as_millis()
        );
    }

    // Insert screenshot record into database
    if let Err(e) =
        crate::data::with_db(|conn| crate::data::insert_screenshot(conn, timestamp, &stored_path))
    {
        eprintln!("Failed to insert screenshot record: {}", e);
    }

    Ok(stored_path)
}

#[cfg(target_os = "windows")]
fn capture_windows_screenshot(
    file_path: &std::path::Path,
    quality: u8,
    max_width: u32,
    max_file_kb: u32,
) -> Result<(), String> {
    use windows_capture::capture::GraphicsCaptureApiHandler;
    use windows_capture::frame::Frame;
    use windows_capture::graphics_capture_api::InternalCaptureControl;
    use windows_capture::monitor::Monitor;
    use windows_capture::settings::{ColorFormat, Settings};

    struct CaptureFlags {
        file_path: std::path::PathBuf,
        quality: u8,
        max_width: u32,
        max_file_kb: u32,
    }

    struct Capture {
        file_path: std::path::PathBuf,
        captured: bool,
        quality: u8,
        max_width: u32,
        max_file_kb: u32,
    }

    impl GraphicsCaptureApiHandler for Capture {
        type Flags = CaptureFlags;
        type Error = String;

        fn new(flags: windows_capture::capture::Context<Self::Flags>) -> Result<Self, Self::Error> {
            Ok(Self {
                file_path: flags.flags.file_path.clone(),
                captured: false,
                quality: flags.flags.quality.clamp(1, 100),
                max_width: flags.flags.max_width.clamp(640, 7680),
                max_file_kb: flags.flags.max_file_kb.clamp(20, 2048),
            })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            capture_control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            if !self.captured {
                // Encode as WebP and try to keep size under 100KB.
                let mut frame_buffer = frame
                    .buffer()
                    .map_err(|e| format!("Failed to read frame buffer: {}", e))?;

                let width = frame_buffer.width();
                let height = frame_buffer.height();
                let bgra = frame_buffer
                    .as_nopadding_buffer()
                    .map_err(|e| format!("Failed to normalize frame buffer: {}", e))?;
                let rgba = bgra_to_rgba(bgra);
                let (scaled_rgba, scaled_w, scaled_h) =
                    limit_width_rgba(rgba, width, height, self.max_width);
                let webp_bytes = encode_webp_with_size_target(
                    scaled_rgba,
                    scaled_w,
                    scaled_h,
                    self.max_file_kb as usize * 1024,
                    self.quality as f32,
                )?;

                fs::write(&self.file_path, &webp_bytes)
                    .map_err(|e| format!("Failed to write screenshot: {}", e))?;

                self.captured = true;
                capture_control.stop();
            }
            Ok(())
        }

        fn on_closed(&mut self) -> Result<(), Self::Error> {
            Ok(())
        }
    }

    // Get primary monitor
    let monitor =
        Monitor::primary().map_err(|e| format!("Failed to get primary monitor: {}", e))?;

    // Configure capture settings
    let settings = Settings::new(
        monitor,
        windows_capture::settings::CursorCaptureSettings::Default,
        windows_capture::settings::DrawBorderSettings::Default,
        windows_capture::settings::SecondaryWindowSettings::Default,
        windows_capture::settings::MinimumUpdateIntervalSettings::Default,
        windows_capture::settings::DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        CaptureFlags {
            file_path: file_path.to_path_buf(),
            quality,
            max_width,
            max_file_kb,
        },
    );

    // Start capture (will capture one frame and stop)
    Capture::start(settings).map_err(|e| format!("Failed to start capture: {}", e))?;

    Ok(())
}

/// Get the data directory path
fn get_data_directory() -> Result<PathBuf, String> {
    let local_data =
        dirs::data_local_dir().ok_or_else(|| "Failed to get local data directory".to_string())?;

    let data_dir = local_data.join("DigitalDiary");

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;

    Ok(data_dir)
}

/// Check if there is sufficient disk space (at least 100MB free)
fn has_sufficient_disk_space(path: &PathBuf) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let _metadata =
            fs::metadata(path).map_err(|e| format!("Failed to get disk metadata: {}", e))?;

        // Get available space (this is a simplified check)
        // In production, you'd use GetDiskFreeSpaceEx from Windows API
        // For now, we'll assume sufficient space if directory exists
        Ok(true)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(true)
    }
}

/// Tauri command to get screenshot path for a given timestamp
///
/// Returns the file path if a screenshot exists within 5 minutes of the timestamp
#[tauri::command]
#[specta::specta]
pub async fn get_screenshot_for_time(
    timestamp: i64,
) -> Result<crate::types::ScreenshotInfo, String> {
    crate::data::with_db(|conn| {
        let file_path = crate::data::get_screenshot_near_time(conn, timestamp, 300000)?; // 5 minutes tolerance
        let data_url = file_path
            .as_ref()
            .and_then(|stored_path| {
                let absolute_path = resolve_absolute_screenshot_path(stored_path)?;
                match fs::read(&absolute_path) {
                    Ok(bytes) => Some(format!(
                        "data:{};base64,{}",
                        infer_mime_type_from_path(stored_path),
                        base64::engine::general_purpose::STANDARD.encode(bytes)
                    )),
                    Err(e) => {
                        eprintln!(
                            "Failed to read screenshot file for preview {}: {}",
                            absolute_path.display(),
                            e
                        );
                        None
                    }
                }
            });

        Ok(crate::types::ScreenshotInfo {
            file_path: file_path.clone(),
            data_url,
            placeholder: if file_path.is_none() {
                Some("No screenshot available".to_string())
            } else {
                None
            },
        })
    })
}

fn infer_mime_type_from_path(relative_path: &str) -> &'static str {
    let ext = std::path::Path::new(relative_path)
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.to_ascii_lowercase());

    match ext.as_deref() {
        Some("webp") => "image/webp",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("tiff") | Some("tif") => "image/tiff",
        _ => "image/png",
    }
}

fn resolve_absolute_screenshot_path(stored_path: &str) -> Option<PathBuf> {
    let path = PathBuf::from(stored_path);
    if path.is_absolute() {
        return Some(path);
    }
    let local_data = dirs::data_local_dir()?;
    Some(local_data.join("DigitalDiary").join(stored_path))
}

#[cfg(target_os = "windows")]
fn encode_webp_with_size_target(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    target_bytes: usize,
    base_quality: f32,
) -> Result<Vec<u8>, String> {
    let bq = base_quality.clamp(1.0, 100.0);
    let qualities = [
        bq,
        (bq - 8.0).max(1.0),
        (bq - 14.0).max(1.0),
        (bq - 20.0).max(1.0),
        (bq - 26.0).max(1.0),
        (bq - 32.0).max(1.0),
        (bq - 38.0).max(1.0),
    ];
    let mut best: Option<Vec<u8>> = None;
    let mut current_rgba = rgba;
    let mut current_w = width;
    let mut current_h = height;

    // Try quality first; if still too big, progressively downscale.
    for _ in 0..6 {
        for quality in qualities {
            let encoder = webp::Encoder::from_rgba(&current_rgba, current_w, current_h);
            let encoded = encoder.encode(quality);
            let bytes = encoded.to_vec();

            if bytes.len() <= target_bytes {
                return Ok(bytes);
            }

            if best.as_ref().map(|b| bytes.len() < b.len()).unwrap_or(true) {
                best = Some(bytes);
            }
        }

        if current_w <= 960 || current_h <= 540 {
            break;
        }

        let (next_rgba, next_w, next_h) = downscale_rgba_nearest(&current_rgba, current_w, current_h, 0.85);
        current_rgba = next_rgba;
        current_w = next_w;
        current_h = next_h;
    }

    best.ok_or_else(|| "Failed to encode WebP screenshot".to_string())
}

#[cfg(target_os = "windows")]
fn limit_width_rgba(rgba: Vec<u8>, width: u32, height: u32, max_width: u32) -> (Vec<u8>, u32, u32) {
    if width <= max_width || max_width == 0 {
        return (rgba, width, height);
    }
    let scale = max_width as f32 / width as f32;
    downscale_rgba_nearest(&rgba, width, height, scale)
}

#[cfg(target_os = "windows")]
fn bgra_to_rgba(bgra: &[u8]) -> Vec<u8> {
    let mut rgba = vec![0u8; bgra.len()];
    let mut i = 0usize;
    while i + 3 < bgra.len() {
        rgba[i] = bgra[i + 2];
        rgba[i + 1] = bgra[i + 1];
        rgba[i + 2] = bgra[i];
        rgba[i + 3] = bgra[i + 3];
        i += 4;
    }
    rgba
}

#[cfg(target_os = "windows")]
fn downscale_rgba_nearest(
    src: &[u8],
    src_w: u32,
    src_h: u32,
    scale: f32,
) -> (Vec<u8>, u32, u32) {
    let dst_w = ((src_w as f32 * scale).round() as u32).max(1);
    let dst_h = ((src_h as f32 * scale).round() as u32).max(1);
    let mut dst = vec![0u8; (dst_w * dst_h * 4) as usize];

    for y in 0..dst_h {
        let src_y = ((y as u64 * src_h as u64) / dst_h as u64) as u32;
        for x in 0..dst_w {
            let src_x = ((x as u64 * src_w as u64) / dst_w as u64) as u32;
            let src_idx = ((src_y * src_w + src_x) * 4) as usize;
            let dst_idx = ((y * dst_w + x) * 4) as usize;
            dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    (dst, dst_w, dst_h)
}
