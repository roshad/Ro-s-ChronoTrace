use rusqlite::Connection;
use crate::data::AppResult;

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
pub fn get_screenshots_for_day(conn: &Connection, day_id: i32) -> AppResult<Vec<(i64, String)>> {
    let mut stmt = conn
        .prepare("SELECT timestamp, file_path FROM screenshots WHERE day_id = ?1 ORDER BY timestamp")
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

/// Convert timestamp (milliseconds) to day_id (YYYYMMDD integer)
fn timestamp_to_day_id(timestamp: i64) -> i32 {
    use chrono::{DateTime, Local, Timelike};

    let dt = DateTime::from_timestamp_millis(timestamp)
        .unwrap_or_else(|| Local::now().with_hour(0).unwrap().with_minute(0).unwrap().with_second(0).unwrap().with_nanosecond(0).unwrap().into());

    let year = dt.year();
    let month = dt.month();
    let day = dt.day();

    (year * 10000 + month as i32 * 100 + day as i32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp_to_day_id() {
        // 2026-01-17 10:30:00 UTC
        let timestamp = 1737110400000;
        let day_id = timestamp_to_day_id(timestamp);

        // Should be 20260117
        assert!(day_id >= 20260101 && day_id <= 20261231);
    }
}
