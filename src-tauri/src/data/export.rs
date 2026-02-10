use chrono::Utc;
use rusqlite::Connection;
use std::path::Path;

/// Export all data to JSON
pub fn export_data_impl(conn: &Connection) -> Result<crate::types::ExportData, String> {
    // Check if category_id column exists
    let has_category_id: bool = conn
        .query_row(
            "SELECT count(*) FROM pragma_table_info('time_entries') WHERE name='category_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0)
        == 1;

    let query = if has_category_id {
        "SELECT id, start_time, end_time, label, color, category_id FROM time_entries ORDER BY start_time"
    } else {
        "SELECT id, start_time, end_time, label, color, NULL as category_id FROM time_entries ORDER BY start_time"
    };

    // Get all time entries
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare time entries query: {}", e))?;

    let time_entries: Vec<crate::types::TimeEntry> = stmt
        .query_map([], |row| {
            Ok(crate::types::TimeEntry {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                label: row.get(3)?,
                color: row.get(4)?,
                category_id: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query time entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect time entries: {}", e))?;

    // Get all screenshots
    let mut stmt = conn
        .prepare("SELECT timestamp, file_path FROM screenshots ORDER BY timestamp")
        .map_err(|e| format!("Failed to prepare screenshots query: {}", e))?;

    let screenshots: Vec<crate::types::ScreenshotRef> = stmt
        .query_map([], |row| {
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

    let window_activities: Vec<crate::types::WindowActivity> = stmt
        .query_map([], |row| {
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
    let mut stmt = conn
        .prepare(
            "SELECT id, start_time, end_time, resolution FROM idle_periods ORDER BY start_time",
        )
        .map_err(|e| format!("Failed to prepare idle periods query: {}", e))?;

    let idle_periods: Vec<crate::types::IdlePeriod> = stmt
        .query_map([], |row| {
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

/// Export time entries to CSV
#[allow(dead_code)]
pub fn export_to_csv_impl(
    conn: &Connection,
    export_path: &Path,
    options: &crate::types::ExportOptions,
) -> Result<(), String> {
    // Check if category_id column exists
    let has_category_id: bool = conn
        .query_row(
            "SELECT count(*) FROM pragma_table_info('time_entries') WHERE name='category_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0)
        == 1;

    let select_part = if has_category_id {
        "SELECT id, start_time, end_time, label, color, category_id FROM time_entries"
    } else {
        "SELECT id, start_time, end_time, label, color, NULL as category_id FROM time_entries"
    };

    let mut query = select_part.to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(start_date) = options.start_date {
        query.push_str(" WHERE start_time >= ?");
        params.push(start_date.to_string());
    }

    if let Some(end_date) = options.end_date {
        if params.is_empty() {
            query.push_str(" WHERE end_time <= ?");
        } else {
            query.push_str(" AND end_time <= ?");
        }
        params.push(end_date.to_string());
    }

    query.push_str(" ORDER BY start_time");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let entries: Vec<crate::types::TimeEntry> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(crate::types::TimeEntry {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                label: row.get(3)?,
                color: row.get(4)?,
                category_id: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query time entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect time entries: {}", e))?;

    let mut csv_content = String::from("id,start_time,end_time,label,color,category_id\n");
    for entry in entries {
        csv_content.push_str(&format!(
            "{},{},{},{},{},{}\n",
            entry.id,
            entry.start_time,
            entry.end_time,
            entry.label,
            entry.color.as_deref().unwrap_or(""),
            entry.category_id.map(|id| id.to_string()).unwrap_or_default()
        ));
    }

    std::fs::write(export_path, csv_content)
        .map_err(|e| format!("Failed to write CSV file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("migrations/V1__initial_schema.sql"))
            .unwrap();
        // Manually add category_id for tests since V1 doesn't have it
        conn.execute("ALTER TABLE time_entries ADD COLUMN category_id INTEGER", [])
            .unwrap();
        conn
    }

    #[test]
    fn test_export_data_empty() {
        let conn = setup_test_db();
        let result = export_data_impl(&conn).unwrap();

        assert_eq!(result.version, "1.0");
        assert!(result.time_entries.is_empty());
        assert!(result.screenshots.is_empty());
        assert!(result.window_activities.is_empty());
        assert!(result.idle_periods.is_empty());
        assert!(!result.exported_at.is_empty());
    }

    #[test]
    fn test_export_data_with_entries() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![1000, 2000, "Work", Some("#FF0000")],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO screenshots (timestamp, file_path, day_id) VALUES (?1, ?2, ?3)",
            rusqlite::params![1500, "screenshots/2026/01/28/shot.png", 20260128],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO window_activity (timestamp, window_title, process_name) VALUES (?1, ?2, ?3)",
            rusqlite::params![1200, "VS Code", "code.exe"],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO idle_periods (start_time, end_time, resolution) VALUES (?1, ?2, ?3)",
            rusqlite::params![3000, 4000, "discarded"],
        )
        .unwrap();

        let result = export_data_impl(&conn).unwrap();

        assert_eq!(result.time_entries.len(), 1);
        assert_eq!(result.time_entries[0].label, "Work");
        assert_eq!(result.screenshots.len(), 1);
        assert_eq!(
            result.screenshots[0].file_path,
            "screenshots/2026/01/28/shot.png"
        );
        assert_eq!(result.window_activities.len(), 1);
        assert_eq!(result.window_activities[0].window_title, "VS Code");
        assert_eq!(result.idle_periods.len(), 1);
        assert_eq!(
            result.idle_periods[0].resolution,
            Some("discarded".to_string())
        );
    }

    #[test]
    fn test_export_data_ordering() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![2000, 3000, "Second"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![1000, 2000, "First"],
        )
        .unwrap();

        let result = export_data_impl(&conn).unwrap();

        assert_eq!(result.time_entries.len(), 2);
        assert_eq!(result.time_entries[0].label, "First");
        assert_eq!(result.time_entries[1].label, "Second");
    }

    #[test]
    fn test_export_to_csv() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![1000, 2000, "Work", Some("#FF0000")],
        )
        .unwrap();

        let tmp_dir = std::env::temp_dir().join("digital_diary_test_csv");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let csv_path = tmp_dir.join("test_export.csv");

        let options = crate::types::ExportOptions {
            start_date: None,
            end_date: None,
            include_screenshots: false,
        };

        export_to_csv_impl(&conn, &csv_path, &options).unwrap();

        let content = std::fs::read_to_string(&csv_path).unwrap();
        assert!(content.starts_with("id,start_time,end_time,label,color,category_id\n"));
        assert!(content.contains("Work"));
        assert!(content.contains("#FF0000"));

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }
}
