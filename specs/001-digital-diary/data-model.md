# Data Model: Digital Diary

**Date**: 2026-01-17
**Based on**: spec.md and research.md

## Overview

Digital Diary uses a hybrid storage strategy:
- **SQLite**: Metadata, indexes, and relational data (time entries, window activity, idle periods, screenshot references)
- **Filesystem**: Binary assets (PNG/JPEG screenshots) in Year/Month/Day hierarchy

## Entities

### 1. TimeEntry

Represents a user-created time block on the timeline.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER (PK) | Auto-increment | Unique identifier |
| start_time | INTEGER | NOT NULL | Unix timestamp (milliseconds) - start of time block |
| end_time | INTEGER | NOT NULL | Unix timestamp (milliseconds) - end of time block |
| label | TEXT | NOT NULL, max 500 chars | User-provided description |
| color | TEXT | Optional, hex color (e.g., "#FF5733") | Optional color for visual categorization |

**Validation Rules**:
- `end_time` must be > `start_time`
- `start_time` and `end_time` must fall on same calendar day (unless crossing midnight, split into two entries)
- Overlapping entries not allowed (same day, same user)

**Relationships**:
- None (standalone entity, no foreign keys)

---

### 2. Screenshot

Represents a captured screen image with filesystem reference.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER (PK) | Auto-increment | Unique identifier |
| timestamp | INTEGER | NOT NULL | Unix timestamp (milliseconds) - when screenshot was captured |
| file_path | TEXT | NOT NULL | Relative path from data root (e.g., "screenshots/2026/01/17/screenshot_20260117_095500.png") |
| day_id | INTEGER | NOT NULL | Integer format YYYYMMDD for grouping (e.g., 20260117) |

**Validation Rules**:
- `file_path` must exist in filesystem
- `file_path` must point to valid image file (PNG/JPEG)
- `timestamp` must be unique (no duplicate screenshots at same millisecond)

**Relationships**:
- None (standalone reference entity)

---

### 3. WindowActivity

Represents recorded active window metadata.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER (PK) | Auto-increment | Unique identifier |
| timestamp | INTEGER | NOT NULL | Unix timestamp (milliseconds) - when window was active |
| window_title | TEXT | NOT NULL, max 500 chars | Title of active window |
| process_name | TEXT | NOT NULL, max 255 chars | Name of process (e.g., "chrome.exe", "code.exe") |

**Validation Rules**:
- `window_title` and `process_name` can be empty string (some windows may not have titles)
- Multiple records with same timestamp allowed (rapid window switching)

**Relationships**:
- None (standalone telemetry entity)

---

### 4. IdlePeriod

Represents detected idle time with resolution status.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER (PK) | Auto-increment | Unique identifier |
| start_time | INTEGER | NOT NULL | Unix timestamp (milliseconds) - when idle began |
| end_time | INTEGER | NOT NULL | Unix timestamp (milliseconds) - when user returned |
| resolution | TEXT | NOT NULL | One of: 'discarded', 'merged', 'labeled' |

**Validation Rules**:
- `end_time` must be > `start_time`
- `resolution` enum must match one of three allowed values
- Overlaps with TimeEntry allowed (idle periods tracked separately)

**Relationships**:
- `merged` resolution: May reference TimeEntry.id (not enforced by FK, logical relationship)

---

### 5. Day (Virtual Entity)

Logical grouping of all data for a calendar date. Not stored as a separate table.

| Conceptual Fields | Source |
|-----------------|--------|
| date | Calendar date (YYYY-MM-DD) |
| time_entries | Filtered from time_entries WHERE date matches |
| screenshots | Filtered from screenshots WHERE day_id = YYYYMMDD |
| window_activities | Filtered from window_activity WHERE date matches |
| idle_periods | Filtered from idle_periods WHERE date matches |

**Query Pattern**:
```sql
-- Get all data for a day
SELECT * FROM time_entries WHERE start_time >= ? AND start_time < ?;
SELECT * FROM screenshots WHERE day_id = ?;
SELECT * FROM window_activity WHERE timestamp >= ? AND timestamp < ?;
SELECT * FROM idle_periods WHERE start_time >= ? AND start_time < ?;
```

## Indexes

### Performance Indexes

| Table | Index | Columns | Purpose |
|-------|--------|---------|---------|
| time_entries | idx_time_entries_start_time | start_time | Timeline query (get entries for day) |
| time_entries | idx_time_entries_end_time | end_time | Gap detection (find unrecorded time) |
| screenshots | idx_screenshots_timestamp | timestamp | Hover preview lookup (find screenshot at time) |
| screenshots | idx_screenshots_day_id | day_id | Day view (list screenshots for day) |
| window_activity | idx_window_activity_timestamp | timestamp | Activity query (get window at time) |
| window_activity | idx_window_activity_title | window_title | Search (full-text on window titles) |
| idle_periods | idx_idle_periods_start_time | start_time | Idle detection query |

**Performance Targets**:
- Timeline query (1 day): <10ms (Constitution target)
- Hover preview lookup: <10ms (enables <200ms total with UI rendering)
- Search across 1 year: <1000ms (SC-005 target)

## State Transitions

### TimeEntry Lifecycle

```
[None] → [Created] → [Modified] → [Deleted]
   ↑            ↑            ↑           ↑
   |            |            |           |
   |            |            |           |
   |            |            |           |
   |            |            |           |
[Created]: User creates entry via drag-to-select
[Modified]: User edits label or adjusts time range
[Deleted]: User removes entry (gap reappears)
```

### IdlePeriod Resolution Flow

```
[Idle Detected] → [User Returned] → [User Chooses Resolution]
                          ↓                      ↓
                          ↓                      ├── [Discarded] → Keep as gap
                          ↓                      ├── [Merged] → Merge with previous TimeEntry
                          ↓                      └── [Labeled] → Create new TimeEntry
```

## Data Integrity Rules

1. **No orphaned screenshots**: All Screenshot.file_path entries must reference existing files
2. **No time travel**: All timestamps must be <= current time (no future data)
3. **Midnight crossing**: TimeEntry crossing midnight must be split into two records
4. **Concurrent edits**: Last write wins (no optimistic locking for local-only app)
5. **Filesystem sync**: If file deleted, Screenshot record should be soft-deleted or marked invalid

## Migration Strategy

**Initial Schema** (Version 1):
- All tables created as defined above
- Indexes created immediately
- No migration path (fresh install)

**Future Migrations**:
- Versioned schema in `src-tauri/src/data/migrations/`
- Each migration file: `V{version}__{description}.sql`
- Run migrations on app startup if version mismatch

## Performance Considerations

1. **Batch inserts**: Window activity captured every 1 minute → batch insert every 5 minutes
2. **Pruning old data**: Not required (constitution: 50+ year data portability)
3. **Vacuum**: Periodic SQLite VACUUM to reclaim space after deletions
4. **Query optimization**: Use prepared statements, parameterized queries

## Backup & Export

**SQLite Backup**:
- Simple: Copy `database.db` file
- Portable: Single file, no complex dependencies

**JSON Export**:
- Serialize all tables to JSON structure
- Include all Screenshot.file_path references (not file contents)
- Versioned schema for forward compatibility
- Export all data or date-range filtered

**Import** (future enhancement, not MVP):
- Validate JSON schema version
- Insert records preserving IDs if possible
- Update file paths if data directory changed
