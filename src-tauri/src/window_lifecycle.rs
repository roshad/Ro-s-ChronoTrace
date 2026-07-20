use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, WebviewWindowBuilder, Window, WindowEvent,
};

use crate::app_settings::{self, MainWindowState};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "main-tray";
const SHOW_MENU_ID: &str = "show-main-window";
const QUIT_MENU_ID: &str = "quit-app";
const DESTROY_DELAY: std::time::Duration = std::time::Duration::from_secs(60);

#[derive(Default)]
pub struct WindowLifecycleState {
    focus_generation: AtomicU64,
}

impl WindowLifecycleState {
    fn cancel_pending_destroy(&self) {
        self.focus_generation.fetch_add(1, Ordering::SeqCst);
    }

    fn next_destroy_generation(&self) -> u64 {
        self.focus_generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn is_current(&self, generation: u64) -> bool {
        self.focus_generation.load(Ordering::SeqCst) == generation
    }
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    setup_tray(app)?;
    schedule_initial_show_fallback(app.handle().clone());
    Ok(())
}

fn setup_tray(app: &App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, SHOW_MENU_ID, "打开主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, QUIT_MENU_ID, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Ro's ChronoTrace")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            SHOW_MENU_ID => request_main_window(app),
            QUIT_MENU_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                request_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => save_main_window_state(window),
        WindowEvent::Focused(true) => {
            window
                .app_handle()
                .state::<WindowLifecycleState>()
                .cancel_pending_destroy();
        }
        WindowEvent::Focused(false) => {
            save_main_window_state(window);
            if auto_destroy_inactive_window_enabled() {
                schedule_destroy(window.app_handle().clone());
            } else {
                window
                    .app_handle()
                    .state::<WindowLifecycleState>()
                    .cancel_pending_destroy();
            }
        }
        // Closing the window destroys the WebView immediately. The app-level
        // ExitRequested handler keeps the Rust process and screenshot task alive.
        WindowEvent::CloseRequested { .. } => {}
        _ => {}
    }
}

fn auto_destroy_inactive_window_enabled() -> bool {
    match app_settings::load_screenshot_settings() {
        Ok(settings) => settings.auto_destroy_inactive_window,
        Err(error) => {
            eprintln!("Failed to load window lifecycle setting: {error}");
            true
        }
    }
}

fn schedule_destroy(app: AppHandle) {
    let generation = app
        .state::<WindowLifecycleState>()
        .next_destroy_generation();

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(DESTROY_DELAY).await;

        if !app.state::<WindowLifecycleState>().is_current(generation) {
            return;
        }

        let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
            return;
        };

        match window.is_focused() {
            Ok(false) => {
                if let Err(error) = window.destroy() {
                    eprintln!("Failed to destroy inactive main WebView: {error}");
                }
            }
            Ok(true) => {}
            Err(error) => eprintln!("Failed to query main window focus: {error}"),
        }
    });
}

pub fn request_main_window(app: &AppHandle) {
    app.state::<WindowLifecycleState>().cancel_pending_destroy();

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = show_or_create_main_window(&app) {
            eprintln!("Failed to open main window: {error}");
        }
    });
}

fn show_or_create_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window
            .unminimize()
            .map_err(|error| format!("failed to restore main window: {error}"))?;
        window
            .show()
            .map_err(|error| format!("failed to show main window: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("failed to focus main window: {error}"))?;
        return Ok(());
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == MAIN_WINDOW_LABEL)
        .or_else(|| app.config().app.windows.first())
        .cloned()
        .ok_or_else(|| "main window configuration is missing".to_string())?;

    let window_state = app_settings::load_main_window_state()
        .map_err(|error| format!("failed to load main window state: {error}"))?;
    let mut builder = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| format!("failed to load main window configuration: {error}"))?
        .on_page_load(|window, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                if let Err(error) = window.show() {
                    eprintln!("Failed to reveal recreated main window: {error}");
                }
                if let Err(error) = window.set_focus() {
                    eprintln!("Failed to focus recreated main window: {error}");
                }
            }
        });

    if let Some(state) = window_state {
        if state.width > 0 && state.height > 0 {
            builder = builder
                .position(f64::from(state.x), f64::from(state.y))
                .inner_size(f64::from(state.width), f64::from(state.height));
        }
        builder = builder.maximized(state.maximized);
    }

    builder
        .build()
        .map_err(|error| format!("failed to recreate main WebView: {error}"))?;

    schedule_initial_show_fallback(app.clone());
    Ok(())
}

fn save_main_window_state(window: &Window) {
    let maximized = match window.is_maximized() {
        Ok(maximized) => maximized,
        Err(error) => {
            eprintln!("Failed to query main window maximized state: {error}");
            return;
        }
    };

    let mut state = match app_settings::load_main_window_state() {
        Ok(Some(state)) => state,
        Ok(None) => MainWindowState::default(),
        Err(error) => {
            eprintln!("Failed to load saved main window state: {error}");
            MainWindowState::default()
        }
    };

    state.maximized = maximized;
    if !maximized {
        match (window.outer_position(), window.inner_size()) {
            (Ok(position), Ok(size)) => {
                state.x = position.x;
                state.y = position.y;
                state.width = size.width;
                state.height = size.height;
            }
            (Err(error), _) => {
                eprintln!("Failed to query main window position: {error}");
                return;
            }
            (_, Err(error)) => {
                eprintln!("Failed to query main window size: {error}");
                return;
            }
        }
    }

    if let Err(error) = app_settings::save_main_window_state(&state) {
        eprintln!("Failed to save main window state: {error}");
    }
}

fn schedule_initial_show_fallback(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            match window.is_visible() {
                Ok(false) => {
                    if let Err(error) = window.show() {
                        eprintln!("Fallback show window failed: {error}");
                    }
                }
                Ok(true) => {}
                Err(error) => eprintln!("Failed to query main window visibility: {error}"),
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::WindowLifecycleState;

    #[test]
    fn newer_focus_generation_cancels_an_older_destroy_request() {
        let state = WindowLifecycleState::default();
        let destroy_generation = state.next_destroy_generation();
        assert!(state.is_current(destroy_generation));

        state.cancel_pending_destroy();
        assert!(!state.is_current(destroy_generation));
    }
}
