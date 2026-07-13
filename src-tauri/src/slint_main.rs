// Native Slint frontend. The former Tauri/React UI remains available only as a
// temporary compatibility target while release packaging is migrated.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Datelike, Local, TimeZone};
use digital_diary::{app_runtime, data, types};
use slint::{
    platform::WindowEvent, Brush, Color, Image, ModelRc, SharedString, Timer, TimerMode, VecModel,
};
use std::fs;
use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    path::PathBuf,
    process::Command,
    rc::Rc,
    time::Duration,
};

#[derive(serde::Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
}

slint::include_modules!();

#[derive(Debug, Clone)]
struct RunningTimer {
    entry_id: i64,
    start_time: i64,
    label: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    data::init_database().map_err(|err| format!("数据库初始化失败: {err}"))?;
    app_runtime::start_background_tasks();

    let ui = AppWindow::new()?;
    let selected_day = Rc::new(std::cell::Cell::new(start_of_today_millis()));
    let running_timer: Rc<RefCell<Option<RunningTimer>>> = Rc::new(RefCell::new(None));
    let editing_entry_id: Rc<Cell<Option<i64>>> = Rc::new(Cell::new(None));
    let pending_entry_range: Rc<Cell<Option<(i64, i64)>>> = Rc::new(Cell::new(None));
    let tick_timer = Rc::new(Timer::default());
    let refresh_timer = Timer::default();
    let preview_screenshot_path: Rc<RefCell<Option<PathBuf>>> = Rc::new(RefCell::new(None));
    let preferences = app_runtime::load_ui_preferences();
    let base_scale_factor = ui.window().scale_factor();
    let ui_scale = Rc::new(Cell::new(preferences.ui_scale.clamp(0.75, 1.5)));
    ui.window().dispatch_event(WindowEvent::ScaleFactorChanged {
        scale_factor: base_scale_factor * ui_scale.get(),
    });
    let timeline_visible_hours =
        Rc::new(Cell::new(preferences.timeline_visible_hours.clamp(2, 24)));
    let timeline_view_start = Rc::new(Cell::new(0.0_f32));
    let saved_searches = Rc::new(RefCell::new(preferences.saved_searches));
    ui.set_timeline_visible_hours(timeline_visible_hours.get());
    ui.set_saved_searches(shared_string_model(saved_searches.borrow().clone()));

