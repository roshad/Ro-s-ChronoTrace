use crate::data::AppResult;
use crate::types::{IdlePeriod, IdlePeriodResolution};
use rusqlite::Connection;

/// Insert an idle period into the database
pub fn insert_idle_period(conn: &Connection, start_time: i64, end_time: i64) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO idle_periods (start_time, end_time, resolution) VALUES (?1, ?2, NULL)",
        rusqlite::params![start_time, end_time],
    )
    .map_err(|e| format!("Failed to insert idle period: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Update idle period resolution
pub fn update_idle_period_resolution(
    conn: &Connection,
    id: i64,
    resolution: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE idle_periods SET resolution = ?1 WHERE id = ?2",
        rusqlite::params![resolution, id],
    )
    .map_err(|e| format!("Failed to update idle period: {}", e))?;

    Ok(())
}

/// Get idle period by ID
pub fn get_idle_period(conn: &Connection, id: i64) -> AppResult<IdlePeriod> {
    let mut stmt = conn
        .prepare("SELECT id, start_time, end_time, resolution FROM idle_periods WHERE id = ?1")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let period = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(IdlePeriod {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                resolution: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to get idle period: {}", e))?;

    Ok(period)
}

/// Get all idle periods for a specific day
pub fn get_idle_periods_for_day(
    conn: &Connection,
    day_start: i64,
    day_end: i64,
) -> AppResult<Vec<IdlePeriod>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, start_time, end_time, resolution FROM idle_periods
             WHERE start_time >= ?1 AND start_time < ?2
             ORDER BY start_time",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let periods = stmt
        .query_map(rusqlite::params![day_start, day_end], |row| {
            Ok(IdlePeriod {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                resolution: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query idle periods: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect idle periods: {}", e))?;

    Ok(periods)
}

/// Resolve an idle period
///
/// Handles three resolution types:
/// - "discarded": Mark as discarded, keep as gap
/// - "merged": Merge with previous time entry (extend end_time)
/// - "labeled": Create new time entry with provided label
pub fn resolve_idle_period_with_action(
    conn: &Connection,
    resolution: &IdlePeriodResolution,
) -> AppResult<IdlePeriod> {
    // Get the idle period
    let period = get_idle_period(conn, resolution.id)?;

    match resolution.resolution.as_str() {
        "discarded" => {
            // Just mark as discarded
            update_idle_period_resolution(conn, resolution.id, "discarded")?;
        }
        "merged" => {
            // Merge with target entry (extend its end_time)
            if let Some(target_id) = resolution.target_entry_id {
                conn.execute(
                    "UPDATE time_entries SET end_time = ?1 WHERE id = ?2",
                    rusqlite::params![period.end_time, target_id],
                )
                .map_err(|e| format!("Failed to merge idle period: {}", e))?;

                update_idle_period_resolution(conn, resolution.id, "merged")?;
            } else {
                return Err("target_entry_id required for 'merged' resolution".to_string());
            }
        }
        "labeled" => {
            // Create new time entry
            if let Some(label) = &resolution.new_entry_label {
                use crate::types::TimeEntryInput;
                let entry_input = TimeEntryInput {
                    start_time: period.start_time,
                    end_time: period.end_time,
                    label: label.clone(),
                    color: None,
                    category_id: None,
                };

                crate::data::time_entries::create_time_entry_impl(conn, &entry_input)?;
                update_idle_period_resolution(conn, resolution.id, "labeled")?;
            } else {
                return Err("new_entry_label required for 'labeled' resolution".to_string());
            }
        }
        _ => {
            return Err(format!(
                "Invalid resolution type: {}",
                resolution.resolution
            ));
        }
    }

    // Return updated idle period
    get_idle_period(conn, resolution.id)
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_idle_period_crud() {
        // This would require a test database setup
        // Placeholder for future implementation
    }
}
