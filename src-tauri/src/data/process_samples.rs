use crate::data::AppResult;
use crate::types::ProcessSample;
use chrono::{DateTime, Datelike, Utc};
use rusqlite::{params, Connection};

pub fn insert_process_sample(conn: &Connection, timestamp: i64, process_name: &str) -> AppResult<()> {
    let day_id = timestamp_to_day_id(timestamp);
    conn.execute(
        "INSERT OR REPLACE INTO process_samples (timestamp, process_name, day_id) VALUES (?1, ?2, ?3)",
        params![timestamp, process_name, day_id],
    )
    .map_err(|e| format!("Failed to insert process sample: {}", e))?;

    Ok(())
}

pub fn get_process_samples_for_day(
    conn: &Connection,
    start_of_day: i64,
    end_of_day: i64,
) -> AppResult<Vec<ProcessSample>> {
    let mut stmt = conn
        .prepare(
            "SELECT timestamp, process_name
             FROM process_samples
             WHERE timestamp >= ?1 AND timestamp < ?2
             ORDER BY timestamp",
        )
        .map_err(|e| format!("Failed to prepare process samples query: {}", e))?;

    let rows = stmt
        .query_map(params![start_of_day, end_of_day], |row| {
            Ok(ProcessSample {
                timestamp: row.get(0)?,
                process_name: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query process samples: {}", e))?;

    let samples = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect process samples: {}", e))?;

    Ok(samples)
}

pub fn delete_process_samples_before(conn: &Connection, cutoff_timestamp: i64) -> AppResult<usize> {
    let deleted = conn
        .execute(
            "DELETE FROM process_samples WHERE timestamp < ?1",
            params![cutoff_timestamp],
        )
        .map_err(|e| format!("Failed to delete old process samples: {}", e))?;

    Ok(deleted)
}

fn timestamp_to_day_id(timestamp: i64) -> i32 {
    let dt = DateTime::<Utc>::from_timestamp_millis(timestamp).unwrap_or_else(Utc::now);
    dt.year() * 10000 + dt.month() as i32 * 100 + dt.day() as i32
}
