use rusqlite::Connection;

/// Search activities by keyword
pub fn search_activities(conn: &Connection, query: &str) -> Result<Vec<crate::types::SearchResult>, String> {
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

    let result_iter = stmt.query_map(
        rusqlite::params![&search_pattern, &search_pattern],
        |row| {
            Ok(crate::types::SearchResult {
                r#type: row.get(0)?,
                timestamp: row.get(1)?,
                title: row.get(2)?,
                process_name: row.get(3)?,
            })
        },
    )
    .map_err(|e| format!("Failed to execute search: {}", e))?;

    let mut results = Vec::new();
    for result in result_iter {
        results.push(result.map_err(|e| format!("Failed to map search result: {}", e))?);
    }

    Ok(results)
}

/// Tauri command: Search activities
#[tauri::command]
pub async fn search_activities_cmd(query: String) -> Result<Vec<crate::types::SearchResult>, String> {
    if query.len() < 2 {
        return Err("Query must be at least 2 characters".to_string());
    }

    crate::data::with_db(|conn| search_activities(conn, &query))
}
