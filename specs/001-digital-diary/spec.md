# Feature Specification: Digital Diary

**Feature Branch**: `001-digital-diary`
**Created**: 2026-01-16
**Status**: Draft
**Input**: User description: "Lightweight retrospective time-tracking desktop application with automated context capture"

## Clarifications

### Session 2026-01-17

- Q: 第一版需要支持哪些操作系统？ → A: 仅 Windows
- Q: 截图文件的隐私保护方式（MVP）？ → A: 不加密存储（可直接浏览）
- Q: MVP 的数据存储位置？ → A: 用户级本地（%LocalAppData%）
- Q: MVP 是否需要账号登录或跨设备同步？ → A: 不需要（本地单机）
- Q: MVP 是否需要应用级访问控制（打开应用需要密码/PIN）？ → A: 不需要（打开即用）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Daily Timeline (Priority: P1)

As a user, I want to see a horizontal timeline of my day showing recorded activities and unrecorded gaps, so I can understand how I spent my time at a glance.

**Why this priority**: The timeline is the core interface of the application. Without it, users cannot visualize or interact with their time data. This is the foundation upon which all other features depend.

**Independent Test**: Can be fully tested by launching the app and viewing a day's timeline with sample data. Delivers immediate value by showing time visualization.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** I view the main screen, **Then** I see a horizontal timeline representing the current day from midnight to midnight
2. **Given** I have recorded time entries, **When** I view the timeline, **Then** recorded blocks appear in distinct colors and unrecorded gaps appear in gray
3. **Given** I hover over any point on the timeline, **When** a screenshot exists for that time, **Then** a preview thumbnail appears showing the captured screenshot

---

### User Story 2 - Fill Timeline Gaps (Priority: P2)

As a user, I want to click on empty gaps in my timeline and create time entries by dragging to select a range, so I can retrospectively log what I was doing.

**Why this priority**: Gap-filling is the primary user action after viewing the timeline. It enables the core value proposition of retrospective time tracking.

**Independent Test**: Can be tested by clicking on a gap, dragging to select a time range, and labeling the entry. Delivers value by allowing manual time logging.

**Acceptance Scenarios**:

1. **Given** I see an empty gap on the timeline, **When** I click on it, **Then** a time entry creation interface appears
2. **Given** I am creating a time entry, **When** I drag across the timeline, **Then** the selected time range is visually highlighted
3. **Given** I have selected a time range, **When** I enter a label/description and confirm, **Then** the gap is filled with a colored time block
4. **Given** I am selecting a time range, **When** I view the selection, **Then** I see the start time, end time, and duration of my selection

---

### User Story 3 - Automated Context Capture (Priority: P3)

As a user, I want the application to automatically capture screenshots and window metadata in the background, so I have context to help me remember what I was doing.

**Why this priority**: Context capture provides the "memory aid" that differentiates this from basic time trackers. However, the app is usable without it (manual entry only).

**Independent Test**: Can be tested by running the app in background for 10+ minutes and verifying screenshots and window titles are recorded. Delivers value by providing memory aids.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** 5 minutes pass, **Then** a screenshot is automatically captured and stored
2. **Given** the application is running, **When** 1 minute passes, **Then** the active window title and process name are recorded
3. **Given** screenshots have been captured, **When** I hover over the timeline at a captured moment, **Then** I see the screenshot preview
4. **Given** window metadata has been captured, **When** I view a time period, **Then** I can see what applications were active

---

### User Story 4 - Idle Detection and Recovery (Priority: P4)

As a user, I want the application to detect when I've been idle and prompt me when I return, so I can decide how to categorize that idle time.

**Why this priority**: Idle handling improves accuracy but is an enhancement to the core tracking functionality.

**Independent Test**: Can be tested by leaving the computer idle for 5+ minutes, then returning and responding to the prompt. Delivers value by handling breaks gracefully.

**Acceptance Scenarios**:

1. **Given** no mouse/keyboard activity for 5 minutes, **When** the idle threshold is reached, **Then** the system marks the start of an idle period
2. **Given** I was idle, **When** I return and interact with the computer, **Then** a prompt appears with options: "Discard time", "Add to previous task", or "Create new task"
3. **Given** I select "Discard time", **When** I confirm, **Then** the idle period remains as an untracked gap
4. **Given** I select "Add to previous task", **When** I confirm, **Then** the idle time is merged with the most recent time entry
5. **Given** I select "Create new task", **When** I confirm, **Then** I can label the idle period as a new activity

---

### User Story 5 - Search Activities (Priority: P5)

As a user, I want to search my activity history by keywords, so I can find specific moments or tasks from the past.

**Why this priority**: Search is valuable for long-term users but not essential for initial daily use.

**Independent Test**: Can be tested by entering a search term and verifying matching results appear with navigation to timeline. Delivers value by enabling historical lookup.

**Acceptance Scenarios**:

1. **Given** I have recorded activities, **When** I enter a keyword in the search bar, **Then** I see a list of matching activities
2. **Given** search results are displayed, **When** I click on a result, **Then** the timeline navigates to that specific date and time
3. **Given** I navigate to a search result, **When** the timeline shows that moment, **Then** the associated screenshot (if any) is displayed
4. **Given** I search for a term, **When** matches exist in window titles or task labels, **Then** both types of matches appear in results

---

### User Story 6 - Data Archival and Export (Priority: P6)

