# Research: Digital Diary

**Date**: 2026-01-17
**Purpose**: Resolve technical decisions for Digital Diary implementation

## 1. Tauri 2.x + React 18.x Best Practices

### Decision: Use Tauri 2.x + React 18 with modular architecture

**Rationale**:
- Tauri 2.x provides native performance with React frontend and Rust backend
- `dannysmith/tauri-template` demonstrates production-ready patterns with Zustand + Tanstack Query
- React 18+ functional components + Hooks align with modern best practices
- TypeScript ensures type safety across frontend/backend boundary

**Implementation Approach**:
- Use `src-tauri/` for Rust backend organized by feature modules (capture, data, idle, export)
- Use `src/` for React frontend with component-based structure
- State management: Zustand for UI state, Tauri commands for business data
- Type sharing: Use `tauri-specta` or manual type definitions (Rust structs → TypeScript interfaces)
- Performance: Lazy loading components, avoid unnecessary re-renders with React.memo/useCallback

**Alternatives Considered**:
- Electron: Rejected due to memory bloat (>100MB budget violation)
- Tauri 1.x: Rejected, Tauri 2.x is latest with better performance and APIs
- Pure Rust UI: Rejected, React + SVG provides faster UI development for timeline visualization

---

## 2. Windows Screenshot & Window Metadata Capture

### Decision: Use `windows-capture` crate for screenshots + `windows-rs` for window metadata

**Rationale**:
- `windows-capture` (v1.5.0) uses DXGI Graphics Capture API, fastest Windows screenshot library
- Optimized for performance (only updates when required, high performance)
- `windows-rs` provides access to Windows API for window title and process name detection
- Both crates well-maintained and compatible with Tauri 2.x

**Implementation Approach**:
- Screenshot capture (every 5 min):
  - Use `windows-capture::capture::Context` with GraphicsCaptureApiHandler
  - Capture primary monitor only (MVP constraint)
  - Run in background thread using `tokio::spawn` to avoid blocking UI
  - Save directly to file system in Year/Month/Day hierarchy
  - Target performance: <100ms per capture

- Window metadata capture (every 1 min):
  - Use `windows-rs` GetWindowText() and GetWindowThreadProcessId()
  - Run in async background task
  - Store in SQLite database

- Non-blocking design:
  - Use tokio for async/await patterns
  - Capture tasks communicate with UI via Tauri events
  - Implement disk space check before capture (skip if full, log warning)

**Alternatives Considered**:
- `scap` crate: Cross-platform but `windows-capture` is Windows-optimized and faster
- `screenshots-rs`: Less mature, fewer features
- Direct Windows API calls via FFI: Too complex, `windows-rs` provides safe Rust bindings

---

## 3. SQLite + Filesystem Hybrid Storage

### Decision: SQLite for metadata, Year/Month/Day filesystem hierarchy for screenshots

**Rationale**:
- Matches Constitution Principle IV (Hybrid Storage Strategy)
- SQLite provides efficient querying and indexing for time-series data
- Filesystem storage prevents database bloat, enables direct screenshot browsing
- JSON export format ensures data portability

**Implementation Approach**:

**Filesystem Structure**:
```
%LocalAppData%/DigitalDiary/
├── database.db (SQLite)
└── screenshots/
    ├── 2026/
    │   ├── 01/
    │   │   ├── 17/
    │   │   │   ├── screenshot_20260117_095500.png
    │   │   │   └── ...
    │   │   └── ...
    │   └── ...
    └── ...
```

**SQLite Schema**:
```sql
-- Time entries (user-created)
CREATE TABLE time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,  -- Unix timestamp (milliseconds)
    end_time INTEGER NOT NULL,
    label TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_end_time ON time_entries(end_time);

-- Screenshot references
CREATE TABLE screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    file_path TEXT NOT NULL,  -- Relative path from data root
    day_id INTEGER NOT NULL  -- YYYYMMDD integer for grouping
);

CREATE INDEX idx_screenshots_timestamp ON screenshots(timestamp);
CREATE INDEX idx_screenshots_day_id ON screenshots(day_id);

-- Window activity
CREATE TABLE window_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    window_title TEXT NOT NULL,
    process_name TEXT NOT NULL
);

CREATE INDEX idx_window_activity_timestamp ON window_activity(timestamp);
CREATE INDEX idx_window_activity_title ON window_activity(window_title);

-- Idle periods
CREATE TABLE idle_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    resolution TEXT NOT NULL  -- 'discarded', 'merged', 'labeled'
);

CREATE INDEX idx_idle_periods_start_time ON idle_periods(start_time);
```

**Performance Optimization**:
- INTEGER timestamps for fast range queries
- Indexes on all timestamp fields for <1s search across 1 year
- Transaction batching for multiple inserts
- Relative file paths (database portable across machines)

