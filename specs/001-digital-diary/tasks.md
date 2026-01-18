# Tasks: Digital Diary Implementation

**Date**: 2026-01-17
**Branch**: `001-digital-diary`
**Status**: Ready to start

## Overview

This document breaks down the Digital Diary implementation into concrete, executable tasks. Tasks are organized by priority (P1 = highest) and dependency order.

## Task Legend

| Priority | Meaning |
|----------|---------|
| P1 | Critical path - blocks other work or core functionality |
| P2 | Important feature - needed for MVP completeness |
| P3 | Enhancement - nice to have but can defer |

| Tag | Meaning |
|-----|---------|
| [Rust] | Rust/Tauri backend task |
| [React] | React frontend task |
| [Test] | Testing task |
| [Config] | Configuration/setup task |
| [Perf] | Performance verification task |

---

## Phase 0: Project Setup

### Task 0.1: Initialize Tauri Project Structure

**Priority**: P1 | **Tags**: [Config]

**Description**: Initialize Tauri 2.x project with React 18 frontend and Rust backend.

**Acceptance Criteria**:
- [X] `package.json` exists with React 18+ dependencies
- [X] `src-tauri/Cargo.toml` exists with Tauri 2.0+ dependency
- [X] Project builds successfully with `npm run tauri build`
- [X] Dev server starts with `npm run tauri dev`

**Steps**:
1. From repository root, initialize Tauri project:
   ```powershell
   npm install
   npx create-tauri-app@latest
   ```
2. Configure `src-tauri/Cargo.toml` with dependencies from quickstart.md
3. Configure `package.json` with React, Zustand, Tanstack Query
4. Verify build: `npm run tauri build`

**Dependencies**: None
**Estimated Time**: 30 minutes

---

### Task 0.2: Set Up TypeScript Type Sharing

**Priority**: P1 | **Tags**: [Config] [Rust]

**Description**: Configure specta for automatic TypeScript type generation from Rust structs.

**Acceptance Criteria**:
- [X] `specta` and `specta-typescript` in `Cargo.toml`
- [X] `src-tauri/src/types.rs` exists with specta configuration
- [X] `src/services/types.ts` auto-generated from Rust
- [X] Build completes without type errors

**Steps**:
1. Add specta dependencies:
   ```powershell
   cd src-tauri
   cargo add specta specta-typescript
   ```
2. Create `src-tauri/src/types.rs`:
   ```rust
   specta::specta!();
   specta::export_ts!("./src/services/types.ts", flatten);
   ```
3. Generate types: `cargo run -p specta`
4. Verify types are importable in React

**Dependencies**: Task 0.1
**Estimated Time**: 20 minutes

---

## Phase 1: Backend Foundation

### Task 1.1: Create SQLite Database Schema

**Priority**: P1 | **Tags**: [Rust] [Config]

**Description**: Initialize SQLite database with schema defined in data-model.md.

**Acceptance Criteria**:
- [X] Database created at `%LocalAppData%/DigitalDiary/database.db`
- [X] All tables created: `time_entries`, `screenshots`, `window_activity`, `idle_periods`
- [X] All indexes created as specified in data-model.md
- [X] Database migrations system in place (even if only version 1)

**Steps**:
1. Add rusqlite dependency:
   ```powershell
   cd src-tauri
   cargo add rusqlite --features "bundled"
   ```
2. Create `src-tauri/src/data/migrations/` directory
3. Create migration file `V1__initial_schema.sql` with schema from data-model.md
4. Create `src-tauri/src/data/database.rs`:
   - `init_database()` function
   - Migration runner
   - Connection pooling
5. Call `init_database()` in `main.rs` on app startup

**Dependencies**: Task 0.1
**Estimated Time**: 1 hour

---

### Task 1.2: Implement Time Entry CRUD Commands

**Priority**: P1 | **Tags**: [Rust]

**Description**: Implement Tauri commands for time entry CRUD operations.

**Acceptance Criteria**:
- [X] `get_time_entries(date)` command returns entries for given day
- [X] `create_time_entry(entry)` command creates entry and returns with ID
- [X] `update_time_entry(id, updates)` command updates label/color
- [X] `delete_time_entry(id)` command deletes entry
- [X] All commands include input validation (end_time > start_time)
- [ ] Rust tests pass for all commands

