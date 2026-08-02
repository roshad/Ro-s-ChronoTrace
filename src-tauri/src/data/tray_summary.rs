use std::collections::BTreeMap;
use std::sync::RwLock;

use chrono::{Local, LocalResult, TimeZone};
use once_cell::sync::Lazy;
use rusqlite::{params, Connection};

use super::{with_db, AppResult};

const UNCATEGORIZED_COLOR: &str = "#64748B";
const UNCATEGORIZED_NAME: &str = "未分类";

#[derive(Debug, Clone, Default)]
pub struct TraySummary {
    pub categories: Vec<CategorySummary>,
    pub active: Option<ActiveBehavior>,
}

#[derive(Debug, Clone)]
pub struct CategorySummary {
    pub name: String,
    pub color: String,
    pub total_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveBehavior {
    pub entry_id: i64,
    pub label: String,
    pub start_time: i64,
    pub category_name: String,
    pub category_color: String,
}

static SUMMARY_CACHE: Lazy<RwLock<TraySummary>> = Lazy::new(|| RwLock::new(TraySummary::default()));
static ACTIVE_ENTRY_ID: Lazy<RwLock<Option<i64>>> = Lazy::new(|| RwLock::new(None));

pub fn snapshot() -> TraySummary {
    SUMMARY_CACHE
        .read()
        .map(|summary| summary.clone())
        .unwrap_or_default()
}

pub fn refresh_from_database() -> AppResult<()> {
    let summary = with_db(build_summary)?;
    let mut cache = SUMMARY_CACHE
        .write()
        .map_err(|error| format!("Failed to lock tray summary cache: {error}"))?;
    *cache = summary;
    Ok(())
}

pub fn set_active_timer(entry_id: Option<i64>) -> AppResult<()> {
    let mut active_entry = ACTIVE_ENTRY_ID
        .write()
        .map_err(|error| format!("Failed to lock active tray timer: {error}"))?;
    *active_entry = entry_id;
    drop(active_entry);

    refresh_from_database()
}

fn build_summary(conn: &Connection) -> AppResult<TraySummary> {
    let active_id = active_entry_id();
    let mut summary = build_summary_at(conn, Local::now(), active_id)?;
    summary.active = load_active_behavior(conn, active_id)?;
    Ok(summary)
}

fn active_entry_id() -> Option<i64> {
    ACTIVE_ENTRY_ID.read().ok().and_then(|entry_id| *entry_id)
}

fn load_active_behavior(
    conn: &Connection,
    entry_id: Option<i64>,
) -> AppResult<Option<ActiveBehavior>> {
    let Some(entry_id) = entry_id else {
        return Ok(None);
    };

    match conn.query_row(
        "SELECT t.id, t.label, t.start_time,
                COALESCE(c.name, ?2), COALESCE(c.color, ?3)
         FROM time_entries t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = ?1",
        params![entry_id, UNCATEGORIZED_NAME, UNCATEGORIZED_COLOR],
        |row| {
            Ok(ActiveBehavior {
                entry_id: row.get(0)?,
                label: row.get(1)?,
                start_time: row.get(2)?,
                category_name: row.get(3)?,
                category_color: row.get(4)?,
            })
        },
    ) {
        Ok(active) => Ok(Some(active)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("Failed to query active tray behavior: {error}")),
    }
}

fn build_summary_at(
    conn: &Connection,
    now: chrono::DateTime<Local>,
    active_id: Option<i64>,
) -> AppResult<TraySummary> {
    let day_start = local_midnight_ms(now.date_naive());
    let next_day = now
        .date_naive()
        .succ_opt()
        .unwrap_or_else(|| now.date_naive());
    let day_end = local_midnight_ms(next_day);
    let now_ms = now.timestamp_millis();

    let mut statement = conn
        .prepare(
            "SELECT t.id, t.start_time, t.end_time, t.category_id, c.name, c.color
             FROM time_entries t
             LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.start_time < ?1 AND (t.end_time > ?2 OR t.id = ?3)",
        )
        .map_err(|error| format!("Failed to prepare tray summary query: {error}"))?;

    let rows = statement
        .query_map(params![day_end, day_start, active_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|error| format!("Failed to query tray summary: {error}"))?;

    let mut categories = BTreeMap::<i64, CategorySummary>::new();

    for row in rows {
        let (entry_id, start_time, end_time, category_id, category_name, category_color) =
            row.map_err(|error| format!("Failed to read tray summary row: {error}"))?;

        let start = start_time.max(day_start);
        let effective_end = if active_id == Some(entry_id) {
            end_time.max(now_ms)
        } else {
            end_time
        };
        let end = effective_end.min(day_end).min(now_ms);
        if end <= start {
            continue;
        }

        let duration_ms = end - start;

        let category_key = category_id.filter(|_| category_name.is_some()).unwrap_or(0);
        let category = categories
            .entry(category_key)
            .or_insert_with(|| CategorySummary {
                name: category_name
                    .clone()
                    .unwrap_or_else(|| UNCATEGORIZED_NAME.to_string()),
                color: category_color
                    .clone()
                    .unwrap_or_else(|| UNCATEGORIZED_COLOR.to_string()),
                total_ms: 0,
            });
        category.total_ms += duration_ms;
    }

    let mut categories: Vec<_> = categories.into_values().collect();
    categories.sort_by(|left, right| {
        right
            .total_ms
            .cmp(&left.total_ms)
            .then_with(|| left.name.cmp(&right.name))
    });

    Ok(TraySummary {
        categories,
        active: None,
    })
}

fn local_midnight_ms(date: chrono::NaiveDate) -> i64 {
    let naive = date
        .and_hms_opt(0, 0, 0)
        .expect("midnight is always a valid time");

    match Local.from_local_datetime(&naive) {
        LocalResult::Single(value) | LocalResult::Ambiguous(value, _) => value.timestamp_millis(),
        LocalResult::None => naive.and_utc().timestamp_millis(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_timestamp(hour: u32, minute: u32) -> i64 {
        Local
            .with_ymd_and_hms(2026, 1, 1, hour, minute, 0)
            .single()
            .expect("test timestamp should be unambiguous")
            .timestamp_millis()
    }

    #[test]
    fn build_summary_aggregates_today_by_category() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        conn.execute_batch(
            "CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            );
            CREATE TABLE time_entries (
                id INTEGER PRIMARY KEY,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                label TEXT NOT NULL,
                category_id INTEGER
            );",
        )
        .expect("test schema should be created");

        conn.execute(
            "INSERT INTO categories (id, name, color) VALUES (1, '工作', '#FF6B6B'), (2, '休息', '#4DABF7')",
            [],
        )
        .expect("test categories should be inserted");

        conn.execute(
            "INSERT INTO time_entries (start_time, end_time, label, category_id)
             VALUES (?1, ?2, 'deep work', 1), (?3, ?4, 'break', 2), (?5, ?6, 'review', 1)",
            params![
                local_timestamp(9, 0),
                local_timestamp(10, 0),
                local_timestamp(10, 30),
                local_timestamp(10, 45),
                local_timestamp(11, 0),
                local_timestamp(11, 30),
            ],
        )
        .expect("test time entries should be inserted");

        let now = Local
            .with_ymd_and_hms(2026, 1, 1, 12, 0, 0)
            .single()
            .expect("test date should be unambiguous");
        let summary = build_summary_at(&conn, now, None).expect("summary should be built");

        assert_eq!(summary.categories.len(), 2);
        assert_eq!(summary.categories[0].name, "工作");
        assert_eq!(summary.categories[0].color, "#FF6B6B");
        assert_eq!(summary.categories[0].total_ms, 90 * 60 * 1000);
        assert_eq!(summary.categories[1].name, "休息");
        assert_eq!(summary.categories[1].total_ms, 15 * 60 * 1000);
    }

    #[test]
    fn build_summary_counts_active_behavior_until_now() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        conn.execute_batch(
            "CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            );
            CREATE TABLE time_entries (
                id INTEGER PRIMARY KEY,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                label TEXT NOT NULL,
                category_id INTEGER
            );
            INSERT INTO categories (id, name, color) VALUES (1, '工作', '#FF6B6B');",
        )
        .expect("test schema should be created");

        let start = local_timestamp(11, 0);
        conn.execute(
            "INSERT INTO time_entries (id, start_time, end_time, label, category_id)
             VALUES (12, ?1, ?2, '持续工作', 1)",
            params![start, start + 1_000],
        )
        .expect("active time entry should be inserted");

        let now = Local
            .with_ymd_and_hms(2026, 1, 1, 12, 0, 0)
            .single()
            .expect("test date should be unambiguous");
        let summary = build_summary_at(&conn, now, Some(12)).expect("summary should be built");

        assert_eq!(summary.categories.len(), 1);
        assert_eq!(summary.categories[0].total_ms, 60 * 60 * 1000);
    }

    #[test]
    fn load_active_behavior_reads_category_and_falls_back_to_uncategorized() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        conn.execute_batch(
            "CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            );
            CREATE TABLE time_entries (
                id INTEGER PRIMARY KEY,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                label TEXT NOT NULL,
                category_id INTEGER
            );
            INSERT INTO categories (id, name, color) VALUES (1, '工作', '#FF6B6B');
            INSERT INTO time_entries (id, start_time, end_time, label, category_id)
                VALUES (10, 1000, 2000, '写代码', 1),
                       (11, 1000, 2000, '临时任务', NULL);",
        )
        .expect("test schema should be created");

        let categorized = load_active_behavior(&conn, Some(10))
            .expect("categorized behavior should load")
            .expect("categorized behavior should exist");
        assert_eq!(categorized.entry_id, 10);
        assert_eq!(categorized.label, "写代码");
        assert_eq!(categorized.category_name, "工作");
        assert_eq!(categorized.category_color, "#FF6B6B");

        let uncategorized = load_active_behavior(&conn, Some(11))
            .expect("uncategorized behavior should load")
            .expect("uncategorized behavior should exist");
        assert_eq!(uncategorized.category_name, UNCATEGORIZED_NAME);
        assert_eq!(uncategorized.category_color, UNCATEGORIZED_COLOR);
        assert!(load_active_behavior(&conn, None)
            .expect("empty active behavior should load")
            .is_none());
    }
}
