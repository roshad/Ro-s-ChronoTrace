use crate::data::AppResult;
use crate::types::{TimeEntry, TimeEntryInput, TimeEntryUpdate};
use rusqlite::{params, Connection};

#[cfg(test)]
#[path = "time_entries_tests.rs"]
mod tests;

pub fn get_time_entries_impl(conn: &Connection, date: i64) -> AppResult<Vec<TimeEntry>> {
    let start_of_day = date;
    let end_of_day = date + 86400000;

    let mut stmt = conn
        .prepare(
            "SELECT id, start_time, end_time, label, color, category_id FROM time_entries 
         WHERE start_time >= ? AND start_time < ? 
         ORDER BY start_time",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let entry_iter = stmt
        .query_map(params![start_of_day, end_of_day], |row| {
            Ok(TimeEntry {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                label: row.get(3)?,
                color: row.get(4)?,
                category_id: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query time entries: {}", e))?;

    let mut entries = Vec::new();
    for entry in entry_iter {
        entries.push(entry.map_err(|e| format!("Failed to map row: {}", e))?);
    }

    Ok(entries)
}

pub fn create_time_entry_impl(conn: &Connection, entry: &TimeEntryInput) -> AppResult<TimeEntry> {
    if entry.end_time <= entry.start_time {
        return Err("end_time must be greater than start_time".to_string());
    }

    if entry.label.trim().is_empty() {
        return Err("Label cannot be empty".to_string());
    }

    // Check for overlapping entries on the same day
    let start_of_day = entry.start_time - (entry.start_time % 86400000);
    let end_of_day = start_of_day + 86400000;

    let mut stmt = conn
        .prepare(
            "SELECT id, start_time, end_time FROM time_entries 
         WHERE start_time >= ? AND start_time < ?",
        )
        .map_err(|e| format!("Failed to prepare overlap check query: {}", e))?;

    let entry_iter = stmt
        .query_map(params![start_of_day, end_of_day], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query existing entries: {}", e))?;

    for existing_entry in entry_iter {
        let (_, existing_start, existing_end) =
            existing_entry.map_err(|e| format!("Failed to map existing entry: {}", e))?;

        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        if entry.start_time < existing_end && entry.end_time > existing_start {
            return Err("Time entry overlaps with an existing entry on the same day".to_string());
        }
    }

    conn.execute(
        "INSERT INTO time_entries (start_time, end_time, label, color, category_id) VALUES (?, ?, ?, ?, ?)",
        params![
            entry.start_time,
            entry.end_time,
            &entry.label,
            &entry.color,
            entry.category_id
        ],
    )
    .map_err(|e| format!("Failed to insert time entry: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(TimeEntry {
        id,
        start_time: entry.start_time,
        end_time: entry.end_time,
        label: entry.label.clone(),
        color: entry.color.clone(),
        category_id: entry.category_id,
    })
}

pub fn update_time_entry_impl(
    conn: &Connection,
    id: i64,
    updates: &TimeEntryUpdate,
) -> AppResult<TimeEntry> {
    let existing = get_time_entry_by_id(conn, id)?;
    let next_start_time = updates.start_time.unwrap_or(existing.start_time);
    let next_end_time = updates.end_time.unwrap_or(existing.end_time);

    if next_end_time <= next_start_time {
        return Err("end_time must be greater than start_time".to_string());
    }

    if updates.start_time.is_some() || updates.end_time.is_some() {
        let overlap_count: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM time_entries
                 WHERE id != ?1 AND start_time < ?2 AND end_time > ?3",
                params![id, next_end_time, next_start_time],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to check overlapping entries: {}", e))?;

        if overlap_count > 0 {
            return Err("Time entry overlaps with an existing entry".to_string());
        }
    }

    let mut set_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(start_time) = updates.start_time {
        set_clauses.push("start_time = ?");
        params.push(Box::new(start_time));
    }

    if let Some(end_time) = updates.end_time {
        set_clauses.push("end_time = ?");
        params.push(Box::new(end_time));
    }

    if let Some(ref label) = updates.label {
        if label.trim().is_empty() {
            return Err("Label cannot be empty".to_string());
        }
        set_clauses.push("label = ?");
        params.push(Box::new(label.clone()));
    }

    if let Some(ref color) = updates.color {
        set_clauses.push("color = ?");
        params.push(Box::new(color.clone()));
    }

    if let Some(category_id) = updates.category_id {
        set_clauses.push("category_id = ?");
        params.push(Box::new(category_id));
    }

    if set_clauses.is_empty() {
        return Err("No updates provided".to_string());
    }

    let sql = format!(
        "UPDATE time_entries SET {} WHERE id = ?",
        set_clauses.join(", ")
    );

    // Collect references for rusqlite
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut all_params = params_refs;
    all_params.push(&id);

    conn.execute(&sql, rusqlite::params_from_iter(all_params))
        .map_err(|e| format!("Failed to update time entry: {}", e))?;

    get_time_entry_by_id(conn, id)
}

pub fn delete_time_entry_impl(conn: &Connection, id: i64) -> AppResult<()> {
    let rows_affected = conn
        .execute("DELETE FROM time_entries WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete time entry: {}", e))?;

    if rows_affected == 0 {
        return Err("Time entry not found".to_string());
    }

    Ok(())
}

fn get_time_entry_by_id(conn: &Connection, id: i64) -> AppResult<TimeEntry> {
    conn.query_row(
        "SELECT id, start_time, end_time, label, color, category_id FROM time_entries WHERE id = ?",
        params![id],
        |row| {
            Ok(TimeEntry {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                label: row.get(3)?,
                color: row.get(4)?,
                category_id: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Failed to fetch time entry: {}", e))
}