**Steps**:
1. Create `src-tauri/src/data/time_entries.rs` module
2. Define `TimeEntry`, `TimeEntryInput`, `TimeEntryUpdate` structs with specta derive
3. Implement CRUD functions using rusqlite
4. Create Tauri command handlers:
   ```rust
   #[tauri::command]
   pub async fn get_time_entries(date: i32) -> Result<Vec<TimeEntry>, String>
   #[tauri::command]
   pub async fn create_time_entry(entry: TimeEntryInput) -> Result<TimeEntry, String>
   // ... etc
   ```
5. Register commands in `main.rs`
6. Write unit tests: `src-tauri/src/data/time_entries_tests.rs`

**Dependencies**: Task 1.1, Task 0.2
**Estimated Time**: 2 hours

---

### Task 1.3: Implement Screenshot Capture Module

**Priority**: P2 | **Tags**: [Rust] [Perf]

**Description**: Implement background screenshot capture every 5 minutes using windows-capture crate.

**Acceptance Criteria**:
- [X] Screenshot captured every 5 minutes while app is running
- [X] Screenshot saved to `screenshots/YYYY/MM/DD/screenshot_YYYYMMDD_HHMMSS.png`
- [X] Capture performance <100ms per screenshot (measure with logging)
- [X] Capture runs in background thread (does not block UI)
- [X] Disk space check before capture (skip if full, log warning)
- [X] Rust tests pass for capture logic

**Steps**:
1. Add dependencies:
   ```powershell
   cd src-tauri
   cargo add windows-capture
   cargo add tokio --features "full"
   ```
2. Create `src-tauri/src/capture/screenshot.rs`
3. Implement `capture_screenshot()` function:
   - Use `windows-capture::capture::Context`
   - Target primary monitor only
   - Save to filesystem with Year/Month/Day hierarchy
4. Create tokio task for periodic capture:
   ```rust
   tokio::spawn(async move {
       loop {
           capture_screenshot().await;
           tokio::time::sleep(Duration::from_secs(300)).await; // 5 min
       }
   });
   ```
5. Add disk space check before capture
6. Implement unit tests (mock file operations)

**Dependencies**: Task 0.1, Task 1.1 (database for screenshot records)
**Estimated Time**: 3 hours

---

### Task 1.4: Implement Window Metadata Capture Module

**Priority**: P2 | **Tags**: [Rust]

**Description**: Implement background window title and process name capture every 1 minute using windows-rs.

**Acceptance Criteria**:
- [X] Window metadata captured every 1 minute
- [X] Window title and process name stored in `window_activity` table
- [X] Capture runs in background thread (does not block UI)
- [X] Batching: Insert records every 5 minutes (not every 1 min)
- [X] Rust tests pass for capture logic

**Steps**:
1. Add dependency:
   ```powershell
   cd src-tauri
   cargo add windows-rs --features "Win32_UI_WindowsAndMessaging"
   ```
2. Create `src-tauri/src/capture/window.rs`
3. Implement `get_active_window()` function:
   - Use `windows-rs` GetWindowText() and GetWindowThreadProcessId()
4. Implement batch insert function
5. Create tokio task for periodic capture:
   ```rust
   let mut buffer = Vec::new();
   tokio::spawn(async move {
       loop {
           buffer.push(get_active_window().await);
           if buffer.len() >= 5 {
               insert_window_activities(buffer).await;
               buffer.clear();
           }
           tokio::time::sleep(Duration::from_secs(60)).await; // 1 min
       }
   });
   ```
6. Write unit tests (mock Windows API)

**Dependencies**: Task 1.1
**Estimated Time**: 2 hours

---

### Task 1.5: Implement Idle Detection Module

**Priority**: P2 | **Tags**: [Rust]

**Description**: Implement mouse/keyboard inactivity detection (5-minute threshold) and idle period tracking.

**Acceptance Criteria**:
- [X] Idle period detected after 5 minutes of inactivity
- [X] Idle period recorded in `idle_periods` table
- [X] Idle detection triggers Tauri event when user returns
- [X] `resolve_idle_period()` command implemented
- [X] Resolution options: 'discarded', 'merged', 'labeled'
- [X] Rust tests pass for detection logic

**Steps**:
1. Add dependency:
   ```powershell
   cd src-tauri
   cargo add rdev --features "serialize"
   ```
