fn main() {
    slint_build::compile("ui/app.slint").expect("failed to compile Slint UI");
    #[cfg(feature = "legacy-tauri")]
    tauri_build::build();
}
