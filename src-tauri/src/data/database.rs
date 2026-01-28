use dirs::home_dir;
use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_database_path() -> Result<PathBuf, String> {
    let data_dir = home_dir()
        .ok_or("Failed to get home directory")?
        .join("AppData")
        .join("Local")
        .join("DigitalDiary");

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    Ok(data_dir.join("database.db"))
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(include_str!("migrations/V1__initial_schema.sql"))
        .map_err(|e| format!("Failed to run migrations: {}", e))?;
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

pub fn initialize_database(db_path: &std::path::Path) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    run_migrations(&conn)?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;

    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Failed to set busy timeout: {}", e))?;

    Ok(())
}
