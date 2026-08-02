use tauri::AppHandle;

#[cfg(windows)]
mod windows_panel {
    use std::mem::size_of;
    use std::sync::{
        atomic::{AtomicIsize, Ordering},
        Mutex, OnceLock,
    };

    use tauri::{image::Image, AppHandle};
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{
        BOOL, COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM,
    };
    use windows::Win32::Graphics::Gdi::{
        BeginPaint, CreateFontW, CreatePen, CreateRoundRectRgn, CreateSolidBrush, DeleteObject,
        DrawTextW, Ellipse, EndPaint, FillRect, GetMonitorInfoW, GetStockObject, InvalidateRect,
        LineTo, MonitorFromPoint, MoveToEx, RoundRect, SelectObject, SetBkMode, SetTextColor,
        SetWindowRgn, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH,
        DT_CENTER, DT_END_ELLIPSIS, DT_LEFT, DT_NOPREFIX, DT_RIGHT, DT_SINGLELINE, DT_VCENTER,
        FF_SWISS, FW_BOLD, FW_NORMAL, MONITORINFO, MONITOR_DEFAULTTONEAREST, NULL_BRUSH, NULL_PEN,
        OUT_DEFAULT_PRECIS, PS_SOLID, TRANSPARENT,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::Input::KeyboardAndMouse::{SetFocus, VK_ESCAPE};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, GetClientRect, GetSystemMetrics, KillTimer,
        RegisterClassExW, SetForegroundWindow, SetTimer, SetWindowPos, ShowWindow, CS_HREDRAW,
        CS_VREDRAW, HMENU, HTCLIENT, HWND_TOPMOST, MA_ACTIVATE, SM_CXSCREEN, SM_CYSCREEN,
        SWP_SHOWWINDOW, SW_HIDE, SW_SHOW, WA_INACTIVE, WM_ACTIVATE, WM_ERASEBKGND, WM_KEYDOWN,
        WM_KILLFOCUS, WM_LBUTTONUP, WM_MOUSEACTIVATE, WM_NCHITTEST, WM_PAINT, WM_TIMER,
        WNDCLASSEXW, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
    };

    use crate::data::tray_summary::{self, CategorySummary, TraySummary};

    const CLASS_NAME: PCWSTR = w!("RoChronoTraceTrayPanel");
    const TRAY_ID: &str = "main-tray";
    const PANEL_WIDTH: i32 = 360;
    const INITIAL_HEIGHT: i32 = 262;
    const TIMER_ID: usize = 1;
    const MAX_CATEGORY_ROWS: usize = 8;
    const STATUS_CARD_BOTTOM: i32 = 164;
    const DETAIL_TITLE_TOP: i32 = 176;
    const CATEGORY_ROW_START: i32 = 204;
    const ICON_SIZE: u32 = 32;

    const BG: COLORREF = COLORREF(0x00171C28);
    const CARD_BG: COLORREF = COLORREF(0x00212838);
    const ROW_BG: COLORREF = COLORREF(0x001D2432);
    const TRACK_BG: COLORREF = COLORREF(0x00313B4D);
    const PRIMARY_TEXT: COLORREF = COLORREF(0x00F6F8FB);
    const SECONDARY_TEXT: COLORREF = COLORREF(0x009CA9BB);
    const MUTED_TEXT: COLORREF = COLORREF(0x006C788A);
    const ACCENT: COLORREF = COLORREF(0x0057B8FF);
    const DANGER: COLORREF = COLORREF(0x00FF7E7E);
    const UNCATEGORIZED_RGB: (u8, u8, u8) = (100, 116, 139);

    static PANEL_HWND: AtomicIsize = AtomicIsize::new(0);
    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
    static WINDOW_CLASS: OnceLock<Result<(), String>> = OnceLock::new();
    static LAST_ICON_STATE: OnceLock<Mutex<Option<(u8, u8, u8)>>> = OnceLock::new();

