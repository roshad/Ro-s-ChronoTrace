use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScreenshotSettings {
    pub quality: u8,
    pub max_width: u32,
    pub max_file_kb: u32,
    pub storage_dir: Option<String>,
}

impl Default for ScreenshotSettings {
    fn default() -> Self {
        Self {
            quality: 40,
            max_width: 960,
            max_file_kb: 50,
            storage_dir: None,
        }
    }
}

impl ScreenshotSettings {
    pub fn normalized(mut self) -> Self {
        self.quality = self.quality.clamp(1, 100);
        self.max_width = self.max_width.clamp(640, 7680);
        self.max_file_kb = self.max_file_kb.clamp(20, 2048);

        self.storage_dir = self
            .storage_dir
            .and_then(|p| {
                let trimmed = p.trim().to_string();
                if trimmed.is_empty() { None } else { Some(trimmed) }
            });

        self
    }
}

fn get_data_directory() -> Result<PathBuf, String> {
    let local_data =
        dirs::data_local_dir().ok_or_else(|| "Failed to get local data directory".to_string())?;
    let data_dir = local_data.join("DigitalDiary");
    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data directory: {}", e))?;
    Ok(data_dir)
}

fn settings_file_path() -> Result<PathBuf, String> {
    Ok(get_data_directory()?.join("settings.json"))
}

pub fn resolve_screenshot_storage_dir(configured_storage_dir: Option<String>) -> Result<PathBuf, String> {
    let configured = configured_storage_dir
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);

    if let Some(path) = configured {
        return Ok(path);
    }

    Ok(get_data_directory()?.join("screenshots"))
}

pub fn resolve_screenshot_file_path(stored_path: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(stored_path);
    if candidate.is_absolute() {
        return Ok(candidate.to_path_buf());
    }

    let mut absolute = get_data_directory()?;
    for segment in stored_path.split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        absolute.push(segment);
    }
    Ok(absolute)
}

pub fn load_screenshot_settings() -> Result<ScreenshotSettings, String> {
    let path = settings_file_path()?;
    if !path.exists() {
        return Ok(ScreenshotSettings::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings file {}: {}", path.display(), e))?;
    let settings: ScreenshotSettings = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse settings file {}: {}", path.display(), e))?;
    Ok(settings.normalized())
}

pub fn save_screenshot_settings(settings: ScreenshotSettings) -> Result<ScreenshotSettings, String> {
    let normalized = settings.normalized();
    let path = settings_file_path()?;
    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, serialized)
        .map_err(|e| format!("Failed to write settings file {}: {}", path.display(), e))?;
    Ok(normalized)
}

#[tauri::command]
#[specta::specta]
pub async fn get_screenshot_settings_cmd() -> Result<ScreenshotSettings, String> {
    load_screenshot_settings()
}

#[tauri::command]
#[specta::specta]
pub async fn update_screenshot_settings_cmd(
    settings: ScreenshotSettings,
) -> Result<ScreenshotSettings, String> {
    save_screenshot_settings(settings)
}

#[tauri::command]
#[specta::specta]
pub async fn resolve_screenshot_storage_dir_cmd(
    storage_dir: Option<String>,
) -> Result<String, String> {
    let resolved = resolve_screenshot_storage_dir(storage_dir)?;
    Ok(resolved.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn resolve_screenshot_file_path_cmd(stored_path: String) -> Result<String, String> {
    let resolved = resolve_screenshot_file_path(&stored_path)?;
    Ok(resolved.to_string_lossy().to_string())
}
