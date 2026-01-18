use rusqlite::{Connection, params};
use crate::types::{TimeEntry, TimeEntryInput, TimeEntryUpdate};
use crate::data::AppResult;

#[cfg(test)]
#[path = "time_entries_tests.rs"]
mod tests;

pub fn get_time_entries(conn: &Connection, date: i64) -> AppResult<Vec<TimeEntry>> {
    let start_of_day = date;
    let end_of_day = date + 86400000;

    let mut stmt = conn.prepare(
        "SELECT id, start_time, end_time, label, color FROM time_entries 
         WHERE start_time >= ? AND start_time < ? 
         ORDER BY start_time"
    )
    .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let entry_iter = stmt.query_map(params![start_of_day, end_of_day], |row| {
        Ok(TimeEntry {
            id: row.get(0)?,
            start_time: row.get(1)?,
            end_time: row.get(2)?,
            label: row.get(3)?,
            color: row.get(4)?,
        })
    })
    .map_err(|e| format!("Failed to query time entries: {}", e))?;

    let mut entries = Vec::new();
    for entry in entry_iter {
        entries.push(entry.map_err(|e| format!("Failed to map row: {}", e))?);
    }

    Ok(entries)
}

pub fn create_time_entry(conn: &Connection, entry: &TimeEntryInput) -> AppResult<TimeEntry> {
    if entry.end_time <= entry.start_time {
        return Err("end_time must be greater than start_time".to_string());
    }

    if entry.label.trim().is_empty() {
        return Err("Label cannot be empty".to_string());
    }

    conn.execute(
        "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?, ?, ?, ?)",
        params![entry.start_time, entry.end_time, &entry.label, &entry.color],
    )
    .map_err(|e| format!("Failed to insert time entry: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(TimeEntry {
        id,
        start_time: entry.start_time,
        end_time: entry.end_time,
        label: entry.label.clone(),
        color: entry.color.clone(),
    })
}

pub fn update_time_entry(conn: &Connection, id: i64, updates: &TimeEntryUpdate) -> AppResult<TimeEntry> {
    let mut set_clauses = Vec::new();
    let mut params = Vec::new();

    if let Some(ref label) = updates.label {
        if label.trim().is_empty() {
            return Err("Label cannot be empty".to_string());
        }
        set_clauses.push("label = ?");
        params.push(label.clone());
    }

    if let Some(ref color) = updates.color {
        set_clauses.push("color = ?");
        params.push(color.clone());
    }

    if set_clauses.is_empty() {
        return Err("No updates provided".to_string());
    }

    params.push(id.to_string());

    let sql = format!(
        "UPDATE time_entries SET {} WHERE id = ?",
        set_clauses.join(", ")
    );

    conn.execute(&sql, rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to update time entry: {}", e))?;

    get_time_entry_by_id(conn, id)
}

pub fn delete_time_entry(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM time_entries WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete time entry: {}", e))?;

    Ok(())
}

fn get_time_entry_by_id(conn: &Connection, id: i64) -> AppResult<TimeEntry> {
    conn.query_row(
        "SELECT id, start_time, end_time, label, color FROM time_entries WHERE id = ?",
        params![id],
        |row| {
            Ok(TimeEntry {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                label: row.get(3)?,
                color: row.get(4)?,
            })
        },
    )
    .map_err(|e| format!("Failed to fetch time entry: {}", e))?
}