    pub fn initialize(app: AppHandle) {
        let _ = APP_HANDLE.set(app);
        if let Err(error) = ensure_window() {
            eprintln!("Failed to initialize native tray panel: {error}");
        }
    }

    pub fn show(app: &AppHandle, tray_x: i32, tray_y: i32) {
        let _ = APP_HANDLE.set(app.clone());

        if let Err(error) = tray_summary::refresh_from_database() {
            eprintln!("Failed to refresh tray summary before showing panel: {error}");
        }
        if let Err(error) = update_tray_icon(app) {
            eprintln!("Failed to refresh tray icon before showing panel: {error}");
        }

        let hwnd = match ensure_window() {
            Ok(hwnd) => hwnd,
            Err(error) => {
                eprintln!("Failed to create native tray panel: {error}");
                return;
            }
        };

        if let Err(error) = show_window(hwnd, tray_x, tray_y) {
            eprintln!("Failed to show native tray panel: {error}");
        }
    }

    pub(super) fn show_window(hwnd: HWND, tray_x: i32, tray_y: i32) -> Result<(), String> {
        let summary = tray_summary::snapshot();
        let rows = display_categories(&summary);
        let height = panel_height(rows.len());
        let (x, y) = panel_position(tray_x, tray_y, height);

        unsafe {
            let region = CreateRoundRectRgn(0, 0, PANEL_WIDTH + 1, height + 1, 22, 22);
            let _ = SetWindowRgn(hwnd, region, BOOL(1));

            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                x,
                y,
                PANEL_WIDTH,
                height,
                SWP_SHOWWINDOW,
            )
            .map_err(|error| format!("failed to position tray panel: {error}"))?;

            SetTimer(hwnd, TIMER_ID, 1000, None);
            let _ = ShowWindow(hwnd, SW_SHOW);
            let _ = SetForegroundWindow(hwnd);
            let _ = SetFocus(hwnd);
            let _ = InvalidateRect(hwnd, None, BOOL(0));
        }

