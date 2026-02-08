-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL
);

-- Add category_id to time_entries
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS directly.
-- We use a workaround or just try it and ignore error (not ideal but common in simple setups)
-- Better: use PRAGMA to check.
-- For this simple project, we will just add it.
ALTER TABLE time_entries ADD COLUMN category_id INTEGER REFERENCES categories(id);
