use rusqlite::Connection;

/// Search activities by keyword
pub fn search_activities_impl(
    conn: &Connection,
    query: &str,
) -> Result<Vec<crate::types::SearchResult>, String> {
    if query.len() < 2 {
        return Err("Query must be at least 2 characters".to_string());
    }

    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT 'time_entry' as type, start_time as timestamp, label as title, NULL as process_name
         FROM time_entries WHERE label LIKE ?
         UNION ALL
         SELECT 'window_activity' as type, timestamp, window_title as title, process_name
         FROM window_activity WHERE window_title LIKE ?
         ORDER BY timestamp DESC LIMIT 100"
    )
    .map_err(|e| format!("Failed to prepare search query: {}", e))?;

    let result_iter = stmt
        .query_map(rusqlite::params![&search_pattern, &search_pattern], |row| {
            Ok(crate::types::SearchResult {
                r#type: row.get(0)?,
                timestamp: row.get(1)?,
                title: row.get(2)?,
                process_name: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to execute search: {}", e))?;

    let mut results = Vec::new();
    for result in result_iter {
        results.push(result.map_err(|e| format!("Failed to map search result: {}", e))?);
    }

    Ok(results)
}

/// Search activities by keyword within a specific date range
pub fn search_activities_by_date_impl(
    conn: &Connection,
    query: &str,
    start_of_day: i64,
    end_of_day: i64,
) -> Result<Vec<crate::types::SearchResult>, String> {
    if query.len() < 2 {
        return Err("Query must be at least 2 characters".to_string());
    }

    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT 'time_entry' as type, start_time as timestamp, label as title, NULL as process_name
         FROM time_entries WHERE label LIKE ? AND start_time >= ? AND start_time < ?
         UNION ALL
         SELECT 'window_activity' as type, timestamp, window_title as title, process_name
         FROM window_activity WHERE window_title LIKE ? AND timestamp >= ? AND timestamp < ?
         ORDER BY timestamp DESC LIMIT 100"
    )
    .map_err(|e| format!("Failed to prepare search query: {}", e))?;

    let result_iter = stmt
        .query_map(rusqlite::params![&search_pattern, start_of_day, end_of_day, &search_pattern, start_of_day, end_of_day], |row| {
            Ok(crate::types::SearchResult {
                r#type: row.get(0)?,
                timestamp: row.get(1)?,
                title: row.get(2)?,
                process_name: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to execute search: {}", e))?;

    let mut results = Vec::new();
    for result in result_iter {
        results.push(result.map_err(|e| format!("Failed to map search result: {}", e))?);
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("migrations/V1__initial_schema.sql"))
            .unwrap();
        conn
    }

    #[test]
    fn test_search_minimum_length() {
        let conn = setup_test_db();
        let result = search_activities_impl(&conn, "a");
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "Query must be at least 2 characters".to_string()
        );
    }

    #[test]
    fn test_search_empty_results() {
        let conn = setup_test_db();
        let result = search_activities_impl(&conn, "nothing").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_search_time_entries() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![1000, 2000, "Working on project"],
        )
        .unwrap();

        let result = search_activities_impl(&conn, "project").unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].r#type, "time_entry");
        assert_eq!(result[0].title, "Working on project");
        assert!(result[0].process_name.is_none());
    }

    #[test]
    fn test_search_window_activities() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO window_activity (timestamp, window_title, process_name) VALUES (?1, ?2, ?3)",
            rusqlite::params![1500, "VS Code - myproject", "code.exe"],
        )
        .unwrap();

        let result = search_activities_impl(&conn, "VS Code").unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].r#type, "window_activity");
        assert_eq!(result[0].title, "VS Code - myproject");
        assert_eq!(result[0].process_name, Some("code.exe".to_string()));
    }

    #[test]
    fn test_search_combined_results() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![1000, 2000, "Code review"],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO window_activity (timestamp, window_title, process_name) VALUES (?1, ?2, ?3)",
            rusqlite::params![1500, "Visual Studio Code", "code.exe"],
        )
        .unwrap();

        let result = search_activities_impl(&conn, "Code").unwrap();

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_search_case_insensitive() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![1000, 2000, "MEETING notes"],
        )
        .unwrap();

        let result = search_activities_impl(&conn, "meeting").unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_search_ordering_by_timestamp_desc() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![1000, 2000, "First task"],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![3000, 4000, "Second task"],
        )
        .unwrap();

        let result = search_activities_impl(&conn, "task").unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].title, "Second task"); // newest first
        assert_eq!(result[1].title, "First task");
    }
}
