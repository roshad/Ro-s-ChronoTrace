use crate::data::AppResult;
use rusqlite::{Connection, OptionalExtension};
use std::path::Path;

/// Get screenshot directory path
#[allow(dead_code)]
pub fn get_screenshot_path(base_path: &Path) -> std::path::PathBuf {
    base_path.join("screenshots")
}

/// Save screenshot to file
#[allow(dead_code)]
pub fn save_screenshot(
    base_path: &Path,
    timestamp: i64,
    data: Vec<u8>,
) -> AppResult<std::path::PathBuf> {
    let screenshot_dir = get_screenshot_path(base_path);
    std::fs::create_dir_all(&screenshot_dir)
        .map_err(|e| format!("Failed to create screenshots directory: {}", e))?;

    let filename = format!("{}.png", timestamp);
    let file_path = screenshot_dir.join(&filename);

    // If file already exists, add a counter suffix
    let file_path = if file_path.exists() {
        let mut counter = 1;
        loop {
            let new_filename = format!("{}_{}.png", timestamp, counter);
            let candidate = screenshot_dir.join(&new_filename);
            if !candidate.exists() {
                break candidate;
            }
            counter += 1;
        }
    } else {
        file_path
    };

    std::fs::write(&file_path, data)
        .map_err(|e| format!("Failed to write screenshot file: {}", e))?;

    Ok(file_path)
}

/// Insert a screenshot record into the database
pub fn insert_screenshot(conn: &Connection, timestamp: i64, file_path: &str) -> AppResult<i64> {
    let day_id = timestamp_to_day_id(timestamp);

    conn.execute(
        "INSERT INTO screenshots (timestamp, file_path, day_id) VALUES (?1, ?2, ?3)",
        rusqlite::params![timestamp, file_path, day_id],
    )
    .map_err(|e| format!("Failed to insert screenshot: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Get screenshot path near a given timestamp (within tolerance milliseconds)
pub fn get_screenshot_near_time(
    conn: &Connection,
    timestamp: i64,
    tolerance_ms: i64,
) -> AppResult<Option<String>> {
    let start_time = timestamp - tolerance_ms;
    let end_time = timestamp + tolerance_ms;

    let mut stmt = conn
        .prepare(
            "SELECT file_path FROM screenshots
             WHERE timestamp >= ?1 AND timestamp <= ?2
             ORDER BY ABS(timestamp - ?3)
             LIMIT 1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt
        .query_row(rusqlite::params![start_time, end_time, timestamp], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(|e| format!("Failed to query screenshot: {}", e))?;

    Ok(result)
}

/// Get all screenshots for a specific day
#[allow(dead_code)]
pub fn get_screenshots_for_day(conn: &Connection, day_id: i32) -> AppResult<Vec<(i64, String)>> {
    let mut stmt = conn
        .prepare(
            "SELECT timestamp, file_path FROM screenshots WHERE day_id = ?1 ORDER BY timestamp",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let screenshots = stmt
        .query_map(rusqlite::params![day_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query screenshots: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect screenshots: {}", e))?;

    Ok(screenshots)
}

/// Get screenshot timestamps in a day range [start_of_day, end_of_day)
pub fn get_screenshot_timestamps_for_day(
    conn: &Connection,
    start_of_day: i64,
    end_of_day: i64,
) -> AppResult<Vec<i64>> {
    let mut stmt = conn
        .prepare(
            "SELECT timestamp FROM screenshots
             WHERE timestamp >= ?1 AND timestamp < ?2
             ORDER BY timestamp",
        )
        .map_err(|e| format!("Failed to prepare screenshot timestamps query: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![start_of_day, end_of_day], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|e| format!("Failed to query screenshot timestamps: {}", e))?;

    let timestamps = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect screenshot timestamps: {}", e))?;

    Ok(timestamps)
}

/// Convert timestamp (milliseconds) to day_id (YYYYMMDD integer)
fn timestamp_to_day_id(timestamp: i64) -> i32 {
    use chrono::{DateTime, Datelike, Utc};

    let dt = DateTime::<Utc>::from_timestamp_millis(timestamp).unwrap_or_else(Utc::now);

    let year = dt.year();
    let month = dt.month();
    let day = dt.day();

    year * 10000 + month as i32 * 100 + day as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp_to_day_id() {
        // 2025-01-17 10:30:00 UTC
        let timestamp = 1737110400000;
        let day_id = timestamp_to_day_id(timestamp);

        // Should be 20250117
        assert_eq!(day_id, 20250117);
    }
}
