# Quickstart: Digital Diary

**Date**: 2026-01-17
**Purpose**: Get the Digital Diary project running locally on Windows

## Prerequisites

- **Windows 10/11** (MVP target platform)
- **Node.js 20+** (for React frontend)
- **Rust 1.75+** (for Tauri backend)
- **Git** (for version control)

### Install Tools

```powershell
# Install Node.js (if not already installed)
winget install OpenJS.NodeJS

# Install Rust (if not already installed)
winget install Rustlang.Rustup

# Verify installations
node --version  # Should be v20+
rustc --version  # Should be 1.75+
```

## Project Setup

### 1. Clone Repository

```powershell
cd D:\emy\repos\toggl_like
git checkout 001-digital-diary
```

### 2. Initialize Tauri Project

```powershell
# From repository root
npm install
cd src-tauri
cargo install tauri-cli --locked
cargo build
```

### 3. Install Dependencies

```powershell
# Frontend dependencies (from repo root)
npm install react@latest react-dom@latest @types/react @types/react-dom
npm install zustand @tanstack/react-query
npm install lucide-react  # Icons

# Backend dependencies (from src-tauri/)
cd src-tauri
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
cargo add windows-capture
cargo add windows-rs
cargo add chrono
cargo add rusqlite
cargo add tokio --features "full"
cargo add serde --features "derive"
cargo add specta specta-typescript
```

## Directory Structure

After setup, the project should look like:

```
toggl_like/
├── src/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── timeline/
│   │   │   ├── capture/
│   │   │   ├── idle/
│   │   │   ├── search/
│   │   │   └── export/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── capture/
│   │   ├── data/
│   │   ├── idle/
│   │   ├── export/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
└── specs/001-digital-diary/       # Documentation
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    └── contracts/
        └── api.yaml
```

## Development

### Start Dev Server

```powershell
# From repository root
npm run tauri dev
```

This will:
1. Start Vite dev server for React (http://localhost:1420)
2. Build and run Tauri application
3. Open the Digital Diary window

### Database Initialization

On first run, the app will:
1. Create data directory at `%LocalAppData%\DigitalDiary\`
2. Initialize SQLite database at `%LocalAppData%\DigitalDiary\database.db`
3. Create screenshot folder structure: `screenshots/YYYY/MM/DD/`

### Verify Setup

1. **Timeline View**: You should see a horizontal timeline showing the current day
2. **Gap Creation**: Click and drag on the timeline to create a time entry
3. **Capture Status**: Background capture indicator should show "Active"
4. **Search**: Type in the search bar (empty initially, no data)

## Building for Production

```powershell
# From repository root
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`:
- Windows: `.exe` installer
- Configuration files included

## Key Configuration Files

### `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2.0", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
windows-capture = "1.5"
windows-rs = { version = "0.54", features = ["Win32_UI_WindowsAndMessaging"] }
rusqlite = { version = "0.31", features = ["bundled"] }
tokio = { version = "1.0", features = ["full"] }
specta = "2.0"
specta-typescript = "0.2"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }
```

### `package.json` (Frontend)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "zustand": "^4.5",
    "@tanstack/react-query": "^5.0",
    "lucide-react": "^0.400"
  }
}
```

## Common Development Tasks

### Add a New Tauri Command

```rust
// src-tauri/src/commands/time_entries.rs
#[tauri::command]
pub async fn create_time_entry(entry: TimeEntryInput) -> Result<TimeEntry, String> {
    // Implementation
}

// src-tauri/src/main.rs
mod commands;
use commands::time_entries::create_time_entry;
```

```typescript
// src/services/api.ts
export const createTimeEntry = (entry: TimeEntryInput) =>
  invoke<TimeEntry>('create_time_entry', { entry });
```

### Run Tests

```powershell
# Rust unit tests
cd src-tauri
cargo test

# React component tests (if set up)
cd ..
npm test
```

### View Database

```powershell
# Open SQLite database
# Data location: %LocalAppData%\DigitalDiary\database.db

# Use any SQLite browser tool (DB Browser for SQLite, etc.)
```

## Troubleshooting

### Build Fails with "windows-capture not found"

```powershell
cd src-tauri
cargo add windows-capture
```

### TypeScript Errors After Adding Rust Types

```powershell
# Regenerate TypeScript types from Rust
cd src-tauri
cargo run -p specta

# Or manually update src/services/types.ts
```

### App Won't Start (Database Locked)

```powershell
# Delete existing database to reinitialize
Remove-Item "$env:LOCALAPPDATA\DigitalDiary\database.db"
```

### Screenshot Capture Not Working

- Ensure Windows screen capture permissions are granted
- Check Windows privacy settings: Settings → Privacy → Screen capture
- Verify `windows-capture` version is 1.5.0+

## Next Steps

1. **Read the spec**: `specs/001-digital-diary/spec.md`
2. **Review the plan**: `specs/001-digital-diary/plan.md`
3. **Study the data model**: `specs/001-digital-diary/data-model.md`
4. **Check API contracts**: `specs/001-digital-diary/contracts/api.yaml`

## Performance Budgets (Constitution)

| Metric | Target | Verify Command |
|--------|--------|----------------|
| Memory Usage | <100MB active | Windows Task Manager |
| UI Response | <50ms | React DevTools Profiler |
| Screenshot Capture | <100ms | Add Rust logging in capture module |
| Database Query | <10ms | Add Rust logging in data module |
| App Startup | <1000ms | Measure with timer |

## Getting Help

- **Tauri Documentation**: https://v2.tauri.app/
- **React Documentation**: https://react.dev/
- **Rust Book**: https://doc.rust-lang.org/book/
- **Project Constitution**: `.specify/memory/constitution.md`

## License

See LICENSE file in repository root.
