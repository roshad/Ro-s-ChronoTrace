// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod types;
mod data;
mod capture;
mod idle;

fn main() {
    // Initialize database on startup
    if let Err(e) = data::init_database() {
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
    }

    // Start background window capture task
    tokio::spawn(async move {
        start_window_capture().await;
    });

    // Start background screenshot capture task
    tokio::spawn(async move {
        start_screenshot_capture().await;
    });

    // Start idle detection
    idle::start_idle_detection();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            data::get_time_entries,
            data::create_time_entry,
            data::update_time_entry,
            data::delete_time_entry,
            capture::get_screenshot_for_time,
            idle::resolve_idle_period,
            data::search_activities_cmd,
            data::export_data_cmd,
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
                        &buffer.iter().map(|a| types::WindowActivity {
                            id: 0, // ID will be auto-generated
                            timestamp: a.timestamp,
                            window_title: a.window_title.clone(),
                            process_name: a.process_name.clone(),
                        })
                        .collect::<Vec<_>>()
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
/// Captures screenshot every 5 minutes
async fn start_screenshot_capture() {
    loop {
        // Wait 5 minutes before first capture
        tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;

        match capture::capture_screenshot().await {
            Ok(file_path) => {
                println!("Screenshot captured: {}", file_path);
            }
            Err(e) => {
                eprintln!("Failed to capture screenshot: {}", e);
            }
        }
    }
}
