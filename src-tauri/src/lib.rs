// Library exports for integration tests

pub mod capture;
pub mod data;
pub mod idle;
pub mod types;

// Re-export commonly used types and functions
pub use data::{init_database, with_db, AppResult};
pub use types::{
    ExportData, ExportOptions, IdlePeriod, IdlePeriodResolution, ScreenshotInfo, SearchResult,
    TimeEntry, TimeEntryInput, TimeEntryUpdate, WindowActivity,
};