**JSON Export Format**:
```json
{
  "version": "1.0",
  "exported_at": "2026-01-17T10:30:00Z",
  "time_entries": [...],
  "screenshots": [{"timestamp": 1705490500000, "file_path": "screenshots/2026/01/17/...", ...}],
  "window_activity": [...],
  "idle_periods": [...]
}
```

**Alternatives Considered**:
- Store screenshots as BLOB in SQLite: Rejected (Constitution violation, database bloat)
- Separate databases for each entity: Rejected (increases complexity, single file is more portable)
- Absolute file paths: Rejected (breaks portability, database not machine-independent)

---

## 4. React SVG Timeline Visualization

### Decision: Custom SVG-based horizontal timeline component

**Rationale**:
- SVG provides vector-based, scalable graphics (Constitution Principle VI)
- Custom implementation allows exact alignment with 24-hour horizontal timeline requirement
- `react-svg-timeline` exists but is over-engineered for simple day view
- Direct control over hover previews (<200ms) and drag-to-select interactions

**Implementation Approach**:

**Component Structure**:
```tsx
// Timeline component
<Timeline
  date={selectedDate}  // Date object
  timeEntries={timeEntries}  // Array of {id, startTime, endTime, label}
  onHover={handleHover}  // Show screenshot preview
  onDragSelect={handleDragSelect}  // Select time range
  onNavigate={handleNavigate}  // Change day
/>

// Render SVG with:
// - Horizontal axis (24 hours)
// - Time blocks (colored rectangles) for recorded entries
// - Gray gaps for unrecorded time
// - Hover overlay for screenshot preview
```

**Rendering Logic**:
- 24-hour timeline: 1440 minutes represented as SVG width
- Time block position: `(startTime / 1440) * width`
- Time block width: `((endTime - startTime) / 1440) * width`
- Hover detection: Mouse position → time → lookup screenshot → show preview
- Drag selection: Mouse down → track range → show highlight → mouse up → create entry

**Performance Optimization**:
- Use React.memo to prevent unnecessary re-renders
- Debounce hover events (prevent excessive preview updates)
- Lazy screenshot preview loading (only load when hovering)
- CSS transforms for smooth animations
- Virtualization if time block count becomes large (not needed for daily view)

**Alternatives Considered**:
- `react-svg-timeline` library: Rejected, designed for event scheduling not daily time tracking
- Canvas-based rendering: Rejected, SVG is simpler for 24-hour horizontal view and easier to style
- HTML divs with flexbox: Rejected, less precise control over time-based positioning

---

## 5. State Management & Data Flow

### Decision: Tauri commands for backend, React state for UI, Tanstack Query for caching

**Rationale**:
- Separates business logic (Rust) from UI state (React)
- Tanstack Query provides caching and deduplication for Tauri command calls
- Zustand for simple UI state (selected date, drag selection state)

**Implementation Approach**:

**Rust Backend (Tauri Commands)**:
```rust
#[tauri::command]
async fn get_time_entries(date: i32) -> Result<Vec<TimeEntry>, String> {
    // Query SQLite for entries on date
}

#[tauri::command]
async fn create_time_entry(entry: TimeEntryInput) -> Result<TimeEntry, String> {
    // Insert into SQLite
}

#[tauri::command]
async fn search_activities(query: String) -> Result<Vec<SearchResult>, String> {
    // Full-text search across time_entries and window_activity
}

#[tauri::command]
async fn export_data() -> Result<ExportData, String> {
    // Serialize to JSON
}

#[tauri::command]
async fn get_screenshot_for_time(timestamp: i64) -> Result<String, String> {
    // Return file path or placeholder
}
```

**React Frontend**:
```tsx
// Use Tanstack Query for data fetching
const { data: timeEntries } = useQuery({
  queryKey: ['timeEntries', date],
  queryFn: () => invoke('get_time_entries', { date })
})

// Use Zustand for UI state
const useTimelineStore = create((set) => ({
  selectedDate: new Date(),
  dragSelection: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDragSelection: (selection) => set({ dragSelection: selection })
}))
```

**Alternatives Considered**:
- React Context for all state: Rejected, becomes unmanageable, no caching
- Redux: Rejected, over-engineered for this app
- Direct Rust state via IPC only: Rejected, UI needs local state for interactions

---

## Summary

All technical decisions aligned with:
- **Constitution compliance**: Performance First, Local-First, Hybrid Storage, Privacy by Design
- **Performance budgets**: <100MB memory, <200ms hover preview, <1s search
- **Technology constraints**: Tauri 2.x, React 18, Rust, SQLite

**Next Steps**: Proceed to Phase 1 design (data-model.md, contracts, quickstart.md).
