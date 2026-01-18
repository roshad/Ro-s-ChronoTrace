fn main() {
    tauri_build::build();

    // Export TypeScript types using specta
    specta::export_ts(
        &std::path::PathBuf::from("../src/services/types.ts"),
        specta::typescript::ExportConfig::default().flatten(true)
    ).expect("Failed to export TypeScript types");
}