2. Create `src-tauri/src/idle/detection.rs`
3. Implement idle detection loop:
   ```rust
   let mut idle_start: Option<i64> = None;
   tokio::spawn(async move {
       loop {
           if !is_active() {
               if idle_start.is_none() {
                   idle_start = Some(now());
               }
           } else {
               if let Some(start) = idle_start {
                   if now() - start > 5 * 60 * 1000 { // 5 min
                       record_idle_period(start, now()).await;
                   }
                   idle_start = None;
               }
           }
           tokio::time::sleep(Duration::from_secs(1)).await;
       }
   });
   ```
4. Implement `resolve_idle_period()` command
5. Emit Tauri event when user returns from idle
6. Write unit tests

**Dependencies**: Task 1.1
**Estimated Time**: 2 hours

---

### Task 1.6: Implement Export Functionality

**Priority**: P3 | **Tags**: [Rust]

**Description**: Implement JSON export of all data (time entries, screenshots, window activity, idle periods).

**Acceptance Criteria**:
- [X] `export_data()` command returns valid JSON
- [X] JSON schema matches `contracts/api.yaml` ExportData schema
- [X] All entities exported with correct structure
- [X] Screenshot file paths are relative (not absolute)
- [X] Rust tests pass for export logic

**Steps**:
1. Add dependency:
   ```powershell
   cd src-tauri
   cargo add serde_json
   ```
2. Create `src-tauri/src/export/json.rs`
3. Implement `export_data()` function:
   - Query all tables
   - Serialize to JSON structure
   - Include version and exported_at timestamp
4. Create Tauri command:
   ```rust
   #[tauri::command]
   pub async fn export_data() -> Result<ExportData, String>
   ```
5. Write unit tests

**Dependencies**: Task 1.1
**Estimated Time**: 1.5 hours

---

### Task 1.7: Implement Search Functionality

**Priority**: P3 | **Tags**: [Rust]

**Description**: Implement full-text search across time entry labels and window titles.

**Acceptance Criteria**:
- [X] `search_activities(query)` command returns matching results
- [X] Search searches both `time_entries.label` and `window_activity.window_title`
- [X] Results include type, timestamp, title, process_name
- [X] Search performance <1000ms for 1 year of data
- [X] Rust tests pass for search logic

**Steps**:
1. Create `src-tauri/src/data/search.rs`
2. Implement search query:
   ```sql
   SELECT 'time_entry' as type, start_time as timestamp, label as title, NULL as process_name
   FROM time_entries WHERE label LIKE ?
   UNION ALL
   SELECT 'window_activity' as type, timestamp, window_title as title, process_name
   FROM window_activity WHERE window_title LIKE ?
   ORDER BY timestamp DESC LIMIT 100
   ```
3. Create Tauri command:
   ```rust
   #[tauri::command]
   pub async fn search_activities(query: String) -> Result<Vec<SearchResult>, String>
   ```
4. Write unit tests with performance benchmarks

**Dependencies**: Task 1.1, Task 1.4
**Estimated Time**: 2 hours

---

## Phase 2: Frontend Foundation

### Task 2.1: Create React Project Structure

**Priority**: P1 | **Tags**: [React] [Config]

**Description**: Set up React component structure and routing.

**Acceptance Criteria**:
- [X] Component directories created: `components/timeline/`, `components/capture/`, `components/idle/`, `components/search/`, `components/export/`
- [X] Pages created: `TimelineView.tsx`, `SettingsView.tsx`
- [X] Services created: `services/api.ts`, `services/types.ts`
- [X] Main app structure: `App.tsx`, `main.tsx`
- [X] Build completes without errors

**Steps**:
1. Create directory structure:
   ```powershell
   New-Item -ItemType Directory -Path "src/components/timeline"
   New-Item -ItemType Directory -Path "src/components/capture"
   New-Item -ItemType Directory -Path "src/components/idle"
   New-Item -ItemType Directory -Path "src/components/search"
   New-Item -ItemType Directory -Path "src/components/export"
   New-Item -ItemType Directory -Path "src/pages"
   New-Item -ItemType Directory -Path "src/services"
   ```
2. Create `main.tsx` with React root
3. Create `App.tsx` with routing or conditional rendering
4. Create page components (stub implementations)

