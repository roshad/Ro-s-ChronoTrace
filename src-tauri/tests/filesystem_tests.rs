// Integration tests for filesystem operations
// These tests verify end-to-end file handling functionality

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::TempDir;

    // Import screenshot functions from the main crate
    use digital_diary::data::screenshot::{get_screenshot_path, save_screenshot};

    #[test]
    fn test_screenshot_directory_creation() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Verify the path is correct
        assert!(
            screenshot_path.ends_with("screenshots"),
            "Screenshot path should end with 'screenshots'"
        );

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Verify the directory exists
        assert!(
            screenshot_path.exists(),
            "Screenshots directory should exist"
        );
    }

    #[test]
    fn test_screenshot_file_creation() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Create test screenshot data
        let screenshot_data = vec![0u8; 100]; // Simple test data

        // Save screenshot
        let result = save_screenshot(&base_path, 1234567890, screenshot_data.clone());
        assert!(result.is_ok(), "Screenshot save should succeed");

        // Verify the file exists
        let saved_path = result.unwrap();
        assert!(saved_path.exists(), "Screenshot file should exist");

        // Verify the file has the correct content
        let saved_data = fs::read(&saved_path).expect("Failed to read screenshot file");
        assert_eq!(saved_data, screenshot_data, "Screenshot data should match");
    }

    #[test]
    fn test_screenshot_unique_filenames() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Create test screenshot data
        let screenshot_data = vec![0u8; 100];

        // Save multiple screenshots with the same timestamp
        let result1 = save_screenshot(&base_path, 1234567890, screenshot_data.clone());
        let result2 = save_screenshot(&base_path, 1234567890, screenshot_data.clone());

        assert!(result1.is_ok(), "First screenshot save should succeed");
        assert!(result2.is_ok(), "Second screenshot save should succeed");

        // Verify both files exist
        let path1 = result1.unwrap();
        let path2 = result2.unwrap();

        assert!(path1.exists(), "First screenshot file should exist");
        assert!(path2.exists(), "Second screenshot file should exist");

        // Verify they have different filenames (should include counter)
        assert_ne!(path1, path2, "Screenshot filenames should be unique");
    }

    #[test]
    fn test_screenshot_directory_structure() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Create test screenshot data
        let screenshot_data = vec![0u8; 100];

        // Save screenshots for different timestamps
        let timestamps = [1234567890, 1234567891, 1234567892];
        for timestamp in timestamps {
            save_screenshot(&base_path, timestamp, screenshot_data.clone())
                .expect("Failed to save screenshot");
        }

        // Verify all files exist
        let entries: Vec<_> = fs::read_dir(&screenshot_path)
            .expect("Failed to read screenshots directory")
            .collect();
        assert_eq!(entries.len(), 3, "Should have 3 screenshot files");

        // Verify all files are PNG files
        for entry in entries {
            let entry = entry.expect("Failed to read directory entry");
            let path = entry.path();
            let extension = path
                .extension()
                .and_then(|ext: &std::ffi::OsStr| ext.to_str());
            assert_eq!(
                extension,
                Some("png"),
                "Screenshot files should be PNG format"
            );
        }
    }

    #[test]
    fn test_screenshot_cleanup() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Create test screenshot data
        let screenshot_data = vec![0u8; 100];

        // Save a screenshot
        let result = save_screenshot(&base_path, 1234567890, screenshot_data.clone());
        assert!(result.is_ok(), "Screenshot save should succeed");

        let saved_path = result.unwrap();
        assert!(saved_path.exists(), "Screenshot file should exist");

        // Delete the screenshot
        fs::remove_file(&saved_path).expect("Failed to delete screenshot file");

        // Verify the file no longer exists
        assert!(!saved_path.exists(), "Screenshot file should be deleted");
    }

    #[test]
    fn test_screenshot_large_file() {
        // Create a temporary directory for testing
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let base_path = temp_dir.path();

        // Get screenshot path
        let screenshot_path = get_screenshot_path(&base_path);

        // Create the directory
        fs::create_dir_all(&screenshot_path).expect("Failed to create screenshots directory");

        // Create large screenshot data (1MB)
        let screenshot_data: Vec<u8> = vec![0u8; 1024 * 1024];

        // Save screenshot
        let result = save_screenshot(&base_path, 1234567890, screenshot_data);
        assert!(result.is_ok(), "Large screenshot save should succeed");

        // Verify the file exists and has correct size
        let saved_path = result.unwrap();
        assert!(saved_path.exists(), "Large screenshot file should exist");

        let metadata = fs::metadata(&saved_path).expect("Failed to get file metadata");
        assert_eq!(
            metadata.len(),
            1024 * 1024,
            "Large screenshot file should have correct size"
        );
    }
}
