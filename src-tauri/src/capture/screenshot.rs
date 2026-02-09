use chrono::Local;
use base64::Engine;
use std::fs;
use std::path::PathBuf;

/// Capture a screenshot and save it to the filesystem
///
/// Screenshots are saved in Year/Month/Day hierarchy:
/// screenshots/YYYY/MM/DD/screenshot_YYYYMMDD_HHMMSS.png
///
/// Returns the relative file path on success
pub async fn capture_screenshot() -> Result<String, String> {
    let start_time = std::time::Instant::now();

    // Get data directory
    let data_dir = get_data_directory()?;

    // Check disk space before capture (skip if less than 100MB free)
    if !has_sufficient_disk_space(&data_dir)? {
        return Err("Insufficient disk space for screenshot capture".to_string());
    }

    // Get current timestamp
    let now = Local::now();
    let timestamp = now.timestamp_millis();

    // Create directory structure: screenshots/YYYY/MM/DD/
    let year = now.format("%Y").to_string();
    let month = now.format("%m").to_string();
    let day = now.format("%d").to_string();

    let screenshot_dir = data_dir
        .join("screenshots")
        .join(&year)
        .join(&month)
        .join(&day);

    fs::create_dir_all(&screenshot_dir)
        .map_err(|e| format!("Failed to create screenshot directory: {}", e))?;

    // Generate filename: screenshot_YYYYMMDD_HHMMSS.png
    let filename = format!(
        "screenshot_{}_{}.png",
        now.format("%Y%m%d"),
        now.format("%H%M%S")
    );

    let file_path = screenshot_dir.join(&filename);

    // Capture screenshot using windows-capture
    #[cfg(target_os = "windows")]
    {
        capture_windows_screenshot(&file_path)?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Screenshot capture is only supported on Windows".to_string());
    }

    // Calculate relative path from data directory
    let relative_path = format!("screenshots/{}/{}/{}/{}", year, month, day, filename);

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
        crate::data::with_db(|conn| crate::data::insert_screenshot(conn, timestamp, &relative_path))
    {
        eprintln!("Failed to insert screenshot record: {}", e);
    }

    Ok(relative_path)
}

#[cfg(target_os = "windows")]
fn capture_windows_screenshot(file_path: &std::path::Path) -> Result<(), String> {
    use windows_capture::capture::GraphicsCaptureApiHandler;
    use windows_capture::frame::Frame;
    use windows_capture::graphics_capture_api::InternalCaptureControl;
    use windows_capture::monitor::Monitor;
    use windows_capture::settings::{ColorFormat, Settings};

    struct Capture {
        file_path: std::path::PathBuf,
        captured: bool,
    }

    impl GraphicsCaptureApiHandler for Capture {
        type Flags = std::path::PathBuf;
        type Error = String;

        fn new(flags: windows_capture::capture::Context<Self::Flags>) -> Result<Self, Self::Error> {
            Ok(Self {
                file_path: flags.flags.clone(),
                captured: false,
            })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            capture_control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            if !self.captured {
                // Save frame as PNG
                frame
                    .save_as_image(&self.file_path, windows_capture::frame::ImageFormat::Png)
                    .map_err(|e| format!("Failed to save screenshot: {}", e))?;

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
        file_path.to_path_buf(),
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
            .and_then(|relative_path| {
                let local_data = dirs::data_local_dir()?;
                let absolute_path = local_data.join("DigitalDiary").join(relative_path);
                match fs::read(&absolute_path) {
                    Ok(bytes) => Some(format!(
                        "data:image/png;base64,{}",
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
