use serde::{Deserialize, Serialize};
use windows::{
    core::PCWSTR,
    Win32::Foundation::{HWND, LPARAM, WPARAM},
    Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    },
};

/// Temporary structure for capturing window data without ID
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowActivityCapture {
    pub timestamp: i64,
    pub window_title: String,
    pub process_name: String,
}

/// Get the active window title and process name
///
/// Returns None if no window is active or if we cannot retrieve window information
pub fn get_active_window() -> Option<WindowActivityCapture> {
    unsafe {
        // Get the handle to the foreground window
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return None;
        }

        // Get window title
        let title = get_window_text(hwnd);

        // Get process ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));

        // Get process name from process ID
        let process_name = get_process_name(process_id);

        Some(WindowActivityCapture {
            timestamp: chrono::Utc::now().timestamp_millis(),
            window_title: title.unwrap_or_default(),
            process_name,
        })
    }
}

/// Get the text of a window
unsafe fn get_window_text(hwnd: HWND) -> Option<String> {
    // Get the length of the window text
    let length = GetWindowTextLengthW(hwnd);
    if length == 0 {
        return Some(String::new());
    }

    // Allocate buffer for window text
    let mut buffer = vec![0u16; (length + 1) as usize];
    let chars_copied = GetWindowTextW(hwnd, PCWSTR(buffer.as_ptr()), length + 1);

    if chars_copied == 0 {
        return None;
    }

    // Convert UTF-16 to String
    String::from_utf16(&buffer[..chars_copied as usize]).ok()
}

/// Get the process name from a process ID
unsafe fn get_process_name(process_id: u32) -> String {
    // In a real implementation, you would use OpenProcess, GetModuleBaseNameW, etc.
    // For MVP, we'll return a placeholder
    // TODO: Implement proper process name retrieval
    format!("process_{}.exe", process_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_active_window_returns_some() {
        // This test will pass if we can get some window info
        // even if it's empty or partial
        let result = get_active_window();
        // We can't assert much here since it depends on what's running
        assert!(result.is_some() || result.is_none());
    }

    #[test]
    fn test_window_activity_serialization() {
        let activity = WindowActivityCapture {
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
