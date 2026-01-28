// Integration tests for database operations
// These tests verify end-to-end database functionality

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use tempfile::TempDir;

    // Import database functions from the main crate
    use digital_diary::data::database::initialize_database;

    #[test]
    fn test_database_initialization() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let result = initialize_database(&db_path);
        assert!(result.is_ok(), "Database initialization should succeed");

        // Verify the database file was created
        assert!(db_path.exists(), "Database file should exist");

        // Verify we can connect to the database
        let conn = Connection::open(&db_path).expect("Failed to connect to database");

        // Verify the time_entries table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='time_entries'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query database");
        assert!(table_exists, "time_entries table should exist");

        // Verify the screenshots table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='screenshots'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query database");
        assert!(table_exists, "screenshots table should exist");

        // Verify the window_activity table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='window_activity'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query database");
        assert!(table_exists, "window_activity table should exist");
    }

    #[test]
    fn test_database_connection_persistence() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        initialize_database(&db_path).expect("Failed to initialize database");

        // Create a connection and insert test data
        let conn = Connection::open(&db_path).expect("Failed to connect to database");

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Test Entry", Some("#4CAF50".to_string())),
        )
        .expect("Failed to insert time entry");

        // Close the connection
        drop(conn);

        // Open a new connection and verify the data persists
        let conn = Connection::open(&db_path).expect("Failed to reconnect to database");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM time_entries", [], |row| row.get(0))
            .expect("Failed to query time entries");

        assert_eq!(count, 1, "Should have 1 time entry");

        let label: String = conn
            .query_row("SELECT label FROM time_entries WHERE id = 1", [], |row| {
                row.get(0)
            })
            .expect("Failed to query time entry");

        assert_eq!(label, "Test Entry", "Label should match");
    }

    #[test]
    fn test_database_transaction_rollback() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        initialize_database(&db_path).expect("Failed to initialize database");

        // Create a connection
        let conn = Connection::open(&db_path).expect("Failed to connect to database");

        // Start a transaction
        let tx = conn
            .unchecked_transaction()
            .expect("Failed to start transaction");

        // Insert a time entry within the transaction
        tx.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Test Entry", Some("#4CAF50".to_string())),
        )
        .expect("Failed to insert time entry");

        // Rollback the transaction
        tx.rollback().expect("Failed to rollback transaction");

        // Verify the entry was not committed
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM time_entries", [], |row| row.get(0))
            .expect("Failed to query time entries");

        assert_eq!(count, 0, "Should have 0 time entries after rollback");
    }

    #[test]
    fn test_database_transaction_commit() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        initialize_database(&db_path).expect("Failed to initialize database");

        // Create a connection
        let conn = Connection::open(&db_path).expect("Failed to connect to database");

        // Start a transaction
        let tx = conn
            .unchecked_transaction()
            .expect("Failed to start transaction");

        // Insert a time entry within the transaction
        tx.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Test Entry", Some("#4CAF50".to_string())),
        )
        .expect("Failed to insert time entry");

        // Commit the transaction
        tx.commit().expect("Failed to commit transaction");

        // Verify the entry was committed
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM time_entries", [], |row| row.get(0))
            .expect("Failed to query time entries");

        assert_eq!(count, 1, "Should have 1 time entry after commit");
    }

    #[test]
    fn test_database_concurrent_access() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        initialize_database(&db_path).expect("Failed to initialize database");

        // Create two connections to simulate concurrent access
        let conn1 = Connection::open(&db_path).expect("Failed to connect to database");
        let conn2 = Connection::open(&db_path).expect("Failed to connect to database");

        // Insert data from connection 1
        conn1.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Entry 1", Some("#4CAF50".to_string())),
        )
        .expect("Failed to insert time entry");

        // Insert data from connection 2
        conn2.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (3000i64, 4000i64, "Entry 2", Some("#2196F3".to_string())),
        )
        .expect("Failed to insert time entry");

        // Verify both entries exist
        let count: i64 = conn1
            .query_row("SELECT COUNT(*) FROM time_entries", [], |row| row.get(0))
            .expect("Failed to query time entries");

        assert_eq!(count, 2, "Should have 2 time entries");
    }
}
