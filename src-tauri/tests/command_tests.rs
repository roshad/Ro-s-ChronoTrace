// Integration tests for Tauri commands
// These tests verify end-to-end command functionality

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    // Import command handlers from the main crate
    use digital_diary::data::export::export_to_csv_impl;
    use digital_diary::data::search::search_activities_impl;
    use digital_diary::data::time_entries::{
        create_time_entry_impl, delete_time_entry_impl, get_time_entries_impl,
        update_time_entry_impl,
    };
    use digital_diary::types::{ExportOptions, SearchQuery, TimeEntryInput, TimeEntryUpdate};

    #[test]
    fn test_create_time_entry_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Create a time entry input
        let input = TimeEntryInput {
            start_time: 1000,
            end_time: 2000,
            label: "Test Entry".to_string(),
            color: Some("#4CAF50".to_string()),
        };

        // Execute the create_time_entry_impl function
        let result = create_time_entry_impl(&conn, &input);
        assert!(result.is_ok(), "Create time entry should succeed");

        // Verify the entry was created
        let entry = result.unwrap();
        assert!(entry.id > 0, "Entry ID should be positive");

        // Verify the entry exists in the database
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM time_entries WHERE id = ?",
                [entry.id],
                |row| row.get(0),
            )
            .expect("Failed to query time entry");

        assert_eq!(count, 1, "Entry should exist in database");
    }

    #[test]
    fn test_get_time_entries_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Insert test entries
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Entry 1", "#4CAF50"),
        )
        .expect("Failed to insert time entry");

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (3000i64, 4000i64, "Entry 2", "#2196F3"),
        )
        .expect("Failed to insert time entry");

        // Execute the get_time_entries_impl function
        let result = get_time_entries_impl(&conn, 1000);
        assert!(result.is_ok(), "Get time entries should succeed");

        // Verify we got 2 entries
        let entries = result.unwrap();
        assert_eq!(entries.len(), 2, "Should have 2 time entries");

        // Verify the entries have correct labels
        let labels: Vec<String> = entries.iter().map(|e| e.label.clone()).collect();
        assert!(
            labels.contains(&"Entry 1".to_string()),
            "Should contain Entry 1"
        );
        assert!(
            labels.contains(&"Entry 2".to_string()),
            "Should contain Entry 2"
        );
    }

    #[test]
    fn test_update_time_entry_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Insert a test entry
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Original Label", "#4CAF50"),
        )
        .expect("Failed to insert time entry");

        let entry_id: i64 = conn.last_insert_rowid();

        // Create an update input
        let update = TimeEntryUpdate {
            label: Some("Updated Label".to_string()),
            color: Some("#2196F3".to_string()),
        };

        // Execute the update_time_entry_impl function
        let result = update_time_entry_impl(&conn, entry_id, &update);
        assert!(result.is_ok(), "Update time entry should succeed");

        // Verify the entry was updated
        let updated_label: String = conn
            .query_row(
                "SELECT label FROM time_entries WHERE id = ?",
                [entry_id],
                |row| row.get(0),
            )
            .expect("Failed to query time entry");

        assert_eq!(updated_label, "Updated Label", "Label should be updated");

        let updated_color: String = conn
            .query_row(
                "SELECT color FROM time_entries WHERE id = ?",
                [entry_id],
                |row| row.get(0),
            )
            .expect("Failed to query time entry");

        assert_eq!(updated_color, "#2196F3", "Color should be updated");
    }

    #[test]
    fn test_delete_time_entry_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Insert a test entry
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Test Entry", "#4CAF50"),
        )
        .expect("Failed to insert time entry");

        let entry_id: i64 = conn.last_insert_rowid();

        // Execute the delete_time_entry_impl function
        let result = delete_time_entry_impl(&conn, entry_id);
        assert!(result.is_ok(), "Delete time entry should succeed");

        // Verify the entry was deleted
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM time_entries WHERE id = ?",
                [entry_id],
                |row| row.get(0),
            )
            .expect("Failed to query time entry");

        assert_eq!(count, 0, "Entry should be deleted");
    }

    #[test]
    fn test_search_activities_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Insert test entries
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Work Project", "#4CAF50"),
        )
        .expect("Failed to insert time entry");

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (3000i64, 4000i64, "Meeting Notes", "#2196F3"),
        )
        .expect("Failed to insert time entry");

        // Execute the search_activities_impl function
        let result = search_activities_impl(&conn, "work");
        assert!(result.is_ok(), "Search activities should succeed");

        // Verify we got results
        let results = result.unwrap();
        assert!(results.len() > 0, "Should have search results");

        // Verify the results contain the expected entry
        let has_work_project = results.iter().any(|r| r.title.contains("Work"));
        assert!(has_work_project, "Should contain 'Work Project' in results");
    }

    #[test]
    fn test_export_to_csv_command() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");
        let export_path = temp_dir.path().join("export.csv");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Insert test entries
        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (1000i64, 2000i64, "Entry 1", "#4CAF50"),
        )
        .expect("Failed to insert time entry");

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, color) VALUES (?1, ?2, ?3, ?4)",
            (3000i64, 4000i64, "Entry 2", "#2196F3"),
        )
        .expect("Failed to insert time entry");

        // Create export options
        let options = ExportOptions {
            start_date: None,
            end_date: None,
            include_screenshots: false,
        };

        // Execute the export_to_csv_impl function
        let result = export_to_csv_impl(&conn, &export_path, &options);
        assert!(result.is_ok(), "Export to CSV should succeed");

        // Verify the export file was created
        assert!(export_path.exists(), "Export file should exist");

        // Verify the export file has content
        let content = std::fs::read_to_string(&export_path).expect("Failed to read export file");

        assert!(content.contains("Entry 1"), "Export should contain Entry 1");
        assert!(content.contains("Entry 2"), "Export should contain Entry 2");
    }

    #[test]
    fn test_command_error_handling() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Try to update a non-existent entry
        let update = TimeEntryUpdate {
            label: Some("Updated Label".to_string()),
            color: None,
        };

        let result = update_time_entry_impl(&conn, 99999, &update);
        assert!(result.is_err(), "Update non-existent entry should fail");

        // Try to delete a non-existent entry
        let result = delete_time_entry_impl(&conn, 99999);
        assert!(result.is_err(), "Delete non-existent entry should fail");
    }

    #[test]
    fn test_command_validation() {
        // Create a temporary directory for the test database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");

        // Initialize the database
        let _ = digital_diary::data::database::initialize_database(&db_path)
            .expect("Failed to initialize database");

        // Create a connection
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to connect to database");

        // Test creating an entry with invalid data (end_time before start_time)
        let input = TimeEntryInput {
            start_time: 2000,
            end_time: 1000,
            label: "Invalid Entry".to_string(),
            color: Some("#4CAF50".to_string()),
        };

        let result = create_time_entry_impl(&conn, &input);
        // This should fail (validation is handled in create_time_entry_impl)
        assert!(
            result.is_err(),
            "Create entry with invalid data should fail"
        );

        // Verify the entry was not created
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM time_entries", [], |row| row.get(0))
            .expect("Failed to query time entries");

        assert_eq!(count, 0, "Entry should not be created");
    }
}
