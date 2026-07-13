// Idle background recording has been intentionally disabled.

/// Tauri command: Resolve an idle period
#[cfg_attr(feature = "legacy-tauri", tauri::command)]
#[specta::specta]
#[allow(dead_code)]
pub async fn resolve_idle_period(
    resolution: crate::types::IdlePeriodResolution,
) -> Result<crate::types::IdlePeriod, String> {
    crate::data::with_db(|conn| {
        crate::data::idle::resolve_idle_period_with_action(conn, &resolution)
    })
}
