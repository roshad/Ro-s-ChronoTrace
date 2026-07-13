//! Shared native runtime tasks used by the Slint frontend.
//!
//! This module keeps capture/sampling logic out of any specific UI framework so
//! the final app can drop the Tauri WebView while retaining the existing Rust
//! backend behavior.

use crate::{capture, data, types};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTimer {
    pub entry_id: i64,
    pub start_time: i64,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UiPreferences {
    pub timeline_visible_hours: i32,
    pub saved_searches: Vec<String>,
    pub ui_scale: f32,
}

impl Default for UiPreferences {
    fn default() -> Self {
        Self {
            timeline_visible_hours: 24,
            saved_searches: Vec::new(),
            ui_scale: 1.0,
        }
    }
}

fn runtime_state_path() -> Result<PathBuf, String> {
    let base =
        dirs::data_local_dir().ok_or_else(|| "Failed to get local data directory".to_owned())?;
    let directory = base.join("RosChronoTrace");
    fs::create_dir_all(&directory).map_err(|e| format!("Failed to create data directory: {e}"))?;
    Ok(directory.join("runtime-state.json"))
}

fn ui_preferences_path() -> Result<PathBuf, String> {
    Ok(runtime_state_path()?.with_file_name("ui-preferences.json"))
}

pub fn load_ui_preferences() -> UiPreferences {
    ui_preferences_path()
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<UiPreferences>(&raw).ok())
        .unwrap_or_default()
}

pub fn save_ui_preferences(preferences: &UiPreferences) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(preferences)
        .map_err(|e| format!("Failed to serialize UI preferences: {e}"))?;
    fs::write(ui_preferences_path()?, raw)
        .map_err(|e| format!("Failed to write UI preferences: {e}"))
}

pub fn save_timeline_visible_hours(hours: i32) -> Result<(), String> {
    let mut preferences = load_ui_preferences();
    preferences.timeline_visible_hours = hours.clamp(2, 24);
    save_ui_preferences(&preferences)
}

pub fn save_saved_searches(searches: Vec<String>) -> Result<(), String> {
    let mut preferences = load_ui_preferences();
    preferences.saved_searches = searches;
    save_ui_preferences(&preferences)
}

pub fn save_ui_scale(scale: f32) -> Result<(), String> {
    let mut preferences = load_ui_preferences();
    preferences.ui_scale = scale.clamp(0.75, 1.5);
    save_ui_preferences(&preferences)
}

pub fn load_running_timer() -> Result<Option<PersistedTimer>, String> {
    let path = runtime_state_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| format!("Failed to read runtime state: {e}"))?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|e| format!("Failed to parse runtime state: {e}"))
}

pub fn save_running_timer(timer: Option<&PersistedTimer>) -> Result<(), String> {
    let path = runtime_state_path()?;
    if let Some(timer) = timer {
        let raw = serde_json::to_string_pretty(timer)
            .map_err(|e| format!("Failed to serialize runtime state: {e}"))?;
        fs::write(path, raw).map_err(|e| format!("Failed to write runtime state: {e}"))
    } else if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to clear runtime state: {e}"))
    } else {
        Ok(())
    }
}

pub fn start_background_tasks() {
    start_window_capture_thread();
    start_screenshot_capture_thread();
    start_process_sampling_thread();
    start_process_samples_cleanup_thread();
}

fn start_window_capture_thread() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_window_capture());
    });
}

fn start_screenshot_capture_thread() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_screenshot_capture());
    });
}

fn start_process_sampling_thread() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_process_sampling());
    });
}

fn start_process_samples_cleanup_thread() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_process_samples_cleanup());
    });
}

/// Captures active window title and process name every 1 minute.
/// Batches inserts every 5 records for lower database write overhead.
async fn start_window_capture() {
    let mut buffer: Vec<capture::WindowActivityCapture> = Vec::new();
    const BATCH_SIZE: usize = 5;

    loop {
        if let Some(activity) = capture::get_active_window() {
            buffer.push(activity);

            if buffer.len() >= BATCH_SIZE {
                if let Err(e) = data::with_db(|conn| {
                    data::insert_window_activities_batch(
                        conn,
                        &buffer
                            .iter()
                            .map(|a| types::WindowActivity {
                                id: 0,
                                timestamp: a.timestamp,
                                window_title: a.window_title.clone(),
                                process_name: a.process_name.clone(),
                            })
                            .collect::<Vec<_>>(),
                    )
                }) {
                    eprintln!("Failed to batch insert window activities: {e}");
                }
                buffer.clear();
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
    }
}

/// Starts first screenshot after 1 minute, then captures every 5 minutes.
async fn start_screenshot_capture() {
    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

    loop {
        match capture::capture_screenshot().await {
            Ok(file_path) => println!("Screenshot captured: {file_path}"),
            Err(e) => eprintln!("Failed to capture screenshot: {e}"),
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
    }
}

async fn start_process_sampling() {
    loop {
        if let Some(activity) = capture::get_active_window() {
            let aligned_timestamp = (activity.timestamp / 1000) * 1000;
            if let Err(e) = data::with_db(|conn| {
                data::insert_process_sample(conn, aligned_timestamp, &activity.process_name)
            }) {
                eprintln!("Failed to insert process sample: {e}");
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
}

async fn start_process_samples_cleanup() {
    if let Err(e) = cleanup_old_process_samples() {
        eprintln!("Failed to cleanup old process samples on startup: {e}");
    }

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
        if let Err(e) = cleanup_old_process_samples() {
            eprintln!("Failed to cleanup old process samples: {e}");
        }
    }
}

fn cleanup_old_process_samples() -> Result<(), String> {
    let cutoff = chrono::Utc::now().timestamp_millis() - (30_i64 * 24 * 60 * 60 * 1000);
    let deleted = data::with_db(|conn| data::delete_process_samples_before(conn, cutoff))?;
    if deleted > 0 {
        println!("Process samples cleanup removed {deleted} old records");
    }
    Ok(())
}