    {
        let ui_weak = ui.as_weak();
        ui.on_cycle_new_category(move || {
            if let Some(ui) = ui_weak.upgrade() {
                let categories =
                    data::with_db(data::categories::get_categories_impl).unwrap_or_default();
                let current = ui.get_new_category_id() as i64;
                let next = if current < 0 {
                    categories.first()
                } else {
                    categories
                        .iter()
                        .position(|category| category.id == current)
                        .and_then(|index| categories.get(index + 1))
                };
                if let Some(category) = next {
                    ui.set_new_category_id(category.id as i32);
                    ui.set_new_category_label(category.name.clone().into());
                } else {
                    ui.set_new_category_id(-1);
                    ui.set_new_category_label("分类".into());
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let ui_scale = Rc::clone(&ui_scale);
        ui.on_ui_zoom(move |delta| {
            let direction = if delta > 0.0 { 0.05 } else { -0.05 };
            let next = (ui_scale.get() + direction).clamp(0.75, 1.5);
            ui_scale.set(next);
            let _ = app_runtime::save_ui_scale(next);
            if let Some(ui) = ui_weak.upgrade() {
                ui.window().dispatch_event(WindowEvent::ScaleFactorChanged {
                    scale_factor: base_scale_factor * next,
                });
                ui.set_status_text(format!("界面缩放 {}%", (next * 100.0).round()).into());
            }
        });
    }

    if let Ok(Some(saved)) = app_runtime::load_running_timer() {
        let entry_exists = data::with_db(|conn| {
            data::time_entries::get_time_entries_by_range_impl(
                conn,
                saved.start_time,
                chrono::Utc::now().timestamp_millis() + 1,
            )
        })
        .map(|entries| entries.iter().any(|entry| entry.id == saved.entry_id))
        .unwrap_or(false);
        if entry_exists {
            *running_timer.borrow_mut() = Some(RunningTimer {
                entry_id: saved.entry_id,
                start_time: saved.start_time,
                label: saved.label,
            });
        } else {
            let _ = app_runtime::save_running_timer(None);
        }
    }

    refresh_all(&ui, selected_day.get());
    update_running_ui(&ui, &running_timer.borrow());
    if running_timer.borrow().is_some() {
        start_tick_timer(
            &tick_timer,
            ui.as_weak(),
            Rc::clone(&selected_day),
            Rc::clone(&running_timer),
        );
    }
    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        refresh_timer.start(TimerMode::Repeated, Duration::from_secs(15), move || {
            if let Some(ui) = ui_weak.upgrade() {
                refresh_all(&ui, selected_day.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_check_update(move || {
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_status_text("正在检查更新…".into());
            }
            let ui_weak = ui_weak.clone();
            std::thread::spawn(move || {
                let result = reqwest::blocking::Client::new()
                    .get("https://api.github.com/repos/roshad/Ro-s-ChronoTrace/releases/latest")
                    .header(reqwest::header::USER_AGENT, "RosChronoTrace-Slint")
                    .send()
                    .and_then(|response| response.error_for_status())
                    .and_then(|response| response.json::<GithubRelease>())
                    .map_err(|err| format!("检查更新失败: {err}"));
                let _ = ui_weak.upgrade_in_event_loop(move |ui| match result {
                    Ok(release) => {
                        let latest = release.tag_name.trim_start_matches('v');
                        let current = env!("CARGO_PKG_VERSION");
                        if version_is_newer(latest, current) {
                            ui.set_status_text(
                                format!("发现新版本 {latest}，正在打开下载页面…").into(),
                            );
                            let _ = Command::new("explorer.exe").arg(release.html_url).spawn();
                        } else {
                            ui.set_status_text(format!("当前已是最新版本 {current}。").into());
                        }
                    }
                    Err(err) => ui.set_status_text(err.into()),
                });
            });
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_open_screenshot_folder(move || {
            let result = digital_diary::app_settings::load_screenshot_settings()
                .and_then(|settings| {
                    digital_diary::app_settings::resolve_screenshot_storage_dir(
                        settings.storage_dir,
                    )
                })
                .and_then(|path| {
                    fs::create_dir_all(&path).map_err(|err| format!("创建截图目录失败: {err}"))?;
                    Command::new("explorer.exe")
                        .arg(path)
                        .spawn()
                        .map(|_| ())
                        .map_err(|err| format!("打开截图目录失败: {err}"))
                });
            if let (Err(err), Some(ui)) = (result, ui_weak.upgrade()) {
                ui.set_status_text(err.into());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let visible_hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        let running_timer = Rc::clone(&running_timer);
        ui.on_resize_entry(move |id, position, is_start| {
            let viewport = visible_hours.get() as f32 / 24.0;
            let timestamp = selected_day.get()
                + ((view_start.get() + position.clamp(0.0, 1.0) * viewport)
                    * millis_per_day() as f32) as i64;
            let entry = data::with_db(|conn| {
                data::time_entries::get_time_entries_impl(conn, selected_day.get())
            })
            .ok()
            .and_then(|entries| entries.into_iter().find(|entry| entry.id == id as i64));
            let Some(entry) = entry else {
                return;
            };
            let (start_time, end_time) = if is_start {
                (timestamp.min(entry.end_time - 1_000), entry.end_time)
            } else {
                (entry.start_time, timestamp.max(entry.start_time + 1_000))
            };
            let result = data::with_db(|conn| {
                data::time_entries::update_time_entry_impl(
                    conn,
                    entry.id,
                    &types::TimeEntryUpdate {
                        start_time: Some(start_time),
                        end_time: Some(end_time),
                        label: None,
                        color: None,
                        category_id: None,
                    },
                )
            });
            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(_) => {
                        if is_start {
                            let changed = {
                                let mut active = running_timer.borrow_mut();
                                if let Some(active) = active.as_mut() {
                                    if active.entry_id == entry.id {
                                        active.start_time = start_time;
                                        true
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                }
                            };
                            if changed {
                                persist_running_timer(&running_timer.borrow());
                            }
                        }
                        refresh_all(&ui, selected_day.get());
                    }
                    Err(err) => ui.set_status_text(format!("调整范围失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let visible_hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        let last_hover_bucket = Rc::new(Cell::new(i64::MIN));
        ui.on_timeline_hover(move |position| {
            let viewport = visible_hours.get() as f32 / 24.0;
            let timestamp = selected_day.get()
                + ((view_start.get() + position.clamp(0.0, 1.0) * viewport)
                    * millis_per_day() as f32) as i64;
            let bucket = timestamp / 10_000;
            if bucket == last_hover_bucket.get() {
                return;
            }
            last_hover_bucket.set(bucket);
            let text = build_hover_text(timestamp, selected_day.get());
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_timeline_hover_text(text.into());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let visible_hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        let editing_entry_id = Rc::clone(&editing_entry_id);
        let pending_range = Rc::clone(&pending_entry_range);
        ui.on_create_range(move |start_fraction, end_fraction| {
            let viewport = visible_hours.get() as f32 / 24.0;
            let start = selected_day.get()
                + ((view_start.get() + start_fraction * viewport) * millis_per_day() as f32) as i64;
            let mut end = selected_day.get()
                + ((view_start.get() + end_fraction * viewport) * millis_per_day() as f32) as i64;
            if end - start < 1_000 {
                end = start + 60_000;
            }
            editing_entry_id.set(None);
            pending_range.set(Some((start, end)));
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_edit_dialog_title("创建行为条目".into());
                ui.set_edit_label("".into());
                ui.set_edit_start_time(format_time(start).into());
                ui.set_edit_end_time(format_time(end).into());
                ui.set_edit_time_range(
                    format!("{} - {}", format_time(start), format_time(end)).into(),
                );
                ui.set_edit_duration(format_duration(end - start).into());
                ui.set_edit_category_id(-1);
                ui.set_edit_error("".into());
                ui.set_show_edit(true);
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        ui.on_timeline_zoom_in(move || {
            let next = (hours.get() - 2).max(2);
            hours.set(next);
            let max_start = 1.0 - next as f32 / 24.0;
            view_start.set(view_start.get().min(max_start));
            let _ = app_runtime::save_timeline_visible_hours(next);
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_timeline_visible_hours(next);
                ui.set_timeline_view_start(view_start.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        ui.on_timeline_zoom_out(move || {
            let next = (hours.get() + 2).min(24);
            hours.set(next);
            let max_start = 1.0 - next as f32 / 24.0;
            view_start.set(view_start.get().min(max_start));
            let _ = app_runtime::save_timeline_visible_hours(next);
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_timeline_visible_hours(next);
                ui.set_timeline_view_start(view_start.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        ui.on_timeline_pan_left(move || {
            let step = hours.get() as f32 / 96.0;
            view_start.set((view_start.get() - step).max(0.0));
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_timeline_view_start(view_start.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let hours = Rc::clone(&timeline_visible_hours);
        let view_start = Rc::clone(&timeline_view_start);
        ui.on_timeline_pan_right(move || {
            let step = hours.get() as f32 / 96.0;
            let max_start = 1.0 - hours.get() as f32 / 24.0;
            view_start.set((view_start.get() + step).min(max_start));
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_timeline_view_start(view_start.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_previous_day(move || {
            selected_day.set(selected_day.get() - millis_per_day());
            if let Some(ui) = ui_weak.upgrade() {
                refresh_all(&ui, selected_day.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let preview_path = Rc::clone(&preview_screenshot_path);
        ui.on_preview_screenshot(move |fraction| {
            let timestamp =
                selected_day.get() + (fraction.clamp(0.0, 1.0) * millis_per_day() as f32) as i64;
            let stored =
                data::with_db(|conn| data::get_screenshot_near_time(conn, timestamp, 300_000));
            if let Some(ui) = ui_weak.upgrade() {
                match stored {
                    Ok(Some(stored_path)) => {
                        match digital_diary::app_settings::resolve_screenshot_file_path(
                            &stored_path,
                        ) {
                            Ok(path) => match Image::load_from_path(&path) {
                                Ok(image) => {
                                    *preview_path.borrow_mut() = Some(path);
                                    ui.set_screenshot_image(image);
                                    ui.set_screenshot_time(format_time(timestamp).into());
                                    ui.set_show_screenshot(true);
                                }
                                Err(err) => {
                                    ui.set_status_text(format!("截图读取失败: {err}").into())
                                }
                            },
                            Err(err) => ui.set_status_text(format!("截图路径无效: {err}").into()),
                        }
                    }
                    Ok(None) => ui.set_status_text("未找到对应截图。".into()),
                    Err(err) => ui.set_status_text(format!("截图查询失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let preview_path = Rc::clone(&preview_screenshot_path);
        ui.on_close_screenshot(move || {
            *preview_path.borrow_mut() = None;
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_show_screenshot(false);
                ui.set_screenshot_image(Image::default());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let preview_path = Rc::clone(&preview_screenshot_path);
        ui.on_open_screenshot(move || {
            if let Some(path) = preview_path.borrow().as_ref() {
                if let Err(err) = Command::new("explorer.exe").arg(path).spawn() {
                    if let Some(ui) = ui_weak.upgrade() {
                        ui.set_status_text(format!("打开截图失败: {err}").into());
                    }
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_search(move |query, scope| {
            let query = query.trim();
            if let Some(ui) = ui_weak.upgrade() {
                if query.chars().count() < 2 {
                    ui.set_search_results(ModelRc::new(VecModel::from(Vec::new())));
                    ui.set_search_summary("请输入至少两个字符。".into());
                    return;
                }
                let (range_start, range_end, range_label) = search_range(selected_day.get(), scope);
                let normalized_query = query.to_lowercase();
                let matched_duration = data::with_db(|conn| {
                    data::time_entries::get_time_entries_by_range_impl(conn, range_start, range_end)
                })
                .unwrap_or_default()
                .into_iter()
                .filter(|entry| entry.label.to_lowercase().contains(&normalized_query))
                .map(|entry| {
                    (entry.end_time.min(range_end) - entry.start_time.max(range_start)).max(0)
                })
                .sum::<i64>();
                match data::with_db(|conn| {
                    data::search::search_activities_by_date_impl(
                        conn,
                        query,
                        range_start,
                        range_end,
                    )
                }) {
                    Ok(results) => {
                        let count = results.len();
                        let rows = results
                            .into_iter()
                            .map(|result| SearchResultRow {
                                title: result.title.into(),
                                detail: format!(
                                    "{} · {}{}",
                                    format_time(result.timestamp),
                                    if result.r#type == "time_entry" {
                                        "行为"
                                    } else {
                                        "窗口"
                                    },
                                    result
                                        .process_name
                                        .map(|name| format!(" · {name}"))
                                        .unwrap_or_default()
                                )
                                .into(),
                            })
                            .collect::<Vec<_>>();
                        ui.set_search_results(ModelRc::new(VecModel::from(rows)));
                        ui.set_search_summary(
                            format!(
                                "{range_label}命中 {count} 条结果 · 行为总时长 {}",
                                format_duration(matched_duration)
                            )
                            .into(),
                        );
                    }
                    Err(err) => ui.set_search_summary(format!("搜索失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let saved_searches = Rc::clone(&saved_searches);
        ui.on_save_search(move |query| {
            let query = query.trim().to_owned();
            if query.chars().count() < 2 {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_search_summary("至少输入两个字符后再保存。".into());
                }
                return;
            }
            let searches = {
                let mut searches = saved_searches.borrow_mut();
                searches.retain(|item| item != &query);
                searches.insert(0, query);
                searches.truncate(8);
                searches.clone()
            };
            let result = app_runtime::save_saved_searches(searches.clone());
            if let Some(ui) = ui_weak.upgrade() {
                if let Err(err) = result {
                    ui.set_search_summary(format!("保存搜索失败: {err}").into());
                } else {
                    ui.set_saved_searches(shared_string_model(searches));
                    ui.set_search_summary("搜索项目已保存。".into());
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_export_json(move || {
            let result = data::with_db(data::export::export_data_impl).and_then(|export| {
                let json = serde_json::to_string_pretty(&export)
                    .map_err(|e| format!("序列化失败: {e}"))?;
                let base = dirs::download_dir()
                    .or_else(dirs::document_dir)
                    .ok_or_else(|| "无法确定导出目录".to_owned())?;
                let path = base.join(format!(
                    "ros-chronotrace-{}.json",
                    Local::now().format("%Y%m%d-%H%M%S")
                ));
                fs::write(&path, json).map_err(|e| format!("写入失败: {e}"))?;
                Ok(path)
            });
            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(path) => ui.set_status_text(format!("已导出到 {}", path.display()).into()),
                    Err(err) => ui.set_status_text(format!("导出失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_open_settings(move || {
            if let Some(ui) = ui_weak.upgrade() {
                match digital_diary::app_settings::load_screenshot_settings() {
                    Ok(settings) => {
                        ui.set_settings_quality(settings.quality.to_string().into());
                        ui.set_settings_width(settings.max_width.to_string().into());
                        ui.set_settings_max_kb(settings.max_file_kb.to_string().into());
                        ui.set_settings_storage(settings.storage_dir.unwrap_or_default().into());
                        ui.set_settings_error("".into());
                        ui.set_show_settings(true);
                    }
                    Err(err) => ui.set_status_text(format!("读取设置失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_save_settings(move |quality, width, max_kb, storage| {
            if let Some(ui) = ui_weak.upgrade() {
                let parsed = quality
                    .trim()
                    .parse::<u8>()
                    .ok()
                    .zip(width.trim().parse::<u32>().ok())
                    .zip(max_kb.trim().parse::<u32>().ok());
                let Some(((quality, max_width), max_file_kb)) = parsed else {
                    ui.set_settings_error("质量、宽度和文件大小必须是整数。".into());
                    return;
                };
                let settings = digital_diary::app_settings::ScreenshotSettings {
                    quality,
                    max_width,
                    max_file_kb,
                    storage_dir: if storage.trim().is_empty() {
                        None
                    } else {
                        Some(storage.trim().to_owned())
                    },
                };
                match digital_diary::app_settings::save_screenshot_settings(settings) {
                    Ok(_) => {
                        ui.set_show_settings(false);
                        ui.set_status_text("截图设置已保存。".into());
                    }
                    Err(err) => ui.set_settings_error(format!("保存失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_close_settings(move || {
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_show_settings(false);
                ui.set_settings_error("".into());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        ui.on_begin_edit_category(move |id, name, color| {
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_editing_category_id(id);
                ui.set_category_name(name);
                ui.set_category_color(color);
                ui.set_settings_error("".into());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_save_category(move |id, name, color| {
            let input = types::CategoryInput {
                name: name.trim().to_owned(),
                color: color.trim().to_owned(),
            };
            if input.name.is_empty() || !is_valid_hex_color(&input.color) {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_settings_error("类别名称不能为空，颜色格式应为 #RRGGBB。".into());
                }
                return;
            }
            let result = data::with_db(|conn| {
                if id < 0 {
                    data::categories::create_category_impl(conn, &input).map(|_| ())
                } else {
                    data::categories::update_category_impl(conn, id as i64, &input).map(|_| ())
                }
            });
            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(()) => {
                        ui.set_editing_category_id(-1);
                        ui.set_category_name("".into());
                        ui.set_category_color("#14b8a6".into());
                        ui.set_settings_error("".into());
                        refresh_all(&ui, selected_day.get());
                    }
                    Err(err) => ui.set_settings_error(format!("保存类别失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_delete_category(move |id| {
            let result =
                data::with_db(|conn| data::categories::delete_category_impl(conn, id as i64));
            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(()) => {
                        ui.set_editing_category_id(-1);
                        ui.set_category_name("".into());
                        ui.set_category_color("#14b8a6".into());
                        refresh_all(&ui, selected_day.get());
                    }
                    Err(err) => ui.set_settings_error(format!("删除类别失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_next_day(move || {
            selected_day.set(selected_day.get() + millis_per_day());
            if let Some(ui) = ui_weak.upgrade() {
                refresh_all(&ui, selected_day.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_today(move || {
            selected_day.set(start_of_today_millis());
            if let Some(ui) = ui_weak.upgrade() {
                refresh_all(&ui, selected_day.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        ui.on_refresh(move || {
            if let Some(ui) = ui_weak.upgrade() {
                refresh_all(&ui, selected_day.get());
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let running_timer = Rc::clone(&running_timer);
        let tick_timer = Rc::clone(&tick_timer);
        ui.on_start_entry(move |label, category_id| {
            let label = label.trim();
            if label.is_empty() {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_status_text("请输入行为名称。".into());
                }
                return;
            }

            if running_timer.borrow().is_some() {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_status_text("已有行为正在计时，请先停止。".into());
                }
                return;
            }

            let now = chrono::Utc::now().timestamp_millis();
            let selected_category = if category_id < 0 {
                None
            } else {
                Some(category_id as i64)
            };
            let color = selected_category.and_then(|id| {
                data::with_db(data::categories::get_categories_impl)
                    .ok()
                    .and_then(|categories| {
                        categories.into_iter().find(|category| category.id == id)
                    })
                    .map(|category| category.color)
            });
            let entry = types::TimeEntryInput {
                start_time: now,
                end_time: now + 1000,
                label: label.to_owned(),
                color: color.or_else(|| Some("#14b8a6".to_owned())),
                category_id: selected_category,
            };

            let result =
                data::with_db(|conn| data::time_entries::create_time_entry_impl(conn, &entry));

            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(created) => {
                        *running_timer.borrow_mut() = Some(RunningTimer {
                            entry_id: created.id,
                            start_time: created.start_time,
                            label: created.label,
                        });
                        persist_running_timer(&running_timer.borrow());
                        update_running_ui(&ui, &running_timer.borrow());
                        refresh_all(&ui, selected_day.get());
                        start_tick_timer(
                            &tick_timer,
                            ui.as_weak(),
                            Rc::clone(&selected_day),
                            Rc::clone(&running_timer),
                        );
                    }
                    Err(err) => ui.set_status_text(format!("创建失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let running_timer = Rc::clone(&running_timer);
        let tick_timer = Rc::clone(&tick_timer);
        ui.on_stop_entry(move || {
            let active = running_timer.borrow_mut().take();
            tick_timer.stop();
            let _ = app_runtime::save_running_timer(None);
            if let Some(active) = active {
                let now = chrono::Utc::now().timestamp_millis();
                let result = data::with_db(|conn| {
                    data::time_entries::update_time_entry_impl(
                        conn,
                        active.entry_id,
                        &types::TimeEntryUpdate {
                            start_time: None,
                            end_time: Some(now),
                            label: None,
                            color: None,
                            category_id: None,
                        },
                    )
                });

                if let Some(ui) = ui_weak.upgrade() {
                    match result {
                        Ok(_) => ui.set_status_text("计时已停止。".into()),
                        Err(err) => ui.set_status_text(format!("停止失败: {err}").into()),
                    }
                    update_running_ui(&ui, &running_timer.borrow());
                    refresh_all(&ui, selected_day.get());
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let editing_entry_id = Rc::clone(&editing_entry_id);
        let pending_range = Rc::clone(&pending_entry_range);
        ui.on_edit_entry(move |id| {
            let id = id as i64;
            let entry = data::with_db(|conn| {
                data::time_entries::get_time_entries_impl(conn, selected_day.get())
            })
            .ok()
            .and_then(|entries| entries.into_iter().find(|entry| entry.id == id));

            if let Some(ui) = ui_weak.upgrade() {
                if let Some(entry) = entry {
                    editing_entry_id.set(Some(entry.id));
                    pending_range.set(None);
                    ui.set_edit_dialog_title("编辑行为条目".into());
                    ui.set_edit_label(entry.label.clone().into());
                    ui.set_edit_time_range(
                        format!(
                            "{} - {}",
                            format_time(entry.start_time),
                            format_time(entry.end_time)
                        )
                        .into(),
                    );
                    ui.set_edit_start_time(format_time(entry.start_time).into());
                    ui.set_edit_end_time(format_time(entry.end_time).into());
                    ui.set_edit_duration(
                        format_duration((entry.end_time - entry.start_time).max(0)).into(),
                    );
                    ui.set_edit_category_id(entry.category_id.map(|id| id as i32).unwrap_or(-1));
                    ui.set_edit_error("".into());
                    ui.set_show_edit(true);
                } else {
                    ui.set_status_text("条目不存在或已被删除。".into());
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let editing_entry_id = Rc::clone(&editing_entry_id);
        let running_timer = Rc::clone(&running_timer);
        let pending_range = Rc::clone(&pending_entry_range);
        ui.on_save_edit(move |label, start_text, end_text, category_id| {
            let label = label.trim().to_owned();
            if label.is_empty() {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_edit_error("行为标签不能为空。".into());
                }
                return;
            }

            let start_time = match parse_time_on_day(selected_day.get(), start_text.trim()) {
                Ok(value) => value,
                Err(err) => {
                    if let Some(ui) = ui_weak.upgrade() {
                        ui.set_edit_error(err.into());
                    }
                    return;
                }
            };
            let end_time = match parse_time_on_day(selected_day.get(), end_text.trim()) {
                Ok(value) => value,
                Err(err) => {
                    if let Some(ui) = ui_weak.upgrade() {
                        ui.set_edit_error(err.into());
                    }
                    return;
                }
            };
            if end_time <= start_time {
                if let Some(ui) = ui_weak.upgrade() {
                    ui.set_edit_error("结束时间必须晚于开始时间。".into());
                }
                return;
            }

            let result = data::with_db(|conn| {
                let color = if category_id < 0 {
                    Some("#14b8a6".to_owned())
                } else {
                    data::categories::get_categories_impl(conn)
                        .ok()
                        .and_then(|categories| {
                            categories
                                .into_iter()
                                .find(|category| category.id == category_id as i64)
                        })
                        .map(|category| category.color)
                };
                if let Some(id) = editing_entry_id.get() {
                    data::time_entries::update_time_entry_impl(
                        conn,
                        id,
                        &types::TimeEntryUpdate {
                            start_time: Some(start_time),
                            end_time: Some(end_time),
                            label: Some(label.clone()),
                            color,
                            category_id: Some(if category_id < 0 {
                                None
                            } else {
                                Some(category_id as i64)
                            }),
                        },
                    )
                    .map(|_| ())
                } else {
                    data::time_entries::create_time_entry_impl(
                        conn,
                        &types::TimeEntryInput {
                            start_time,
                            end_time,
                            label: label.clone(),
                            color,
                            category_id: if category_id < 0 {
                                None
                            } else {
                                Some(category_id as i64)
                            },
                        },
                    )
                    .map(|_| ())
                }
            });

            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(_) => {
                        let updated_running = if let Some(id) = editing_entry_id.get() {
                            {
                                let mut active = running_timer.borrow_mut();
                                if let Some(active) = active.as_mut() {
                                    if active.entry_id == id {
                                        active.label = label.clone();
                                        true
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                }
                            }
                        } else {
                            false
                        };
                        if updated_running {
                            persist_running_timer(&running_timer.borrow());
                            update_running_ui(&ui, &running_timer.borrow());
                        }
                        ui.set_show_edit(false);
                        editing_entry_id.set(None);
                        pending_range.set(None);
                        refresh_all(&ui, selected_day.get());
                    }
                    Err(err) => ui.set_edit_error(format!("保存失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let selected_day = Rc::clone(&selected_day);
        let editing_entry_id = Rc::clone(&editing_entry_id);
        let running_timer = Rc::clone(&running_timer);
        let tick_timer = Rc::clone(&tick_timer);
        ui.on_delete_edit(move || {
            let Some(id) = editing_entry_id.get() else {
                return;
            };

            let result = data::with_db(|conn| data::time_entries::delete_time_entry_impl(conn, id));
            if let Some(ui) = ui_weak.upgrade() {
                match result {
                    Ok(_) => {
                        if running_timer
                            .borrow()
                            .as_ref()
                            .is_some_and(|active| active.entry_id == id)
                        {
                            *running_timer.borrow_mut() = None;
                            tick_timer.stop();
                            let _ = app_runtime::save_running_timer(None);
                            update_running_ui(&ui, &running_timer.borrow());
                        }
                        ui.set_show_edit(false);
                        editing_entry_id.set(None);
                        refresh_all(&ui, selected_day.get());
                    }
                    Err(err) => ui.set_edit_error(format!("删除失败: {err}").into()),
                }
            }
        });
    }

    {
        let ui_weak = ui.as_weak();
        let editing_entry_id = Rc::clone(&editing_entry_id);
        let pending_range = Rc::clone(&pending_entry_range);
        ui.on_close_edit(move || {
            editing_entry_id.set(None);
            if let Some(ui) = ui_weak.upgrade() {
                ui.set_show_edit(false);
                ui.set_edit_error("".into());
                pending_range.set(None);
            }
        });
    }
    ui.run()?;
    Ok(())
}

fn persist_running_timer(active: &Option<RunningTimer>) {
    let persisted = active.as_ref().map(|timer| app_runtime::PersistedTimer {
        entry_id: timer.entry_id,
        start_time: timer.start_time,
        label: timer.label.clone(),
    });
    let _ = app_runtime::save_running_timer(persisted.as_ref());
}

fn shared_string_model(values: Vec<String>) -> ModelRc<SharedString> {
    ModelRc::new(VecModel::from(
        values
            .into_iter()
            .map(SharedString::from)
            .collect::<Vec<_>>(),
    ))
}

fn start_tick_timer(
    timer: &Timer,
    ui_weak: slint::Weak<AppWindow>,
    selected_day: Rc<Cell<i64>>,
    running_timer: Rc<RefCell<Option<RunningTimer>>>,
) {
    timer.start(TimerMode::Repeated, Duration::from_secs(1), move || {
        let Some(ui) = ui_weak.upgrade() else {
            return;
        };
        let Some(active) = running_timer.borrow().clone() else {
            return;
        };
        let now = chrono::Utc::now().timestamp_millis();
        let result = data::with_db(|conn| {
            data::time_entries::update_time_entry_impl(
                conn,
                active.entry_id,
                &types::TimeEntryUpdate {
                    start_time: None,
                    end_time: Some(now),
                    label: None,
                    color: None,
                    category_id: None,
                },
            )
        });
        if let Err(err) = result {
            *running_timer.borrow_mut() = None;
            let _ = app_runtime::save_running_timer(None);
            ui.set_status_text(format!("计时更新失败，已停止: {err}").into());
        }
        update_running_ui(&ui, &running_timer.borrow());
        refresh_all(&ui, selected_day.get());
    });
}

fn refresh_all(ui: &AppWindow, day_start: i64) {
    ui.set_current_date(format_day(day_start).into());

    let entries = data::with_db(|conn| data::time_entries::get_time_entries_impl(conn, day_start));
    let screenshots = data::with_db(|conn| {
        data::screenshot::get_screenshot_timestamps_for_day(
            conn,
            day_start,
            day_start + millis_per_day(),
        )
    });
    let samples = data::with_db(|conn| {
        data::process_samples::get_process_samples_for_day(
            conn,
            day_start,
            day_start + millis_per_day(),
        )
    });
    let categories = data::with_db(data::categories::get_categories_impl);
    let category_colors: HashMap<i64, String> = categories
        .as_ref()
        .map(|items| {
            items
                .iter()
                .map(|category| (category.id, category.color.clone()))
                .collect()
        })
        .unwrap_or_default();
    let total_entry_millis = entries
        .as_ref()
        .map(|items| {
            items
                .iter()
                .map(|entry| (entry.end_time - entry.start_time).max(0))
                .sum::<i64>()
        })
        .unwrap_or(0);
    let category_durations: HashMap<i64, i64> = entries
        .as_ref()
        .map(|items| {
            let mut durations = HashMap::new();
            for entry in items {
                if let Some(category_id) = entry.category_id {
                    *durations.entry(category_id).or_default() +=
                        (entry.end_time - entry.start_time).max(0);
                }
            }
            durations
        })
        .unwrap_or_default();

    match entries {
        Ok(entries) => {
            let count = entries.len();
            let total_millis: i64 = entries
                .iter()
                .map(|entry| (entry.end_time - entry.start_time).max(0))
                .sum();
            let rows = entries.iter().cloned().map(to_row).collect::<Vec<_>>();
            let blocks = entries
                .iter()
                .map(|entry| to_timeline_block(entry, day_start, &category_colors))
                .collect::<Vec<_>>();

            ui.set_entries(ModelRc::new(VecModel::from(rows)));
            ui.set_timeline_blocks(ModelRc::new(VecModel::from(blocks)));
            ui.set_entry_count(count.to_string().into());
            ui.set_total_duration(format_duration(total_millis).into());
            ui.set_status_text(
                format!("共 {count} 条，合计 {}", format_duration(total_millis)).into(),
            );
        }
        Err(err) => {
            ui.set_entries(ModelRc::new(VecModel::from(Vec::new())));
            ui.set_timeline_blocks(ModelRc::new(VecModel::from(Vec::new())));
            ui.set_entry_count("0".into());
            ui.set_total_duration("0秒".into());
            ui.set_status_text(format!("加载失败: {err}").into());
        }
    }

    match screenshots {
        Ok(timestamps) => {
            let markers = timestamps
                .iter()
                .map(|timestamp| TimelineMarker {
                    x: day_fraction(*timestamp, day_start),
                })
                .collect::<Vec<_>>();
            ui.set_screenshot_count(timestamps.len().to_string().into());
            ui.set_screenshot_markers(ModelRc::new(VecModel::from(markers)));
        }
        Err(_) => {
            ui.set_screenshot_count("0".into());
            ui.set_screenshot_markers(ModelRc::new(VecModel::from(Vec::new())));
        }
    }

    match samples {
        Ok(samples) => {
            let runs = process_samples_to_runs(&samples, day_start);
            ui.set_process_count(samples.len().to_string().into());
            ui.set_process_runs(ModelRc::new(VecModel::from(runs)));
        }
        Err(_) => {
            ui.set_process_count("0".into());
            ui.set_process_runs(ModelRc::new(VecModel::from(Vec::new())));
        }
    }

    match categories {
        Ok(categories) => {
            let chips = categories
                .into_iter()
                .map(|category| {
                    let duration = category_durations.get(&category.id).copied().unwrap_or(0);
                    let percentage = if total_entry_millis > 0 {
                        duration as f64 * 100.0 / total_entry_millis as f64
                    } else {
                        0.0
                    };
                    CategoryChip {
                        id: category.id as i32,
                        name: SharedString::from(category.name),
                        color: brush_from_hex(&category.color),
                        color_text: SharedString::from(category.color),
                        duration: format_duration(duration).into(),
                        percentage: format!("{percentage:.1}%").into(),
                        percentage_value: percentage as f32,
                    }
                })
                .collect::<Vec<_>>();
            ui.set_categories(ModelRc::new(VecModel::from(chips)));
        }
        Err(_) => ui.set_categories(ModelRc::new(VecModel::from(Vec::new()))),
    }
}

fn update_running_ui(ui: &AppWindow, active: &Option<RunningTimer>) {
    if let Some(active) = active {
        let now = chrono::Utc::now().timestamp_millis();
        ui.set_is_running(true);
        ui.set_active_label(active.label.clone().into());
        ui.set_active_elapsed(format_clock((now - active.start_time).max(0)).into());
    } else {
        ui.set_is_running(false);
        ui.set_active_label("未开始计时".into());
        ui.set_active_elapsed("00:00:00".into());
    }
}

fn to_row(entry: types::TimeEntry) -> TimeEntryRow {
    let duration = (entry.end_time - entry.start_time).max(0);

    TimeEntryRow {
        id: entry.id as i32,
        label: SharedString::from(entry.label),
        time_range: SharedString::from(format!(
            "{} - {}",
            format_time(entry.start_time),
            format_time(entry.end_time)
        )),
        duration: SharedString::from(format_duration(duration)),
    }
}

fn to_timeline_block(
    entry: &types::TimeEntry,
    day_start: i64,
    category_colors: &HashMap<i64, String>,
) -> TimelineBlock {
    let start = entry.start_time.max(day_start);
    let end = entry
        .end_time
        .min(day_start + millis_per_day())
        .max(start + 1);
    let width = ((end - start) as f32 / millis_per_day() as f32).max(0.0005);
    TimelineBlock {
        id: entry.id as i32,
        label: SharedString::from(entry.label.clone()),
        x: day_fraction(start, day_start),
        width,
        color: entry
            .category_id
            .and_then(|id| category_colors.get(&id).map(String::as_str))
            .or(entry.color.as_deref())
            .map(brush_from_hex)
            .unwrap_or_else(|| brush_from_hex("#14b8a6")),
    }
}

fn process_samples_to_runs(
    samples: &[types::ProcessSample],
    day_start: i64,
) -> Vec<ProcessRunBlock> {
    if samples.is_empty() {
        return Vec::new();
    }

    let mut runs = Vec::new();
    let mut current_name = samples[0].process_name.clone();
    let mut current_start = samples[0].timestamp;
    let mut previous_timestamp = samples[0].timestamp;

    for sample in samples.iter().skip(1) {
        let gap_too_large = sample.timestamp - previous_timestamp > 5000;
        if sample.process_name != current_name || gap_too_large {
            push_process_run(
                &mut runs,
                day_start,
                current_start,
                previous_timestamp + 1000,
                &current_name,
            );
            current_name = sample.process_name.clone();
            current_start = sample.timestamp;
        }
        previous_timestamp = sample.timestamp;
    }

    push_process_run(
        &mut runs,
        day_start,
        current_start,
        previous_timestamp + 1000,
        &current_name,
    );
    runs
}

fn push_process_run(
    runs: &mut Vec<ProcessRunBlock>,
    day_start: i64,
    start: i64,
    end: i64,
    name: &str,
) {
    if end <= start {
        return;
    }
    runs.push(ProcessRunBlock {
        x: day_fraction(start, day_start),
        width: ((end - start) as f32 / millis_per_day() as f32).max(0.0003),
        color: process_brush(name),
        name: name.into(),
    });
}

fn build_hover_text(timestamp: i64, day_start: i64) -> String {
    let entries = data::with_db(|conn| data::time_entries::get_time_entries_impl(conn, day_start))
        .unwrap_or_default();
    let categories = data::with_db(data::categories::get_categories_impl).unwrap_or_default();
    let entry = entries
        .iter()
        .find(|entry| timestamp >= entry.start_time && timestamp < entry.end_time);
    let entry_text = entry.map(|entry| {
        let category = entry
            .category_id
            .and_then(|id| categories.iter().find(|category| category.id == id))
            .map(|category| category.name.as_str())
            .unwrap_or("未分类");
        format!(
            "行为 {} · {} · {}",
            entry.label,
            category,
            format_duration(entry.end_time - entry.start_time)
        )
    });

    let screenshot = data::with_db(|conn| data::get_screenshot_near_time(conn, timestamp, 150_000))
        .ok()
        .flatten()
        .is_some();

    let samples = data::with_db(|conn| {
        data::process_samples::get_process_samples_for_day(
            conn,
            (timestamp - 300_000).max(day_start),
            (timestamp + 300_000).min(day_start + millis_per_day()),
        )
    })
    .unwrap_or_default();
    let mut counts: HashMap<String, usize> = HashMap::new();
    for sample in samples {
        *counts.entry(sample.process_name).or_default() += 1;
    }
    let mut ranked = counts.into_iter().collect::<Vec<_>>();
    ranked.sort_by(|left, right| right.1.cmp(&left.1));
    let top = ranked
        .into_iter()
        .take(3)
        .map(|(name, seconds)| format!("{name} {seconds}秒"))
        .collect::<Vec<_>>()
        .join(" / ");

    format!(
        "{} | 截图 {} | 进程 {}",
        entry_text.unwrap_or_else(|| "空白区间".to_owned()),
        if screenshot { "有" } else { "无" },
        if top.is_empty() { "无采样" } else { &top }
    )
}

fn process_brush(name: &str) -> Brush {
    let mut hash: u32 = 2166136261;
    for byte in name.as_bytes() {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(16777619);
    }
    let palette = [
        "#14b8a6", "#f97316", "#8b5cf6", "#22c55e", "#0ea5e9", "#eab308", "#ec4899", "#64748b",
    ];
    brush_from_hex(palette[(hash as usize) % palette.len()])
}

fn day_fraction(timestamp: i64, day_start: i64) -> f32 {
    ((timestamp - day_start) as f32 / millis_per_day() as f32).clamp(0.0, 1.0)
}

fn start_of_today_millis() -> i64 {
    let now = Local::now();
    Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0)
        .single()
        .expect("valid local midnight")
        .timestamp_millis()
}

fn search_range(day_start: i64, scope: i32) -> (i64, i64, &'static str) {
    let date = Local
        .timestamp_millis_opt(day_start)
        .single()
        .unwrap_or_else(Local::now);
    match scope {
        1 => {
            let start = Local
                .with_ymd_and_hms(date.year(), date.month(), 1, 0, 0, 0)
                .single()
                .map(|value| value.timestamp_millis())
                .unwrap_or(day_start);
            let (year, month) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            let end = Local
                .with_ymd_and_hms(year, month, 1, 0, 0, 0)
                .single()
                .map(|value| value.timestamp_millis())
                .unwrap_or(start + 31 * millis_per_day());
            (start, end, "本月")
        }
        2 => {
            let start = Local
                .with_ymd_and_hms(date.year(), 1, 1, 0, 0, 0)
                .single()
                .map(|value| value.timestamp_millis())
                .unwrap_or(day_start);
            let end = Local
                .with_ymd_and_hms(date.year() + 1, 1, 1, 0, 0, 0)
                .single()
                .map(|value| value.timestamp_millis())
                .unwrap_or(start + 366 * millis_per_day());
            (start, end, "本年")
        }
        _ => (day_start, day_start + millis_per_day(), "当日"),
    }
}

fn format_day(timestamp_millis: i64) -> String {
    Local
        .timestamp_millis_opt(timestamp_millis)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "未知日期".to_owned())
}

fn format_time(timestamp_millis: i64) -> String {
    Local
        .timestamp_millis_opt(timestamp_millis)
        .single()
        .map(|dt| dt.format("%H:%M:%S").to_string())
        .unwrap_or_else(|| "--:--:--".to_owned())
}

fn format_duration(milliseconds: i64) -> String {
    let total_seconds = milliseconds / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    if hours > 0 {
        format!("{hours}小时{minutes:02}分")
    } else if minutes > 0 {
        format!("{minutes}分{seconds:02}秒")
    } else {
        format!("{seconds}秒")
    }
}

fn format_clock(milliseconds: i64) -> String {
    let total_seconds = milliseconds / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}

fn parse_time_on_day(day_start: i64, text: &str) -> Result<i64, String> {
    let parts = text.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return Err("时间格式应为 HH:MM:SS。".to_owned());
    }
    let hour = parts[0]
        .parse::<i64>()
        .map_err(|_| "小时格式无效。".to_owned())?;
    let minute = parts[1]
        .parse::<i64>()
        .map_err(|_| "分钟格式无效。".to_owned())?;
    let second = parts[2]
        .parse::<i64>()
        .map_err(|_| "秒格式无效。".to_owned())?;
    if !(0..=23).contains(&hour) || !(0..=59).contains(&minute) || !(0..=59).contains(&second) {
        return Err("时间必须在 00:00:00 到 23:59:59 之间。".to_owned());
    }
    Ok(day_start + ((hour * 3600 + minute * 60 + second) * 1000))
}
fn brush_from_hex(hex: &str) -> Brush {
    let hex = hex.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return Brush::from(Color::from_rgb_u8(20, 184, 166));
    }

    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(20);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(184);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(166);
    Brush::from(Color::from_rgb_u8(r, g, b))
}

fn is_valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn millis_per_day() -> i64 {
    24 * 60 * 60 * 1000
}

fn version_is_newer(candidate: &str, current: &str) -> bool {
    let parse = |value: &str| {
        value
            .split('.')
            .take(3)
            .map(|part| {
                part.split('-')
                    .next()
                    .unwrap_or("0")
                    .parse::<u32>()
                    .unwrap_or(0)
            })
            .collect::<Vec<_>>()
    };
    let mut candidate = parse(candidate);
    let mut current = parse(current);
    candidate.resize(3, 0);
    current.resize(3, 0);
    candidate > current
}
