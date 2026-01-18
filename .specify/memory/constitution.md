<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version Change: N/A → 1.0.0 (Initial ratification)

  Modified Principles: None (initial creation)

  Added Sections:
    - Core Principles (6 principles)
    - Technical Constraints
    - Development Workflow
    - Governance

  Removed Sections: None (initial creation)

  Templates Requiring Updates:
    - .specify/templates/plan-template.md ✅ No changes needed (Constitution Check section exists)
    - .specify/templates/spec-template.md ✅ No changes needed (generic structure)
    - .specify/templates/tasks-template.md ✅ No changes needed (generic structure)
    - .specify/templates/checklist-template.md ✅ No changes needed (generic structure)
    - .specify/templates/agent-file-template.md ✅ No changes needed (generic structure)

  Follow-up TODOs: None
  ============================================================================
-->

# TogglLike Constitution

## Core Principles

### I. Performance First

Application MUST run significantly lighter than Electron alternatives.

- Target memory usage MUST remain below 100MB during normal operation
- Background tasks (screenshots, database writes) MUST NOT block the UI thread
- All I/O operations MUST be asynchronous or offloaded to background threads
- Performance budgets MUST be defined and measured for critical paths

**Rationale**: Users expect a time-tracking tool to be lightweight and unobtrusive. Heavy resource consumption defeats the purpose of a productivity application.

### II. Local-First & Data Sovereignty

All user data MUST reside locally on the user's machine with no mandatory cloud dependencies.

- Data storage MUST use SQLite combined with standard file system structures
- Data format MUST ensure readability for 50+ years (no proprietary formats)
- Application MUST function fully offline
- Any future sync features MUST be opt-in, never required

**Rationale**: Users own their productivity data. Long-term data accessibility ensures users are never locked into the application or dependent on external services.

### III. AI-Driven Development Friendly

Code MUST be structured to minimize AI hallucination during development assistance.

- All code MUST be strictly typed (TypeScript for frontend, Rust for backend)
- Code MUST be modular with clear separation of concerns
- Standard patterns MUST be used (React Hooks, Rust Result types, etc.)
- Function signatures MUST be explicit and self-documenting

**Rationale**: AI-assisted development is a core workflow. Code patterns that LLMs excel at generating reduce errors and accelerate development.

### IV. Hybrid Storage Strategy

Database is strictly for indexing and metadata; heavy assets reside in the file system.

- SQLite MUST store only metadata, indexes, and relational data
- Screenshots and other binary assets MUST be stored in the file system
- File paths MUST be stored in the database for asset reference
- Database MUST remain portable (easily backed up, moved, or inspected)

**Rationale**: Separating metadata from assets ensures database portability, simplifies backups, and prevents database bloat that degrades performance.

### V. Privacy by Design

Screenshots and window titles are sensitive data requiring protection.

- All sensitive data MUST be stored locally only
- Architecture MUST support future obfuscation features (blur, redact)
- Architecture MUST support future blacklist features (exclude apps/windows)
- No telemetry or analytics MUST be collected without explicit user consent

**Rationale**: Time-tracking data reveals work patterns, visited sites, and application usage. Privacy protection is a fundamental user right, not a feature.

### VI. Modern UX Standards

UI MUST support fluid, modern interactions using contemporary web technologies.

- Interactions MUST include drag-to-select, timeline scrubbing, and smooth animations
- UI MUST be built with React and SVG for vector-based, scalable graphics
- Legacy UI patterns (modal dialogs for simple actions, page reloads) MUST be avoided
- Responsive feedback MUST be provided for all user actions within 100ms

**Rationale**: A time-tracking tool is used frequently throughout the day. Modern, fluid interactions reduce friction and improve user satisfaction.

## Technical Constraints

### Technology Stack

- **Frontend**: TypeScript, React, SVG-based visualizations
- **Backend**: Rust (Tauri framework for native performance)
- **Database**: SQLite (metadata and indexes only)
- **File Storage**: Standard file system (screenshots, exports)

### Performance Budgets

| Metric | Target | Maximum |
|--------|--------|---------|
| Memory Usage | <50MB idle | <100MB active |
| UI Response | <50ms | <100ms |
| Screenshot Capture | <100ms | <200ms |
| Database Query | <10ms | <50ms |
| App Startup | <500ms | <1000ms |

### Data Portability Requirements

- Database MUST be a single SQLite file
- Screenshots MUST use standard formats (PNG, JPEG)
- Export MUST support common formats (CSV, JSON)
- No proprietary binary formats permitted

## Development Workflow

### Code Quality Gates

- All code MUST pass TypeScript/Rust strict mode compilation
- All public APIs MUST have type definitions
- All async operations MUST have proper error handling
- Memory-intensive operations MUST be profiled before merge

### Testing Requirements

- Unit tests for business logic
- Integration tests for database operations
- Performance tests for operations with defined budgets
- Manual testing for UI interactions

### Review Checklist

Before any PR merge, verify:

1. Does this change respect the <100MB memory budget?
2. Does this change block the UI thread?
3. Is sensitive data stored locally only?
4. Are all types explicit (no `any` in TypeScript)?
5. Does the database schema change affect portability?

## Governance

This Constitution supersedes all other development practices and guidelines.

### Amendment Process

1. Propose amendment with rationale in a dedicated PR
2. Document impact on existing code and architecture
3. Provide migration plan if breaking changes required
4. Require explicit approval before merge
5. Update version number according to semantic versioning

### Versioning Policy

- **MAJOR**: Backward-incompatible principle changes or removals
- **MINOR**: New principles added or existing principles materially expanded
- **PATCH**: Clarifications, wording improvements, non-semantic refinements

### Compliance

- All PRs MUST include Constitution compliance verification
- Complexity additions MUST be justified against these principles
- Violations MUST be documented with rationale if temporarily accepted

**Version**: 1.0.0 | **Ratified**: 2026-01-16 | **Last Amended**: 2026-01-16
