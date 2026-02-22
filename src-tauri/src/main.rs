// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod data;
mod idle;
mod app_settings;
mod types;

use tauri::Manager;

fn main() {
    // Initialize database on startup
    if let Err(e) = data::init_database() {
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
    }

    // Start background window capture task
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_window_capture());
    });

    // Start background screenshot capture task
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_screenshot_capture());
    });

    // Start per-second process sampling for status bar analytics
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_process_sampling());
    });

    // Cleanup old process samples (startup + hourly)
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_process_samples_cleanup());
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await;
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(err) = window.show() {
                        eprintln!("Fallback show window failed: {}", err);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            data::get_time_entries,
            data::get_time_entries_by_range,
            data::create_time_entry,
            data::update_time_entry,
            data::delete_time_entry,
            data::get_categories,
            data::create_category,
            data::update_category,
            data::delete_category,
            data::get_screenshot_timestamps_for_day,
            data::get_process_samples_for_day,
            data::search_activities_cmd,
            data::search_activities_by_range_cmd,
            data::export_data_cmd,
            capture::screenshot::get_screenshot_for_time,
            app_settings::get_screenshot_settings_cmd,
            app_settings::update_screenshot_settings_cmd,
            app_settings::resolve_screenshot_storage_dir_cmd,
            app_settings::resolve_screenshot_file_path_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Start background window metadata capture task
///
/// Captures active window title and process name every 1 minute
/// Batches inserts every 5 records (5 minutes) for performance
async fn start_window_capture() {
    let mut buffer: Vec<capture::WindowActivityCapture> = Vec::new();
    const BATCH_SIZE: usize = 5;

    loop {
        if let Some(activity) = capture::get_active_window() {
            buffer.push(activity);

            if buffer.len() >= BATCH_SIZE {
                // Batch insert to database
                if let Err(e) = data::with_db(|conn| {
                    data::insert_window_activities_batch(
                        conn,
                        &buffer
                            .iter()
                            .map(|a| types::WindowActivity {
                                id: 0, // ID will be auto-generated
                                timestamp: a.timestamp,
                                window_title: a.window_title.clone(),
                                process_name: a.process_name.clone(),
                            })
                            .collect::<Vec<_>>(),
                    )
                }) {
                    eprintln!("Failed to batch insert window activities: {}", e);
                }
                buffer.clear();
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await; // 1 minute
    }
}

/// Start background screenshot capture task
///
/// Starts first screenshot after 1 minute, then captures every 5 minutes
async fn start_screenshot_capture() {
    // Delay first capture so app startup does not immediately create a screenshot.
    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

    loop {
        match capture::capture_screenshot().await {
            Ok(file_path) => {
                println!("Screenshot captured: {}", file_path);
            }
            Err(e) => {
                eprintln!("Failed to capture screenshot: {}", e);
            }
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
                eprintln!("Failed to insert process sample: {}", e);
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
}

async fn start_process_samples_cleanup() {
    if let Err(e) = cleanup_old_process_samples() {
        eprintln!("Failed to cleanup old process samples on startup: {}", e);
    }

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
        if let Err(e) = cleanup_old_process_samples() {
            eprintln!("Failed to cleanup old process samples: {}", e);
        }
    }
}

fn cleanup_old_process_samples() -> Result<(), String> {
    let cutoff = chrono::Utc::now().timestamp_millis() - (30_i64 * 24 * 60 * 60 * 1000);
    let deleted = data::with_db(|conn| data::delete_process_samples_before(conn, cutoff))?;
    if deleted > 0 {
        println!("Process samples cleanup removed {} old records", deleted);
    }
    Ok(())
}
