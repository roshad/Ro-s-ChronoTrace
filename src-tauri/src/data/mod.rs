pub mod categories;
pub mod database;
pub mod export;
pub mod idle;
pub mod process_samples;
pub mod screenshot;
pub mod search;
pub mod time_entries;
pub mod window_activity;

// Re-export internal functions for use within the crate
pub use screenshot::{get_screenshot_near_time, insert_screenshot};
pub use window_activity::insert_window_activities_batch;
pub use process_samples::{delete_process_samples_before, insert_process_sample};

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
pub async fn get_time_entries_by_range(
    start_time: i64,
    end_time: i64,
) -> AppResult<Vec<crate::types::TimeEntry>> {
    with_db(|conn| time_entries::get_time_entries_by_range_impl(conn, start_time, end_time))
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
pub async fn search_activities_by_range_cmd(query: String, start_time: i64, end_time: i64) -> AppResult<Vec<crate::types::SearchResult>> {
    with_db(|conn| {
        search::search_activities_by_date_impl(conn, &query, start_time, end_time)
    })
}

#[tauri::command]
pub async fn export_data_cmd() -> AppResult<crate::types::ExportData> {
    with_db(export::export_data_impl)
}

#[tauri::command]
pub async fn get_categories() -> AppResult<Vec<crate::types::Category>> {
    with_db(categories::get_categories_impl)
}

#[tauri::command]
pub async fn create_category(
    category: crate::types::CategoryInput,
) -> AppResult<crate::types::Category> {
    with_db(|conn| categories::create_category_impl(conn, &category))
}

#[tauri::command]
pub async fn update_category(
    id: i64,
    category: crate::types::CategoryInput,
) -> AppResult<crate::types::Category> {
    with_db(|conn| categories::update_category_impl(conn, id, &category))
}

#[tauri::command]
pub async fn delete_category(id: i64) -> AppResult<()> {
    with_db(|conn| categories::delete_category_impl(conn, id))
}

#[tauri::command]
pub async fn get_screenshot_timestamps_for_day(date: i64) -> AppResult<Vec<i64>> {
    with_db(|conn| {
        let start_of_day = date;
        let end_of_day = date + 86400000;
        screenshot::get_screenshot_timestamps_for_day(conn, start_of_day, end_of_day)
    })
}

#[tauri::command]
pub async fn get_process_samples_for_day(date: i64) -> AppResult<Vec<crate::types::ProcessSample>> {
    with_db(|conn| {
        let start_of_day = date;
        let end_of_day = date + 86400000;
        process_samples::get_process_samples_for_day(conn, start_of_day, end_of_day)
    })
}