**Dependencies**: Task 0.1
**Estimated Time**: 30 minutes

---

### Task 2.2: Set Up State Management

**Priority**: P1 | **Tags**: [React]

**Description**: Configure Zustand for UI state and Tanstack Query for data fetching.

**Acceptance Criteria**:
- [X] Zustand store created with selectedDate and dragSelection state
- [X] Tanstack Query configured with Tauri command wrappers
- [X] API service created with all Tauri command functions
- [X] TypeScript types imported from Rust (Task 0.2)
- [X] Build completes without type errors

**Steps**:
1. Install dependencies:
   ```powershell
   npm install zustand @tanstack/react-query
   ```
2. Create `src/services/store.ts`:
   ```typescript
   export const useTimelineStore = create((set) => ({
     selectedDate: new Date(),
     dragSelection: null as {start: number; end: number} | null,
     setSelectedDate: (date) => set({ selectedDate: date }),
     setDragSelection: (selection) => set({ dragSelection: selection })
   }))
   ```
3. Create `src/services/api.ts` with invoke wrappers for all commands
4. Configure Tanstack Query provider in `main.tsx`
5. Import auto-generated types in `services/types.ts`

**Dependencies**: Task 0.2, Task 2.1
**Estimated Time**: 1 hour

---

### Task 2.3: Implement Timeline Visualization Component

**Priority**: P1 | **Tags**: [React] [Perf]

**Description**: Create SVG-based horizontal timeline showing 24-hour day view with time blocks and gaps.

**Acceptance Criteria**:
- [X] Timeline shows 24-hour horizontal axis
- [X] Time entries render as colored blocks at correct positions
- [X] Unrecorded gaps render as gray
- [X] Component wrapped with React.memo
- [X] Render time for timeline load with 1 day of data <50ms

**Steps**:
1. Create `components/timeline/Timeline.tsx`
2. Implement rendering logic:
   ```typescript
   const position = (startTime / 86400000) * width; // 24 hours in ms
   const blockWidth = ((endTime - startTime) / 86400000) * width;
   ```
3. Use SVG for timeline rendering
4. Implement color palette for time entries
5. Optimize with React.memo
6. Add performance logging

**Dependencies**: Task 2.2
**Estimated Time**: 3 hours

---

### Task 2.4: Implement Gap Creation (Drag-to-Select)

**Priority**: P1 | **Tags**: [React]

**Description**: Implement drag-to-select interaction for creating time entries on timeline.

**Acceptance Criteria**:
- [X] Mouse down on gap starts selection
- [X] Drag shows visual highlight of selected range
- [X] Mouse up shows entry creation dialog
- [X] Entry creation dialog shows start time, end time, duration
- [X] Submitting dialog creates time entry via API
- [X] Gap disappears after entry creation

**Steps**:
1. Extend `Timeline.tsx` with drag handlers
2. Create `components/timeline/EntryDialog.tsx` for entry creation
3. Update Zustand store with drag selection state
4. Call `create_time_entry()` API on submit
5. Refresh timeline after creation

**Dependencies**: Task 2.3, Task 1.2
**Estimated Time**: 2.5 hours

---

### Task 2.5: Implement Screenshot Hover Preview

**Priority**: P1 | **Tags**: [React] [Perf]

**Description**: Show screenshot preview thumbnail when hovering over timeline.

**Acceptance Criteria**:
- [X] Mouse move on timeline triggers hover check
- [X] Screenshot preview appears within 200ms of hover
- [X] Preview shows screenshot thumbnail (from file path)
- [X] "No screenshot available" placeholder if no screenshot
- [X] Preview debounced (not updated on every pixel move)
- [X] Hover preview load time <150ms

**Steps**:
1. Extend `Timeline.tsx` with hover handler
2. Call `get_screenshot_for_time(timestamp)` API on hover
3. Create `components/timeline/ScreenshotPreview.tsx` component
4. Implement debouncing (50-100ms)
5. Lazy load screenshot image
6. Add performance logging

**Dependencies**: Task 2.3, Task 1.3 (screenshot lookup)
**Estimated Time**: 2 hours

---

### Task 2.6: Implement Timeline Navigation

**Priority**: P2 | **Tags**: [React]

**Description**: Add previous/next day navigation buttons to timeline view.

