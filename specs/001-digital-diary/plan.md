# Implementation Plan: Digital Diary

**Branch**: `001-digital-diary` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-digital-diary/spec.md`

## Summary

Desktop time-tracking application with automated context capture. Users view their day on a horizontal timeline, fill gaps by dragging to create entries, and benefit from background screenshot/window metadata capture. Implementation uses Tauri (Rust backend + React frontend) for native performance, SQLite for metadata, and file system for screenshots.

## Technical Context

**Language/Version**: Rust (Tauri 2.x), TypeScript 5.x (React 18.x)
**Primary Dependencies**: Tauri (desktop framework), React (UI), SQLite (metadata), Windows API (screenshot/window capture)
**Storage**: SQLite (time entries, window activity, idle periods) + File system (PNG/JPEG screenshots in Year/Month/Day hierarchy)
**Testing**: Rust (cargo test), React (Jest/Testing Library), Integration tests for database and file system operations
**Target Platform**: Windows only (MVP)
**Project Type**: Desktop application (Tauri)
**Performance Goals**: Screenshot hover preview <200ms, search across 1 year <1s, memory <100MB (idle <50MB), UI response <50ms, screenshot capture <100ms
**Constraints**: Local-only (no network), offline-capable, non-blocking background capture, <100MB memory budget
**Scale/Scope**: Single user device, expected timeline data for multiple years, screenshot volume ~288/day (one per 5 min), window metadata ~1440/day (one per min)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Compliance |
|-----------|--------|---------------------|
| I. Performance First | ✅ PASS | Spec defines <100MB memory budget (SC-006), Tauri + Rust chosen for native performance, background capture designed to be non-blocking (FR-009, FR-010) |
| II. Local-First & Data Sovereignty | ✅ PASS | Clarifications: local-only, no accounts/sync. SQLite + file system storage (constitution-compliant). JSON export for portability (FR-020) |
| III. AI-Driven Development Friendly | ✅ PASS | TypeScript (React) + Rust (Tauri) strictly typed. Modular architecture planned (separate UI, data, capture layers) |
| IV. Hybrid Storage Strategy | ✅ PASS | FR-011: screenshots in file system, FR-012: metadata in database. File paths stored as references (matches constitution) |
| V. Privacy by Design | ✅ PASS | Clarifications: unencrypted local storage (user choice). No cloud/telemetry. Architecture supports future obfuscation/blacklist |
| VI. Modern UX Standards | ✅ PASS | React + SVG for timeline. Drag-to-select (FR-006), timeline navigation (FR-004), hover previews (FR-003). Fluid interactions specified (SC-002) |

| Technical Constraint | Status | Evidence/Compliance |
|---------------------|--------|---------------------|
| Tech Stack (TS/Rust/SQLite) | ✅ PASS | Tauri uses TypeScript frontend + Rust backend, SQLite for metadata |
| Memory Budget (<100MB) | ✅ PASS | SC-006: "Application memory usage remains under 100MB during normal operation" |
| Data Portability (SQLite + PNG/JPEG) | ✅ PASS | FR-019: Year/Month/Day folder structure. FR-021: standard image formats. FR-020: JSON export |

**Gate Result**: ✅ **PASS** (Initial) - No constitution violations. Proceed to Phase 0 research.

---

**Re-check After Phase 1 Design**:

| Principle | Status | Additional Evidence |
|-----------|--------|---------------------|
| I. Performance First | ✅ PASS | **Phase 1 Design Confirms**: SQLite indexes on timestamps ensure <1s search (data-model.md). tokio async background tasks prevent UI blocking (research.md). SVG + React.memo ensure <200ms hover previews (research.md) |
| II. Local-First & Data Sovereignty | ✅ PASS | **Phase 1 Design Confirms**: Single SQLite file database (data-model.md). Relative file paths ensure portability. JSON export includes all metadata (contracts/api.yaml) |
| III. AI-Driven Development Friendly | ✅ PASS | **Phase 1 Design Confirms**: Rust structs derive serde specta for TypeScript generation (research.md). Clear separation: capture/, data/, idle/, export/ modules (plan.md Project Structure) |
| IV. Hybrid Storage Strategy | ✅ PASS | **Phase 1 Design Confirms**: SQLite stores only metadata references, filesystem holds binary assets (data-model.md). Day grouping via YYYYMMDD integer for fast queries |
| V. Privacy by Design | ✅ PASS | **Phase 1 Design Confirms**: No network endpoints defined (contracts/api.yaml - conceptual only). All storage paths local (%LocalAppData%). Supports future obfuscation via blur/redact fields in schema |
| VI. Modern UX Standards | ✅ PASS | **Phase 1 Design Confirms**: Custom SVG timeline component (research.md). Drag-to-select API (TimeEntryInput schema). Hover preview path: timestamp → file_path lookup (contracts/api.yaml) |

| Technical Constraint | Status | Additional Evidence |
|---------------------|--------|---------------------|
| Tech Stack (TS/Rust/SQLite) | ✅ PASS | Implementation confirmed: Tauri commands invoke Rust backend (contracts/api.yaml). React frontend with Zustand + Tanstack Query (research.md) |
| Memory Budget (<100MB) | ✅ PASS | Schema designed for efficiency: INTEGER timestamps, minimal TEXT fields (data-model.md). Window activity batch inserts every 5 min (research.md) |
| Data Portability (SQLite + PNG/JPEG) | ✅ PASS | ExportData schema includes all entities (contracts/api.yaml). Screenshot file_path references enable direct browsing (data-model.md) |

**Final Gate Result**: ✅ **PASS** - Phase 1 design confirms compliance with all constitutional principles and constraints.

## Project Structure

### Documentation (this feature)

```text
specs/001-digital-diary/
├── spec.md              # Feature specification (exists)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── api.yaml         # Tauri command contracts (if needed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Desktop application (Tauri)
src/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── capture/     # Screenshot and window metadata capture
│   │   ├── data/        # SQLite database operations
│   │   ├── idle/        # Idle detection logic
│   │   ├── export/      # JSON export functionality
│   │   └── main.rs      # Application entry point
│   ├── Cargo.toml
│   └── tauri.conf.json
│
└── src/                 # React frontend
    ├── components/
    │   ├── timeline/    # Timeline visualization (SVG-based)
    │   ├── capture/     # Capture status indicator
    │   ├── idle/        # Idle prompt dialog
    │   ├── search/      # Search bar and results
    │   └── export/      # Export trigger
    ├── pages/
    │   ├── TimelineView.tsx
    │   └── SettingsView.tsx
    ├── services/
    │   ├── api.ts       # Tauri command wrappers
    │   └── types.ts     # TypeScript types from Rust
    ├── App.tsx
    └── main.tsx

tests/
├── contract/            # Tauri command integration tests
├── integration/         # Database + file system integration
└── unit/                # Rust unit tests + React component tests
```

**Structure Decision**: Tauri desktop app structure. `src-tauri/` contains Rust backend organized by feature (capture, data, idle, export). `src/` contains React frontend with component-based organization. This matches Tauri conventions and supports modularity for AI-assisted development.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - No constitution violations to justify.
