-- Time entries (user-created)
CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    label TEXT NOT NULL,
    color TEXT
);

-- Indexes for time entries
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_end_time ON time_entries(end_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_label ON time_entries(label);

-- Screenshot references
CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    day_id INTEGER NOT NULL
);

-- Indexes for screenshots
CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_screenshots_day_id ON screenshots(day_id);

-- Window activity
CREATE TABLE IF NOT EXISTS window_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    window_title TEXT NOT NULL,
    process_name TEXT NOT NULL
);

-- Indexes for window activity
CREATE INDEX IF NOT EXISTS idx_window_activity_timestamp ON window_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_window_activity_title ON window_activity(window_title);

-- Idle periods
CREATE TABLE IF NOT EXISTS idle_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    resolution TEXT
);

-- Index for idle periods
CREATE INDEX IF NOT EXISTS idx_idle_periods_start_time ON idle_periods(start_time);