As a user, I want my data stored in a browsable folder structure and exportable to JSON, so I maintain ownership and portability of my data.

**Why this priority**: Archival ensures long-term data sovereignty but is not needed for day-to-day operation.

**Independent Test**: Can be tested by verifying folder structure exists and export produces valid JSON. Delivers value by ensuring data portability.

**Acceptance Scenarios**:

1. **Given** screenshots are captured, **When** I browse the data folder, **Then** I find files organized by Year/Month/Day structure
2. **Given** I want to export my data, **When** I trigger an export, **Then** all metadata is saved as a JSON file
3. **Given** I have exported JSON, **When** I open the file, **Then** it contains all time entries, window metadata, and screenshot references
4. **Given** I browse the file system, **When** I navigate to any day's folder, **Then** I can view screenshots directly without the application

---

### Edge Cases

- What happens when the user's disk is full during screenshot capture? System skips capture and logs warning; resumes when space available
- What happens when the user has multiple monitors? Capture primary monitor by default; future enhancement for multi-monitor support
- What happens when the system clock changes (DST, manual adjustment)? Use monotonic timestamps internally; display in local time
- What happens when the application crashes during capture? Incomplete captures are discarded; database maintains consistency
- What happens when the user drags a time selection across midnight? Selection is split into two entries, one for each day
- What happens when no screenshots exist for a hovered time? Show placeholder indicating "No screenshot available"

## Requirements *(mandatory)*

### Functional Requirements

**Timeline Visualization**
- **FR-001**: System MUST display a horizontal timeline representing a 24-hour day
- **FR-002**: System MUST visually distinguish recorded time blocks (colored) from unrecorded gaps (gray)
- **FR-003**: System MUST show screenshot preview on timeline hover when screenshot exists for that timestamp
- **FR-004**: System MUST allow navigation between different days

**Gap Filling**
- **FR-005**: Users MUST be able to click on timeline gaps to initiate time entry creation
- **FR-006**: Users MUST be able to drag across the timeline to select a time range
- **FR-007**: System MUST display start time, end time, and duration during range selection
- **FR-008**: Users MUST be able to assign a label/description to time entries

**Automated Capture**
- **FR-009**: System MUST capture screenshots every 5 minutes while running
- **FR-010**: System MUST record active window title and process name every 1 minute
- **FR-011**: System MUST store screenshots in the file system (not database), under the user's local app data directory by default
- **FR-012**: System MUST store metadata references in the database

**Idle Detection**
- **FR-013**: System MUST detect mouse/keyboard inactivity exceeding 5 minutes
- **FR-014**: System MUST prompt user upon return from idle with three options: discard, add to previous, create new
- **FR-015**: System MUST track idle periods separately from active time

**Search**
- **FR-016**: System MUST provide a global search bar for finding activities
- **FR-017**: System MUST search across task labels and window titles
- **FR-018**: System MUST navigate to the specific timeline point when a search result is selected

**Archival**
- **FR-019**: System MUST organize screenshot files in Year/Month/Day folder hierarchy under the default user-level data directory
- **FR-020**: System MUST support exporting all metadata to JSON format
- **FR-021**: System MUST ensure screenshots are viewable outside the application (standard image formats)

### Key Entities

- **TimeEntry**: A labeled block of time with start timestamp, end timestamp, label/description, and optional color/category
- **Screenshot**: A captured screen image with timestamp, file path reference, and associated day
- **WindowActivity**: A record of active window with timestamp, window title, process name, and duration
- **IdlePeriod**: A detected period of inactivity with start timestamp, end timestamp, and resolution status (discarded/merged/labeled)
- **Day**: A logical grouping of all entries, screenshots, and activities for a calendar date

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view their daily timeline and identify time gaps within 3 seconds of opening the application
- **SC-002**: Users can create a time entry from a gap in under 10 seconds (click, drag, label, confirm)
- **SC-003**: Screenshot hover previews appear within 200ms of mouse position change
- **SC-004**: Background capture operations complete without any visible UI interruption or lag
- **SC-005**: Search results return within 1 second for queries across 1 year of data
- **SC-006**: Application memory usage remains under 100MB during normal operation
- **SC-007**: Users can browse and view their screenshot archives using standard file explorer without the application
- **SC-008**: Exported JSON files are valid and parseable by standard JSON tools
- **SC-009**: 90% of users can successfully fill a timeline gap on their first attempt without instructions
- **SC-010**: Idle detection correctly identifies 95% of idle periods (no false positives during active typing/mouse use)

## Assumptions

- MVP is local-only: no accounts, no sign-in, no cross-device sync
- MVP has no app-level access control (no PIN/password lock)
- Users have a single primary monitor (multi-monitor support deferred to future enhancement)
- MVP targets Windows only
- Default idle threshold of 5 minutes is appropriate for most users (configurability deferred)
- Screenshot capture interval of 5 minutes balances context vs. storage (configurability deferred)
- Window metadata capture interval of 1 minute provides sufficient granularity
- Users accept that screenshots contain potentially sensitive information and store locally
- Screenshots are stored unencrypted on disk for direct browsing in file explorer (MVP)
- Default data location is user-level local app data (e.g., %LocalAppData%)
- Standard image formats (PNG/JPEG) are sufficient for screenshot storage
- JSON export format meets portability needs without requiring additional formats initially