        Ok(())
    }

    fn ensure_class() -> Result<HINSTANCE, String> {
        let instance = unsafe {
            GetModuleHandleW(None)
                .map(|module| module.into())
                .map_err(|error| format!("failed to get module handle: {error}"))?
        };

        WINDOW_CLASS
            .get_or_init(|| unsafe {
                let class = WNDCLASSEXW {
                    cbSize: size_of::<WNDCLASSEXW>() as u32,
                    style: CS_HREDRAW | CS_VREDRAW,
                    lpfnWndProc: Some(window_proc),
                    cbClsExtra: 0,
                    cbWndExtra: 0,
                    hInstance: instance,
                    hIcon: Default::default(),
                    hCursor: Default::default(),
                    hbrBackground: Default::default(),
                    lpszMenuName: PCWSTR::null(),
                    lpszClassName: CLASS_NAME,
                    hIconSm: Default::default(),
                };

                if RegisterClassExW(&class) == 0 {
                    return Err("failed to register tray panel window class".to_string());
                }

                Ok(())
            })
            .clone()?;

        Ok(instance)
    }

    pub(super) fn ensure_window() -> Result<HWND, String> {
        let current = PANEL_HWND.load(Ordering::Acquire);
        if current != 0 {
            return Ok(HWND(current as _));
        }

        let instance = ensure_class()?;
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_TOPMOST,
                CLASS_NAME,
                w!("Ro's ChronoTrace"),
                WS_POPUP,
                0,
                0,
                PANEL_WIDTH,
                INITIAL_HEIGHT,
                HWND::default(),
                HMENU::default(),
                instance,
                None,
            )
            .map_err(|error| format!("failed to create tray panel window: {error}"))?
        };

        unsafe {
            let region = CreateRoundRectRgn(0, 0, PANEL_WIDTH + 1, INITIAL_HEIGHT + 1, 22, 22);
            let _ = SetWindowRgn(hwnd, region, BOOL(1));
            let _ = ShowWindow(hwnd, SW_HIDE);
        }

        PANEL_HWND.store(hwnd.0 as isize, Ordering::Release);
        Ok(hwnd)
    }

    fn panel_position(tray_x: i32, tray_y: i32, height: i32) -> (i32, i32) {
        unsafe {
            let point = POINT {
                x: tray_x,
                y: tray_y,
            };
            let monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST);
            let mut monitor_info = MONITORINFO {
                cbSize: size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };

            let work_area =
                if !monitor.is_invalid() && GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
                    monitor_info.rcWork
                } else {
                    RECT {
                        left: 0,
                        top: 0,
                        right: GetSystemMetrics(SM_CXSCREEN),
                        bottom: GetSystemMetrics(SM_CYSCREEN),
                    }
                };

            let mut x = tray_x - PANEL_WIDTH / 2;
            let mut y = tray_y - height - 10;
            let work_height = work_area.bottom - work_area.top;

            if tray_y < work_area.top + work_height / 2 {
                y = tray_y + 10;
            }

            let min_x = work_area.left + 8;
            let max_x = (work_area.right - PANEL_WIDTH - 8).max(min_x);
            let min_y = work_area.top + 8;
            let max_y = (work_area.bottom - height - 8).max(min_y);

            x = x.clamp(min_x, max_x);
            y = y.clamp(min_y, max_y);
            (x, y)
        }
    }

    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match message {
            WM_PAINT => {
                paint(hwnd);
                LRESULT(0)
            }
            WM_ERASEBKGND => LRESULT(1),
            WM_ACTIVATE => {
                if (wparam.0 & 0xffff) as u32 == WA_INACTIVE {
                    hide(hwnd);
                }
                LRESULT(0)
            }
            WM_KILLFOCUS => {
                hide(hwnd);
                LRESULT(0)
            }
            WM_MOUSEACTIVATE => LRESULT(MA_ACTIVATE as isize),
            WM_NCHITTEST => LRESULT(HTCLIENT as isize),
            WM_LBUTTONUP => {
                handle_click(hwnd, lparam);
                LRESULT(0)
            }
            WM_KEYDOWN => {
                if wparam.0 == VK_ESCAPE.0 as usize {
                    hide(hwnd);
                }
                LRESULT(0)
            }
            WM_TIMER => {
                if wparam.0 == TIMER_ID {
                    if let Err(error) = tray_summary::refresh_from_database() {
                        eprintln!("Failed to refresh visible tray summary: {error}");
                    }
                    if let Some(app) = APP_HANDLE.get() {
                        if let Err(error) = update_tray_icon(app) {
                            eprintln!("Failed to refresh tray icon: {error}");
                        }
                    }
                    let _ = InvalidateRect(hwnd, None, BOOL(0));
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, message, wparam, lparam),
        }
    }

    unsafe fn hide(hwnd: HWND) {
        let _ = KillTimer(hwnd, TIMER_ID);
        let _ = ShowWindow(hwnd, SW_HIDE);
    }

    unsafe fn handle_click(hwnd: HWND, lparam: LPARAM) {
        let x = (lparam.0 as u32 & 0xffff) as u16 as i16 as i32;
        let y = ((lparam.0 as u32 >> 16) & 0xffff) as u16 as i16 as i32;
        let summary = tray_summary::snapshot();
        let footer_top = panel_height(display_categories(&summary).len()) - 58;

        if y < footer_top {
            return;
        }

        if x < PANEL_WIDTH / 2 {
            hide(hwnd);
            if let Some(app) = APP_HANDLE.get() {
                crate::window_lifecycle::request_main_window(app);
            }
        } else {
            hide(hwnd);
            if let Some(app) = APP_HANDLE.get() {
                app.exit(0);
            }
        }
    }

    unsafe fn paint(hwnd: HWND) {
        let mut paint_struct = Default::default();
        let hdc = BeginPaint(hwnd, &mut paint_struct);
        let mut client = RECT::default();
        let _ = GetClientRect(hwnd, &mut client);
        let summary = tray_summary::snapshot();
        let categories = display_categories(&summary);
        let height = client.bottom - client.top;

        fill_rect(hdc, client, BG);
        draw_round_rect(
            hdc,
            18,
            72,
            PANEL_WIDTH - 18,
            STATUS_CARD_BOTTOM,
            CARD_BG,
            16,
        );

        let title_font = create_font(18, FW_BOLD.0 as i32);
        let body_font = create_font(13, FW_NORMAL.0 as i32);
        let value_font = create_font(22, FW_BOLD.0 as i32);
        let small_font = create_font(11, FW_NORMAL.0 as i32);
        let button_font = create_font(12, FW_BOLD.0 as i32);

        draw_text(
            hdc,
            "当前状态",
            RECT {
                left: 24,
                top: 16,
                right: PANEL_WIDTH - 24,
                bottom: 43,
            },
            PRIMARY_TEXT,
            title_font,
            DT_LEFT,
        );
        draw_text(
            hdc,
            "正在执行的行为",
            RECT {
                left: 24,
                top: 42,
                right: PANEL_WIDTH - 24,
                bottom: 64,
            },
            SECONDARY_TEXT,
            small_font,
            DT_LEFT,
        );
        if let Some(active) = summary.active.as_ref() {
            let active_color = color_ref(&active.category_color, MUTED_TEXT);
            let elapsed_ms = (chrono::Local::now().timestamp_millis() - active.start_time).max(0);
            draw_clock_icon(hdc, 31, 103, active_color);
            draw_text(
                hdc,
                "当前行为",
                RECT {
                    left: 72,
                    top: 82,
                    right: PANEL_WIDTH - 28,
                    bottom: 104,
                },
                SECONDARY_TEXT,
                body_font,
                DT_LEFT,
            );
            draw_text(
                hdc,
                &active.label,
                RECT {
                    left: 72,
                    top: 103,
                    right: PANEL_WIDTH - 28,
                    bottom: 132,
                },
                PRIMARY_TEXT,
                value_font,
                DT_LEFT,
            );
            draw_text(
                hdc,
                &format!(
                    "{} · 已进行 {}",
                    active.category_name,
                    format_duration(elapsed_ms)
                ),
                RECT {
                    left: 72,
                    top: 136,
                    right: PANEL_WIDTH - 28,
                    bottom: 157,
                },
                active_color,
                small_font,
                DT_LEFT,
            );
        } else {
            draw_clock_icon(hdc, 31, 103, MUTED_TEXT);
            draw_text(
                hdc,
                "当前没有执行行为",
                RECT {
                    left: 72,
                    top: 96,
                    right: PANEL_WIDTH - 28,
                    bottom: 126,
                },
                PRIMARY_TEXT,
                value_font,
                DT_LEFT,
            );
            draw_text(
                hdc,
                "打开主窗口开始计时",
                RECT {
                    left: 72,
                    top: 132,
                    right: PANEL_WIDTH - 28,
                    bottom: 153,
                },
                SECONDARY_TEXT,
                small_font,
                DT_LEFT,
            );
        }

        draw_text(
            hdc,
            "分类明细",
            RECT {
                left: 24,
                top: DETAIL_TITLE_TOP,
                right: PANEL_WIDTH - 24,
                bottom: DETAIL_TITLE_TOP + 24,
            },
            SECONDARY_TEXT,
            small_font,
            DT_LEFT,
        );

        if categories.is_empty() {
            draw_text(
                hdc,
                "今天还没有记录",
                RECT {
                    left: 24,
                    top: DETAIL_TITLE_TOP + 32,
                    right: PANEL_WIDTH - 24,
                    bottom: DETAIL_TITLE_TOP + 70,
                },
                MUTED_TEXT,
                body_font,
                DT_LEFT,
            );
        } else {
            let row_start = CATEGORY_ROW_START;
            let max_total = summary
                .categories
                .iter()
                .map(|category| category.total_ms)
                .max()
                .unwrap_or(1)
                .max(1);

            for (index, category) in categories.iter().enumerate() {
                let row_top = row_start + index as i32 * 42;
                draw_round_rect(hdc, 18, row_top, PANEL_WIDTH - 18, row_top + 36, ROW_BG, 10);
                draw_round_rect(
                    hdc,
                    30,
                    row_top + 13,
                    44,
                    row_top + 23,
                    color_ref(&category.color, ACCENT),
                    5,
                );
                draw_text(
                    hdc,
                    &category.name,
                    RECT {
                        left: 54,
                        top: row_top + 4,
                        right: 236,
                        bottom: row_top + 25,
                    },
                    PRIMARY_TEXT,
                    body_font,
                    DT_LEFT,
                );
                draw_text(
                    hdc,
                    &format_duration(category.total_ms),
                    RECT {
                        left: 236,
                        top: row_top + 4,
                        right: PANEL_WIDTH - 28,
                        bottom: row_top + 25,
                    },
                    SECONDARY_TEXT,
                    small_font,
                    DT_RIGHT,
                );

                let track_width = 278_i32;
                let progress_width = ((category.total_ms.max(0) * track_width as i64) / max_total)
                    .clamp(5, track_width as i64) as i32;
                draw_round_rect(
                    hdc,
                    54,
                    row_top + 28,
                    54 + track_width,
                    row_top + 31,
                    TRACK_BG,
                    2,
                );
                draw_round_rect(
                    hdc,
                    54,
                    row_top + 28,
                    54 + progress_width,
                    row_top + 31,
                    color_ref(&category.color, ACCENT),
                    2,
                );
            }
        }

        let footer_top = height - 58;
        draw_separator(hdc, footer_top - 1);
        draw_round_rect(
            hdc,
            18,
            footer_top + 10,
            PANEL_WIDTH / 2 - 7,
            height - 10,
            CARD_BG,
            9,
        );
        draw_round_rect(
            hdc,
            PANEL_WIDTH / 2 + 7,
            footer_top + 10,
            PANEL_WIDTH - 18,
            height - 10,
            BG,
            9,
        );
        draw_text(
            hdc,
            "打开主窗口",
            RECT {
                left: 18,
                top: footer_top + 10,
                right: PANEL_WIDTH / 2 - 7,
                bottom: height - 10,
            },
            PRIMARY_TEXT,
            button_font,
            DT_CENTER,
        );
        draw_text(
            hdc,
            "退出",
            RECT {
                left: PANEL_WIDTH / 2 + 7,
                top: footer_top + 10,
                right: PANEL_WIDTH - 18,
                bottom: height - 10,
            },
            DANGER,
            button_font,
            DT_CENTER,
        );

        let _ = DeleteObject(title_font);
        let _ = DeleteObject(body_font);
        let _ = DeleteObject(value_font);
        let _ = DeleteObject(small_font);
        let _ = DeleteObject(button_font);
        let _ = EndPaint(hwnd, &paint_struct);
    }

    fn display_categories(summary: &TraySummary) -> Vec<CategorySummary> {
        let mut categories = summary
            .categories
            .iter()
            .take(MAX_CATEGORY_ROWS)
            .cloned()
            .collect::<Vec<_>>();

        if summary.categories.len() > MAX_CATEGORY_ROWS {
            let extra_duration = summary
                .categories
                .iter()
                .skip(MAX_CATEGORY_ROWS)
                .map(|category| category.total_ms)
                .sum();
            categories.push(CategorySummary {
                name: format!("其他 {} 类", summary.categories.len() - MAX_CATEGORY_ROWS),
                color: "#64748B".to_string(),
                total_ms: extra_duration,
            });
        }

        categories
    }

    fn panel_height(row_count: usize) -> i32 {
        262 + row_count.max(1) as i32 * 42
    }

    fn format_duration(duration_ms: i64) -> String {
        let total_seconds = duration_ms.max(0) / 1000;
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;
        format!("{hours:02}:{minutes:02}:{seconds:02}")
    }

    fn color_ref(value: &str, fallback: COLORREF) -> COLORREF {
        let value = value.trim().trim_start_matches('#');
        if value.len() != 6 {
            return fallback;
        }

        match u32::from_str_radix(value, 16) {
            Ok(rgb) => {
                COLORREF(((rgb & 0x0000ff) << 16) | (rgb & 0x00ff00) | ((rgb >> 16) & 0x0000ff))
            }
            Err(_) => fallback,
        }
    }

    unsafe fn fill_rect(hdc: windows::Win32::Graphics::Gdi::HDC, rect: RECT, color: COLORREF) {
        let brush = CreateSolidBrush(color);
        FillRect(hdc, &rect, brush);
        let _ = DeleteObject(brush);
    }

    unsafe fn draw_round_rect(
        hdc: windows::Win32::Graphics::Gdi::HDC,
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
        color: COLORREF,
        radius: i32,
    ) {
        let brush = CreateSolidBrush(color);
        let old_brush = SelectObject(hdc, brush);
        let old_pen = SelectObject(hdc, GetStockObject(NULL_PEN));
        let _ = RoundRect(hdc, left, top, right, bottom, radius, radius);
        SelectObject(hdc, old_pen);
        SelectObject(hdc, old_brush);
        let _ = DeleteObject(brush);
    }

    unsafe fn draw_separator(hdc: windows::Win32::Graphics::Gdi::HDC, y: i32) {
        let separator = CreateSolidBrush(TRACK_BG);
        let rect = RECT {
            left: 24,
            top: y,
            right: PANEL_WIDTH - 24,
            bottom: y + 1,
        };
        FillRect(hdc, &rect, separator);
        let _ = DeleteObject(separator);
    }

    unsafe fn draw_clock_icon(
        hdc: windows::Win32::Graphics::Gdi::HDC,
        left: i32,
        top: i32,
        color: COLORREF,
    ) {
        let pen = CreatePen(PS_SOLID, 2, color);
        let old_pen = SelectObject(hdc, pen);
        let old_brush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
        let _ = Ellipse(hdc, left, top, left + 30, top + 30);
        let _ = MoveToEx(hdc, left + 15, top + 15, None);
        let _ = LineTo(hdc, left + 15, top + 7);
        let _ = MoveToEx(hdc, left + 15, top + 15, None);
        let _ = LineTo(hdc, left + 22, top + 19);
        SelectObject(hdc, old_brush);
        SelectObject(hdc, old_pen);
        let _ = DeleteObject(pen);
    }

    unsafe fn draw_text(
        hdc: windows::Win32::Graphics::Gdi::HDC,
        text: &str,
        mut rect: RECT,
        color: COLORREF,
        font: windows::Win32::Graphics::Gdi::HFONT,
        alignment: windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT,
    ) {
        let mut wide = text.encode_utf16().collect::<Vec<_>>();
        let old_font = SelectObject(hdc, font);
        let old_color = SetTextColor(hdc, color);
        SetBkMode(hdc, TRANSPARENT);
        let flags = windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT(
            DT_SINGLELINE.0 | DT_VCENTER.0 | DT_NOPREFIX.0 | DT_END_ELLIPSIS.0 | alignment.0,
        );
        DrawTextW(hdc, &mut wide, &mut rect, flags);
        SetTextColor(hdc, old_color);
        SelectObject(hdc, old_font);
    }

    unsafe fn create_font(height: i32, weight: i32) -> windows::Win32::Graphics::Gdi::HFONT {
        CreateFontW(
            -height,
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET.0 as u32,
            OUT_DEFAULT_PRECIS.0 as u32,
            CLIP_DEFAULT_PRECIS.0 as u32,
            CLEARTYPE_QUALITY.0 as u32,
            DEFAULT_PITCH.0 as u32 | FF_SWISS.0 as u32,
            w!("Microsoft YaHei UI"),
        )
    }

    pub(super) fn update_tray_icon(app: &AppHandle) -> Result<(), String> {
        let summary = tray_summary::snapshot();
        let desired_state = summary
            .active
            .as_ref()
            .map(|active| parse_rgb(&active.category_color, UNCATEGORIZED_RGB));
        let icon_state = LAST_ICON_STATE.get_or_init(|| Mutex::new(None));
        let mut last_state = icon_state
            .lock()
            .map_err(|error| format!("failed to lock tray icon state: {error}"))?;

        if *last_state == desired_state {
            return Ok(());
        }

        let tray = app
            .tray_by_id(TRAY_ID)
            .ok_or_else(|| "main tray icon is not available".to_string())?;

        if let Some(rgb) = desired_state {
            tray.set_icon(Some(build_tray_icon(rgb)))
                .map_err(|error| format!("failed to update active tray icon: {error}"))?;
        } else if let Some(icon) = app.default_window_icon().cloned() {
            tray.set_icon(Some(icon))
                .map_err(|error| format!("failed to restore default tray icon: {error}"))?;
        }

        *last_state = desired_state;
        Ok(())
    }

    pub(super) fn invalidate_panel() {
        let current = PANEL_HWND.load(Ordering::Acquire);
        if current == 0 {
            return;
        }

        unsafe {
            let _ = InvalidateRect(HWND(current as _), None, BOOL(0));
        }
    }

    pub(super) fn parse_rgb(value: &str, fallback: (u8, u8, u8)) -> (u8, u8, u8) {
        let value = value.trim().trim_start_matches('#');
        if value.len() != 6 {
            return fallback;
        }

        match u32::from_str_radix(value, 16) {
            Ok(rgb) => (
                ((rgb >> 16) & 0xff) as u8,
                ((rgb >> 8) & 0xff) as u8,
                (rgb & 0xff) as u8,
            ),
            Err(_) => fallback,
        }
    }

    pub(super) fn build_tray_icon((red, green, blue): (u8, u8, u8)) -> Image<'static> {
        let size = ICON_SIZE as usize;
        let mut pixels = vec![0_u8; size * size * 4];
        let center = (ICON_SIZE as f32 - 1.0) / 2.0;
        let ring_radius = 11.5_f32;

        for y in 0..size {
            for x in 0..size {
                let dx = x as f32 - center;
                let dy = y as f32 - center;
                let distance = (dx * dx + dy * dy).sqrt();
                let edge_distance = (distance - ring_radius).abs();
                let alpha = ((1.8 - edge_distance).clamp(0.0, 1.0) * 255.0) as u8;
                if alpha > 0 {
                    set_icon_pixel(&mut pixels, size, x, y, (red, green, blue), alpha);
                }
            }
        }

        draw_icon_line(
            &mut pixels,
            size,
            (center, center),
            (center, center - 7.0),
            2.0,
            (246, 248, 251),
        );
        draw_icon_line(
            &mut pixels,
            size,
            (center, center),
            (center + 6.0, center + 4.0),
            2.0,
            (246, 248, 251),
        );

        Image::new_owned(pixels, ICON_SIZE, ICON_SIZE)
    }

    fn draw_icon_line(
        pixels: &mut [u8],
        size: usize,
        (start_x, start_y): (f32, f32),
        (end_x, end_y): (f32, f32),
        width: f32,
        color: (u8, u8, u8),
    ) {
        for y in 0..size {
            for x in 0..size {
                let distance =
                    distance_to_segment(x as f32, y as f32, start_x, start_y, end_x, end_y);
                let alpha = (((width / 2.0 + 0.8) - distance).clamp(0.0, 1.0) * 255.0) as u8;
                if alpha > 0 {
                    set_icon_pixel(pixels, size, x, y, color, alpha);
                }
            }
        }
    }

    fn distance_to_segment(
        point_x: f32,
        point_y: f32,
        start_x: f32,
        start_y: f32,
        end_x: f32,
        end_y: f32,
    ) -> f32 {
        let delta_x = end_x - start_x;
        let delta_y = end_y - start_y;
        let length_squared = delta_x * delta_x + delta_y * delta_y;
        if length_squared == 0.0 {
            return ((point_x - start_x).powi(2) + (point_y - start_y).powi(2)).sqrt();
        }

        let projection = (((point_x - start_x) * delta_x + (point_y - start_y) * delta_y)
            / length_squared)
            .clamp(0.0, 1.0);
        let closest_x = start_x + projection * delta_x;
        let closest_y = start_y + projection * delta_y;
        ((point_x - closest_x).powi(2) + (point_y - closest_y).powi(2)).sqrt()
    }

    fn set_icon_pixel(
        pixels: &mut [u8],
        size: usize,
        x: usize,
        y: usize,
        (red, green, blue): (u8, u8, u8),
        alpha: u8,
    ) {
        let index = (y * size + x) * 4;
        if alpha >= pixels[index + 3] {
            pixels[index] = red;
            pixels[index + 1] = green;
            pixels[index + 2] = blue;
            pixels[index + 3] = alpha;
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn native_tray_panel_window_can_be_created_without_a_webview() {
        let hwnd = super::windows_panel::ensure_window()
            .expect("the native tray panel window should be created");
        assert!(!hwnd.is_invalid());
    }

    #[test]
    fn native_tray_panel_can_be_shown_and_hidden() {
        let hwnd = super::windows_panel::ensure_window()
            .expect("the native tray panel window should be created");
        super::windows_panel::show_window(hwnd, 120, 120)
            .expect("the native tray panel should be positioned and shown");

        unsafe {
            assert!(windows::Win32::UI::WindowsAndMessaging::IsWindowVisible(hwnd).as_bool());
            let _ = windows::Win32::UI::WindowsAndMessaging::ShowWindow(
                hwnd,
                windows::Win32::UI::WindowsAndMessaging::SW_HIDE,
            );
        }
    }

    #[test]
    fn active_tray_icon_contains_the_requested_category_color() {
        let icon = super::windows_panel::build_tray_icon((255, 0, 0));
        assert_eq!(icon.width(), 32);
        assert_eq!(icon.height(), 32);
        assert!(icon
            .rgba()
            .chunks_exact(4)
            .any(|pixel| pixel[0] == 255 && pixel[1] == 0 && pixel[2] == 0 && pixel[3] > 0));
    }

    #[test]
    fn category_color_parser_falls_back_for_invalid_values() {
        assert_eq!(
            super::windows_panel::parse_rgb("#12aBc3", (1, 2, 3)),
            (0x12, 0xab, 0xc3)
        );
        assert_eq!(
            super::windows_panel::parse_rgb("not-a-color", (1, 2, 3)),
            (1, 2, 3)
        );
    }
}

pub fn initialize(app: AppHandle) {
    #[cfg(windows)]
    windows_panel::initialize(app);
    #[cfg(not(windows))]
    let _ = app;
}

#[tauri::command]
pub async fn sync_active_timer(app: AppHandle, entry_id: Option<i64>) -> Result<(), String> {
    crate::data::tray_summary::set_active_timer(entry_id)?;

    #[cfg(windows)]
    {
        windows_panel::update_tray_icon(&app)?;
        windows_panel::invalidate_panel();
    }

    #[cfg(not(windows))]
    let _ = app;

    Ok(())
}

pub fn show(app: &AppHandle, x: i32, y: i32) {
    #[cfg(windows)]
    windows_panel::show(app, x, y);
    #[cfg(not(windows))]
    {
        let _ = (app, x, y);
    }
}
