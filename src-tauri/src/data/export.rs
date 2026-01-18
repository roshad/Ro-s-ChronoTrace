use rusqlite::Connection;
use chrono::Utc;

/// Export all data to JSON
pub fn export_data(conn: &Connection) -> Result<crate::types::ExportData, String> {
    // Get all time entries
    let mut stmt = conn.prepare("SELECT id, start_time, end_time, label, color FROM time_entries ORDER BY start_time")
        .map_err(|e| format!("Failed to prepare time entries query: {}", e))?;

    let time_entries: Vec<crate::types::TimeEntry> = stmt.query_map([], |row| {
        Ok(crate::types::TimeEntry {
            id: row.get(0)?,
            start_time: row.get(1)?,
            end_time: row.get(2)?,
            label: row.get(3)?,
            color: row.get(4)?,
        })
    })
    .map_err(|e| format!("Failed to query time entries: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect time entries: {}", e))?;

    // Get all screenshots
    let mut stmt = conn.prepare("SELECT timestamp, file_path FROM screenshots ORDER BY timestamp")
        .map_err(|e| format!("Failed to prepare screenshots query: {}", e))?;

    let screenshots: Vec<crate::types::ScreenshotRef> = stmt.query_map([], |row| {
        Ok(crate::types::ScreenshotRef {
            timestamp: row.get(0)?,
            file_path: row.get(1)?,
        })
    })
    .map_err(|e| format!("Failed to query screenshots: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect screenshots: {}", e))?;

    // Get all window activities
    let mut stmt = conn.prepare("SELECT id, timestamp, window_title, process_name FROM window_activity ORDER BY timestamp")
        .map_err(|e| format!("Failed to prepare window activity query: {}", e))?;

    let window_activities: Vec<crate::types::WindowActivity> = stmt.query_map([], |row| {
        Ok(crate::types::WindowActivity {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            window_title: row.get(2)?,
            process_name: row.get(3)?,
        })
    })
    .map_err(|e| format!("Failed to query window activities: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect window activities: {}", e))?;

    // Get all idle periods
    let mut stmt = conn.prepare("SELECT id, start_time, end_time, resolution FROM idle_periods ORDER BY start_time")
        .map_err(|e| format!("Failed to prepare idle periods query: {}", e))?;

    let idle_periods: Vec<crate::types::IdlePeriod> = stmt.query_map([], |row| {
        Ok(crate::types::IdlePeriod {
            id: row.get(0)?,
            start_time: row.get(1)?,
            end_time: row.get(2)?,
            resolution: row.get(3)?,
        })
    })
    .map_err(|e| format!("Failed to query idle periods: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect idle periods: {}", e))?;

    Ok(crate::types::ExportData {
        version: "1.0".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        time_entries,
        screenshots,
        window_activities,
        idle_periods,
    })
}

/// Tauri command: Export data
#[tauri::command]
pub async fn export_data_cmd() -> Result<crate::types::ExportData, String> {
    crate::data::with_db(|conn| export_data(conn))
}
