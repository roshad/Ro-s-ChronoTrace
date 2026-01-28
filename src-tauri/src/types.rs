use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TimeEntry {
    pub id: i64,
    pub start_time: i64,
    pub end_time: i64,
    pub label: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TimeEntryInput {
    pub start_time: i64,
    pub end_time: i64,
    pub label: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TimeEntryUpdate {
    pub label: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WindowActivity {
    pub id: i64,
    pub timestamp: i64,
    pub window_title: String,
    pub process_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IdlePeriod {
    pub id: i64,
    pub start_time: i64,
    pub end_time: i64,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IdlePeriodResolution {
    pub id: i64,
    pub resolution: String,
    pub target_entry_id: Option<i64>,
    pub new_entry_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SearchResult {
    pub r#type: String,
    pub timestamp: i64,
    pub title: String,
    pub process_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SearchQuery {
    pub query: String,
    pub limit: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScreenshotInfo {
    pub file_path: Option<String>,
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExportOptions {
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
    pub include_screenshots: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExportData {
    pub version: String,
    pub exported_at: String,
    pub time_entries: Vec<TimeEntry>,
    pub screenshots: Vec<ScreenshotRef>,
    pub window_activities: Vec<WindowActivity>,
    pub idle_periods: Vec<IdlePeriod>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScreenshotRef {
    pub timestamp: i64,
    pub file_path: String,
}

// specta configuration for TypeScript type generation
// Note: Type export is handled by specta::specta!() macro
// which registers all types with the specta type system
