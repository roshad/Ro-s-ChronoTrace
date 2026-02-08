use crate::data::AppResult;
use crate::types::{Category, CategoryInput};
use rusqlite::{params, Connection};

pub fn get_categories_impl(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM categories ORDER BY name")
        .map_err(|e| format!("Failed to prepare categories query: {}", e))?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query categories: {}", e))?;

    let mut categories = Vec::new();
    for category in iter {
        categories.push(category.map_err(|e| format!("Failed to map category: {}", e))?);
    }

    Ok(categories)
}

pub fn create_category_impl(conn: &Connection, category: &CategoryInput) -> AppResult<Category> {
    if category.name.trim().is_empty() {
        return Err("Category name cannot be empty".to_string());
    }

    conn.execute(
        "INSERT INTO categories (name, color) VALUES (?, ?)",
        params![category.name, category.color],
    )
    .map_err(|e| format!("Failed to insert category: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Category {
        id,
        name: category.name.clone(),
        color: category.color.clone(),
    })
}

pub fn delete_category_impl(conn: &Connection, id: i64) -> AppResult<()> {
    // First, nullify category_id in time_entries that use this category
    conn.execute(
        "UPDATE time_entries SET category_id = NULL WHERE category_id = ?",
        params![id],
    )
    .map_err(|e| format!("Failed to clear category from time entries: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM categories WHERE id = ?", params![id])
        .map_err(|e| format!("Failed to delete category: {}", e))?;

    if rows_affected == 0 {
        return Err("Category not found".to_string());
    }

    Ok(())
}