**Acceptance Criteria**:
- [X] "Previous Day" button navigates to previous day
- [X] "Next Day" button navigates to next day
- [X] Today button returns to current day
- [X] Selected date updates in Zustand store
- [X] Timeline refreshes with data for new date

**Steps**:
1. Create `components/timeline/Navigation.tsx`
2. Add navigation buttons to `TimelineView.tsx`
3. Update `setSelectedDate()` in store
4. Trigger Tanstack Query refetch on date change

**Dependencies**: Task 2.2
**Estimated Time**: 1 hour

---

### Task 2.7: Implement Capture Status Indicator

**Priority**: P2 | **Tags**: [React]

**Description**: Show background capture status (active/inactive) with last capture time.

**Acceptance Criteria**:
- [X] Status indicator shows "Active" or "Inactive"
- [X] Last screenshot capture time displayed
- [X] Tauri event listener for capture status updates
- [X] Status persists across page navigation

**Steps**:
1. Create `components/capture/StatusIndicator.tsx`
2. Use Tauri event listener for status updates
3. Store status in Zustand or React state
4. Format timestamp for display

**Dependencies**: Task 2.2
**Estimated Time**: 1 hour

---

### Task 2.8: Implement Idle Prompt Dialog

**Priority**: P2 | **Tags**: [React]

**Description**: Create dialog for resolving idle periods when user returns.

**Acceptance Criteria**:
- [X] Idle prompt dialog appears on Tauri idle event
- [X] Three options displayed: "Discard time", "Add to previous task", "Create new task"
- [X] "Add to previous" merges idle time with latest time entry
- [X] "Create new task" shows entry creation dialog with idle range
- [X] "Discard" keeps idle period as gap

**Steps**:
1. Create `components/idle/IdlePrompt.tsx`
2. Listen to Tauri event `idle-detected`
3. Show dialog with three resolution options
4. Call `resolve_idle_period()` API on selection
5. Refresh timeline after resolution

**Dependencies**: Task 2.4, Task 1.5
**Estimated Time**: 2 hours

---

### Task 2.9: Implement Search Bar and Results

**Priority**: P3 | **Tags**: [React]

**Description**: Create search interface for finding activities by keyword.

**Acceptance Criteria**:
- [X] Search bar accepts keyword input (min 2 chars)
- [X] Search results displayed as list below bar
- [X] Clicking result navigates timeline to that date/time
- [X] Results show type, title, process_name
- [X] Search debounced (wait 300ms after typing)

**Steps**:
1. Create `components/search/SearchBar.tsx`
2. Create `components/search/SearchResults.tsx`
3. Use Tanstack Query for search API call
4. Implement result click handler (update selectedDate)
5. Add debouncing with Tanstack Query

**Dependencies**: Task 2.2, Task 1.7
**Estimated Time**: 2 hours

---

### Task 2.10: Implement Export UI

**Priority**: P3 | **Tags**: [React]

**Description**: Add export button and JSON download functionality.

**Acceptance Criteria**:
- [X] Export button in settings or toolbar
- [X] Clicking export calls `export_data()` API
- [X] JSON file download triggered with all data
- [X] Export progress indicator (if large dataset)

**Steps**:
1. Create `components/export/ExportButton.tsx`
2. Call `export_data()` API
3. Create Blob from JSON response
4. Trigger file download in browser

**Dependencies**: Task 2.2, Task 1.6
**Estimated Time**: 1 hour

---

## Phase 3: Testing

### Task 3.1: Write Rust Unit Tests

**Priority**: P2 | **Tags**: [Test] [Rust]

**Description**: Add comprehensive unit tests for all Rust modules.

**Acceptance Criteria**:
- [ ] Time entry CRUD tests pass
- [ ] Screenshot capture tests pass (mocked file operations)
- [ ] Window capture tests pass (mocked Windows API)
- [ ] Idle detection tests pass
- [ ] Export tests pass
- [ ] Search tests pass
- [ ] Code coverage >80%

**Steps**:
1. Create test modules in `src-tauri/src/`:
   - `data/time_entries_tests.rs`
   - `capture/screenshot_tests.rs`
   - `capture/window_tests.rs`
   - `idle/detection_tests.rs`
   - `export/json_tests.rs`
   - `data/search_tests.rs`
