use dirs::home_dir;
use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_database_path() -> Result<PathBuf, String> {
    let data_dir = home_dir()
        .ok_or("Failed to get home directory")?
        .join("AppData")
        .join("Local")
        .join("RosChronoTrace");

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    Ok(data_dir.join("database.db"))
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(include_str!("migrations/V1__initial_schema.sql"))
        .map_err(|e| format!("Failed to run V1 migrations: {}", e))?;

    // Check if category_id exists in time_entries
    let category_count: i32 = conn
        .query_row(
            "SELECT count(*) FROM pragma_table_info('time_entries') WHERE name='category_id'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check for category_id: {}", e))?;
    let has_category_id = category_count == 1;

    if !has_category_id {
        conn.execute_batch(include_str!("migrations/V2__categories.sql"))
            .map_err(|e| format!("Failed to run V2 migrations: {}", e))?;
    }

    let process_samples_table_count: i32 = conn
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='process_samples'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check for process_samples table: {}", e))?;
    let has_process_samples = process_samples_table_count == 1;

    if !has_process_samples {
        conn.execute_batch(include_str!("migrations/V3__process_samples.sql"))
            .map_err(|e| format!("Failed to run V3 migrations: {}", e))?;
    }

    Ok(())
}

pub fn init_database() -> Result<Connection, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    run_migrations(&conn)?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;

    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Failed to set busy timeout: {}", e))?;

    Ok(conn)
}

#[allow(dead_code)]
pub fn initialize_database(db_path: &std::path::Path) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    run_migrations(&conn)?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;

    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Failed to set busy timeout: {}", e))?;

    Ok(())
}

