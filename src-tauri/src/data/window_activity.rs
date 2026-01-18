use rusqlite::{Connection, params};
use crate::types::WindowActivity;
use crate::data::AppResult;

/// Insert a single window activity record
pub fn insert_window_activity(conn: &Connection, activity: &WindowActivity) -> AppResult<()> {
    conn.execute(
        "INSERT INTO window_activity (timestamp, window_title, process_name) VALUES (?, ?, ?)",
        params![activity.timestamp, &activity.window_title, &activity.process_name],
    )
    .map_err(|e| format!("Failed to insert window activity: {}", e))?;

    Ok(())
}

/// Insert multiple window activity records in a batch
pub fn insert_window_activities_batch(conn: &Connection, activities: &[WindowActivity]) -> AppResult<()> {
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for activity in activities {
        tx.execute(
            "INSERT INTO window_activity (timestamp, window_title, process_name) VALUES (?, ?, ?)",
            params![activity.timestamp, &activity.window_title, &activity.process_name],
        )
        .map_err(|e| format!("Failed to insert window activity: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

/// Get window activities for a specific date range
pub fn get_window_activities(conn: &Connection, start_time: i64, end_time: i64) -> AppResult<Vec<WindowActivity>> {
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, window_title, process_name FROM window_activity
         WHERE timestamp >= ? AND timestamp < ?
         ORDER BY timestamp"
    )
    .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let activity_iter = stmt.query_map(params![start_time, end_time], |row| {
        Ok(WindowActivity {
            timestamp: row.get(1)?,
            window_title: row.get(2)?,
            process_name: row.get(3)?,
        })
    })
    .map_err(|e| format!("Failed to query window activities: {}", e))?;

    let mut activities = Vec::new();
    for activity in activity_iter {
        activities.push(activity.map_err(|e| format!("Failed to map row: {}", e))?);
    }

    Ok(activities)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_activity_serialization() {
        let activity = WindowActivity {
            timestamp: 1234567890,
            window_title: "Test Window".to_string(),
            process_name: "test.exe".to_string(),
        };

        let json = serde_json::to_string(&activity).unwrap();
        let deserialized: WindowActivity = serde_json::from_str(&json).unwrap();

        assert_eq!(activity.timestamp, deserialized.timestamp);
        assert_eq!(activity.window_title, deserialized.window_title);
        assert_eq!(activity.process_name, deserialized.process_name);
    }
}
