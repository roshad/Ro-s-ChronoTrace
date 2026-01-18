pub mod database;
pub mod time_entries;
pub mod screenshot;
pub mod export;
pub mod search;
pub mod idle;
pub mod window_activity;

pub use database::init_database;
pub use time_entries::{get_time_entries, create_time_entry, update_time_entry, delete_time_entry};
pub use screenshot::{insert_screenshot, get_screenshot_near_time, get_screenshots_for_day};
pub use export::export_data_cmd;
pub use search::search_activities_cmd;
pub use window_activity::{insert_window_activity, insert_window_activities_batch, get_window_activities};

use rusqlite::Connection;
use std::sync::Mutex;
use once_cell::sync::Lazy;

pub type AppResult<T> = std::result::Result<T, String>;

static DB_CONN: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn init_database() -> AppResult<()> {
    let conn = database::init_database()?;
    let mut db = DB_CONN.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    *db = Some(conn);
    Ok(())
}

pub fn with_db<F, R>(f: F) -> AppResult<R>
where
    F: FnOnce(&Connection) -> AppResult<R>,
{
    let db = DB_CONN.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    let conn = db.as_ref().ok_or("Database not initialized")?;
    f(conn)
}

// Tauri commands - ALL must use with_db wrapper
#[tauri::command]
pub async fn get_time_entries(date: i64) -> AppResult<Vec<crate::types::TimeEntry>> {
    with_db(|conn| time_entries::get_time_entries(conn, date))
}

#[tauri::command]
pub async fn create_time_entry(entry: crate::types::TimeEntryInput) -> AppResult<crate::types::TimeEntry> {
    with_db(|conn| time_entries::create_time_entry(conn, &entry))
}

#[tauri::command]
pub async fn update_time_entry(id: i64, updates: crate::types::TimeEntryUpdate) -> AppResult<crate::types::TimeEntry> {
    with_db(|conn| time_entries::update_time_entry(conn, id, &updates))
}

#[tauri::command]
pub async fn delete_time_entry(id: i64) -> AppResult<()> {
    with_db(|conn| time_entries::delete_time_entry(conn, id))
}

#[tauri::command]
pub async fn search_activities_cmd(query: String) -> AppResult<Vec<crate::types::WindowActivity>> {
    with_db(|conn| search::search_activities(conn, &query))
}

#[tauri::command]
pub async fn export_data_cmd() -> AppResult<crate::types::ExportData> {
    with_db(|conn| export::export_data(conn))
}