2. Write tests for all functions
3. Use mocking for external dependencies (Windows API, filesystem)
4. Run: `cargo test`

**Dependencies**: All Phase 1 tasks
**Estimated Time**: 4 hours

---

### Task 3.2: Write React Component Tests

**Priority**: P3 | **Tags**: [Test] [React]

**Description**: Add component tests for key React components.

**Acceptance Criteria**:
- [ ] Timeline component tests pass
- [ ] Entry dialog tests pass
- [ ] Search bar tests pass
- [ ] Idle prompt tests pass
- [ ] Tests use Testing Library

**Steps**:
1. Install testing dependencies:
   ```powershell
   npm install -D @testing-library/react @testing-library/jest-dom
   ```
2. Create test files:
   - `components/timeline/Timeline.test.tsx`
   - `components/timeline/EntryDialog.test.tsx`
   - `components/search/SearchBar.test.tsx`
   - `components/idle/IdlePrompt.test.tsx`
3. Write tests for user interactions
4. Run: `npm test`

**Dependencies**: Key Phase 2 tasks
**Estimated Time**: 3 hours

---

### Task 3.3: Write Integration Tests

**Priority**: P3 | **Tags**: [Test] [Rust] [React]

**Description**: Add integration tests for database and file system operations.

**Acceptance Criteria**:
- [ ] Database integration tests pass (end-to-end CRUD)
- [ ] Filesystem integration tests pass (screenshot save/load)
- [ ] Tauri command integration tests pass
- [ ] Tests run in isolated environment

**Steps**:
1. Create `tests/integration/database_tests.rs`
2. Create `tests/integration/filesystem_tests.rs`
3. Create `tests/integration/command_tests.rs`
4. Set up test database (in-memory or temp file)
5. Run integration tests

**Dependencies**: Task 3.1
**Estimated Time**: 3 hours

---

## Phase 4: Performance Verification

### Task 4.1: Verify Memory Usage Budget

**Priority**: P1 | **Tags**: [Perf]

**Description**: Verify application memory usage stays under 100MB.

**Acceptance Criteria**:
- [ ] Idle memory usage <50MB
- [ ] Active memory usage <100MB (with 1 day of data)
- [ ] Memory profiling report generated

**Steps**:
1. Build release version: `npm run tauri build`
2. Run application and open Windows Task Manager
3. Measure idle memory usage
4. Load 1 day of sample data (288 screenshots, 1440 window records)
5. Measure active memory usage
6. Document results in performance report

**Dependencies**: All Phase 1 and Phase 2 tasks
**Estimated Time**: 1 hour

---

### Task 4.2: Verify UI Response Times

**Priority**: P1 | **Tags**: [Perf]

**Description**: Verify UI interactions meet <50ms response target.

**Acceptance Criteria**:
- [ ] Timeline render <50ms (1 day of data)
- [ ] Hover preview update <200ms total
- [ ] Entry creation dialog open <50ms
- [ ] Search results display <100ms
- [ ] Performance report generated

**Steps**:
1. Add performance logging to key components
2. Use React DevTools Profiler
3. Measure timeline render time
4. Measure hover preview load time
5. Measure dialog open time
6. Document results

**Dependencies**: Key Phase 2 tasks
**Estimated Time**: 1.5 hours

---

### Task 4.3: Verify Database Query Performance

**Priority**: P2 | **Tags**: [Perf] [Rust]

**Description**: Verify database queries meet performance targets.

**Acceptance Criteria**:
- [ ] Timeline query (1 day) <10ms
- [ ] Screenshot lookup <10ms
- [ ] Search across 1 year <1000ms
- [ ] Performance report generated

**Steps**:
1. Add timing logs to database queries
2. Populate database with 1 year of sample data
3. Measure timeline query performance
4. Measure screenshot lookup performance
5. Measure search performance
6. Document results

**Dependencies**: Task 3.1
**Estimated Time**: 2 hours

---

### Task 4.4: Verify Screenshot Capture Performance

**Priority**: P2 | **Tags**: [Perf] [Rust]

**Description**: Verify screenshot capture meets <100ms target.

**Acceptance Criteria**:
- [ ] Screenshot capture <100ms
- [ ] Capture does not block UI thread
- [ ] Performance report generated

**Steps**:
1. Add timing logs to capture function
2. Measure 10 consecutive screenshot captures
3. Verify UI remains responsive during capture
4. Document results

