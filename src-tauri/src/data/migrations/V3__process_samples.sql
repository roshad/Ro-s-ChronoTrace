CREATE TABLE IF NOT EXISTS process_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    day_id INTEGER NOT NULL,
    UNIQUE(timestamp)
);

CREATE INDEX IF NOT EXISTS idx_process_samples_timestamp ON process_samples(timestamp);
CREATE INDEX IF NOT EXISTS idx_process_samples_day_id ON process_samples(day_id);
CREATE INDEX IF NOT EXISTS idx_process_samples_process_name ON process_samples(process_name);
