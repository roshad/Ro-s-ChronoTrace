#[cfg(test)]
mod tests {
    use crate::data::time_entries::{
        create_time_entry_impl, delete_time_entry_impl, get_time_entries_impl,
        update_time_entry_impl, TimeEntryInput, TimeEntryUpdate,
    };
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // Create tables
        conn.execute(
            "CREATE TABLE time_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                label TEXT NOT NULL,
                color TEXT
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE INDEX idx_time_entries_start_time ON time_entries(start_time)",
            [],
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_create_time_entry() {
        let conn = setup_test_db();

        let input = TimeEntryInput {
            start_time: 1705490400000, // 2026-01-17 10:00:00
            end_time: 1705494000000,   // 2026-01-17 11:00:00
            label: "Test Task".to_string(),
            color: Some("#4CAF50".to_string()),
        };

        let result = create_time_entry_impl(&conn, &input);
        assert!(result.is_ok());

        let entry = result.unwrap();
        assert_eq!(entry.label, "Test Task");
        assert_eq!(entry.start_time, 1705490400000);
        assert_eq!(entry.end_time, 1705494000000);
        assert_eq!(entry.color, Some("#4CAF50".to_string()));
    }

    #[test]
    fn test_create_time_entry_validation() {
        let conn = setup_test_db();

        // Test invalid: end_time <= start_time
        let input = TimeEntryInput {
            start_time: 1705494000000,
            end_time: 1705490400000, // Earlier than start
            label: "Invalid Task".to_string(),
            color: None,
        };

        let result = create_time_entry_impl(&conn, &input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("end_time must be greater than start_time"));
    }

    #[test]
    fn test_get_time_entries() {
        let conn = setup_test_db();

        // Create test entries
        let input1 = TimeEntryInput {
            start_time: 1705490400000,
            end_time: 1705494000000,
            label: "Task 1".to_string(),
            color: None,
        };
        create_time_entry_impl(&conn, &input1).unwrap();

        let input2 = TimeEntryInput {
            start_time: 1705497600000,
            end_time: 1705501200000,
            label: "Task 2".to_string(),
            color: None,
        };
        create_time_entry_impl(&conn, &input2).unwrap();

        // Get entries for the day (2026-01-17)
        let day_start = 1705449600000; // 2026-01-17 00:00:00
        let result = get_time_entries_impl(&conn, day_start);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].label, "Task 1");
        assert_eq!(entries[1].label, "Task 2");
    }

    #[test]
    fn test_update_time_entry() {
        let conn = setup_test_db();

        // Create entry
        let input = TimeEntryInput {
            start_time: 1705490400000,
            end_time: 1705494000000,
            label: "Original Task".to_string(),
            color: None,
        };
        let entry = create_time_entry_impl(&conn, &input).unwrap();

        // Update entry
        let updates = TimeEntryUpdate {
            label: Some("Updated Task".to_string()),
            color: Some("#FF5733".to_string()),
        };

        let result = update_time_entry_impl(&conn, entry.id, &updates);
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.label, "Updated Task");
        assert_eq!(updated.color, Some("#FF5733".to_string()));
    }

    #[test]
    fn test_delete_time_entry() {
        let conn = setup_test_db();

        // Create entry
        let input = TimeEntryInput {
            start_time: 1705490400000,
            end_time: 1705494000000,
            label: "Task to Delete".to_string(),
            color: None,
        };
        let entry = create_time_entry_impl(&conn, &input).unwrap();

        // Delete entry
        let result = delete_time_entry_impl(&conn, entry.id);
        assert!(result.is_ok());

        // Verify deletion
        let day_start = 1705449600000;
        let entries = get_time_entries_impl(&conn, day_start).unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_empty_label_validation() {
        let conn = setup_test_db();

        let input = TimeEntryInput {
            start_time: 1705490400000,
            end_time: 1705494000000,
            label: "".to_string(), // Empty label
            color: None,
        };

        let result = create_time_entry_impl(&conn, &input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Label cannot be empty"));
    }

    #[test]
    fn test_overlap_detection() {
        let conn = setup_test_db();

        // Create first entry
        let input1 = TimeEntryInput {
            start_time: 1705490400000, // 10:00
            end_time: 1705494000000,   // 11:00
            label: "Task 1".to_string(),
            color: None,
        };
        create_time_entry_impl(&conn, &input1).unwrap();

        // Try to create overlapping entry (10:30 - 11:30)
        let input2 = TimeEntryInput {
            start_time: 1705492200000, // 10:30
            end_time: 1705495800000,   // 11:30
            label: "Task 2".to_string(),
            color: None,
        };

        let result = create_time_entry_impl(&conn, &input2);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("overlaps"));
    }

    #[test]
    fn test_no_overlap_adjacent() {
        let conn = setup_test_db();

        // Create first entry
        let input1 = TimeEntryInput {
            start_time: 1705490400000, // 10:00
            end_time: 1705494000000,   // 11:00
            label: "Task 1".to_string(),
            color: None,
        };
        create_time_entry_impl(&conn, &input1).unwrap();

        // Create adjacent entry (11:00 - 12:00) - should not overlap
        let input2 = TimeEntryInput {
            start_time: 1705494000000, // 11:00
            end_time: 1705497600000,   // 12:00
            label: "Task 2".to_string(),
            color: None,
        };

        let result = create_time_entry_impl(&conn, &input2);
        assert!(result.is_ok());
    }
}