**Dependencies**: Task 1.3
**Estimated Time**: 1 hour

---

## Phase 5: Documentation and Polish

### Task 5.1: Update README

**Priority**: P3 | **Tags**: [Config]

**Description**: Create comprehensive README for the project.

**Acceptance Criteria**:
- [ ] README.md exists in repository root
- [ ] Project description and features listed
- [ ] Installation instructions match quickstart.md
- [ ] Screenshots of key UI components
- [ ] Performance benchmarks documented

**Steps**:
1. Create `README.md`
2. Add project description, features, tech stack
3. Add installation and development setup
4. Add screenshots of timeline, entry creation, search
5. Document performance benchmarks (from Phase 4)

**Dependencies**: All Phase 4 tasks
**Estimated Time**: 1 hour

---

### Task 5.2: Final Code Review and Cleanup

**Priority**: P3 | **Tags**: [Config] [Rust] [React]

**Description**: Final code cleanup, linting, and review.

**Acceptance Criteria**:
- [ ] All TypeScript strict mode errors resolved
- [ ] All Rust clippy warnings addressed
- [ ] Code formatted consistently (prettier, rustfmt)
- [ ] No console errors in dev mode
- [ ] No TODO comments left in production code

**Steps**:
1. Run TypeScript compiler: `npm run build`
2. Run Rust linter: `cd src-tauri && cargo clippy`
3. Run formatters: `prettier --write .`, `cargo fmt`
4. Fix all warnings
5. Final manual code review

**Dependencies**: All tasks
**Estimated Time**: 2 hours

---

## Task Dependencies Graph

```
Task 0.1 (Setup) → Task 0.2 (Type sharing)
                ↓
                Task 1.1 (Database) → Task 1.2 (Time Entry CRUD) → Task 2.3 (Timeline)
                                              ↓                ↓
                                    Task 1.3 (Screenshot) ──→ Task 2.5 (Hover Preview)
                                              ↓
                                    Task 1.4 (Window) ──→ Task 2.2 (State)
                                              ↓
                                    Task 1.5 (Idle) ────→ Task 2.8 (Idle Prompt)
                                              ↓
                                    Task 1.6 (Export) ────→ Task 2.10 (Export UI)
                                              ↓
                                    Task 1.7 (Search) ───→ Task 2.9 (Search)

Task 2.1 (React structure) → Task 2.2 (State) → Task 2.3 (Timeline) → Task 2.4 (Gap Creation)
```

---

## Success Criteria (from spec.md)

| Criteria | Task(s) | How Verified |
|----------|-----------|--------------|
| SC-001: View timeline <3s | 2.3, 2.2 | Manual testing + timing logs |
| SC-002: Create entry <10s | 2.4 | Manual testing |
| SC-003: Screenshot preview <200ms | 2.5 | Performance verification (4.2) |
| SC-004: Background capture non-blocking | 1.3, 1.4 | Performance verification (4.4) |
| SC-005: Search <1s | 1.7, 2.9 | Performance verification (4.3) |
| SC-006: Memory <100MB | All | Performance verification (4.1) |
| SC-007: Browse screenshots | 1.3, 2.5 | Manual testing (filesystem access) |
| SC-008: Valid JSON export | 1.6, 2.10 | Unit tests + manual verification |
| SC-009: 90% fill gap on first try | 2.4 | UX testing with sample users |
| SC-010: 95% idle detection accuracy | 1.5 | Manual testing + unit tests |

---

## Estimated Total Time

| Phase | Estimated Time |
|-------|----------------|
| Phase 0: Project Setup | 1 hour |
| Phase 1: Backend Foundation | 13.5 hours |
| Phase 2: Frontend Foundation | 16.5 hours |
| Phase 3: Testing | 10 hours |
| Phase 4: Performance Verification | 5.5 hours |
| Phase 5: Documentation and Polish | 3 hours |
| **Total** | **49.5 hours (~6.2 days)** |

---

## Next Steps

1. Start with **Task 0.1: Initialize Tauri Project Structure**
2. Follow dependencies graph for optimal workflow
3. Mark tasks complete as you finish them
4. Run performance verification (Phase 4) before finalizing
5. Update Constitution compliance status in plan.md if any violations emerge
