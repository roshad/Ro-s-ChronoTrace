pub mod database;
pub mod export;
pub mod idle;
pub mod screenshot;
pub mod search;
pub mod time_entries;
pub mod window_activity;

// Re-export internal functions for use within the crate
pub use screenshot::{get_screenshot_near_time, insert_screenshot};
pub use window_activity::insert_window_activities_batch;

use once_cell::sync::Lazy;
use rusqlite::Connection;
use std::sync::Mutex;

pub type AppResult<T> = std::result::Result<T, String>;

static DB_CONN: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn init_database() -> AppResult<()> {
    let conn = database::init_database()?;
    let mut db = DB_CONN
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;
    *db = Some(conn);
    Ok(())
}

pub fn with_db<F, R>(f: F) -> AppResult<R>
where
    F: FnOnce(&Connection) -> AppResult<R>,
{
    let db = DB_CONN
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;
    let conn = db.as_ref().ok_or("Database not initialized")?;
    f(conn)
}

// Tauri commands - ALL must use with_db wrapper
#[tauri::command]
pub async fn get_time_entries(date: i64) -> AppResult<Vec<crate::types::TimeEntry>> {
    with_db(|conn| time_entries::get_time_entries_impl(conn, date))
}

#[tauri::command]
pub async fn create_time_entry(
    entry: crate::types::TimeEntryInput,
) -> AppResult<crate::types::TimeEntry> {
    with_db(|conn| time_entries::create_time_entry_impl(conn, &entry))
}

#[tauri::command]
pub async fn update_time_entry(
    id: i64,
    updates: crate::types::TimeEntryUpdate,
) -> AppResult<crate::types::TimeEntry> {
    with_db(|conn| time_entries::update_time_entry_impl(conn, id, &updates))
}

#[tauri::command]
pub async fn delete_time_entry(id: i64) -> AppResult<()> {
    with_db(|conn| time_entries::delete_time_entry_impl(conn, id))
}

#[tauri::command]
pub async fn search_activities_cmd(query: String) -> AppResult<Vec<crate::types::SearchResult>> {
    with_db(|conn| search::search_activities_impl(conn, &query))
}

#[tauri::command]
pub async fn export_data_cmd() -> AppResult<crate::types::ExportData> {
    with_db(export::export_data_impl)
}

#[tauri::command]
pub async fn get_idle_periods(date: i64) -> AppResult<Vec<crate::types::IdlePeriod>> {
    with_db(|conn| {
        let start_of_day = date;
        let end_of_day = date + 86400000;
        idle::get_idle_periods_for_day(conn, start_of_day, end_of_day)
    })
}
