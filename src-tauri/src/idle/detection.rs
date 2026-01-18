use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Arc, Mutex};
use rdev::{listen, Event, EventType};

/// Start idle detection background task
pub fn start_idle_detection() {
    let last_activity = Arc::new(Mutex::new(SystemTime::now()));
    let last_activity_clone = Arc::clone(&last_activity);

    // Start event listener for mouse/keyboard activity
    std::thread::spawn(move || {
        if let Err(e) = listen(move |event: Event| {
            match event.event_type {
                EventType::KeyPress(_) | EventType::MouseMove { .. } | EventType::ButtonPress(_) => {
                    if let Ok(mut last) = last_activity_clone.lock() {
                        *last = SystemTime::now();
                    }
                }
                _ => {}
            }
        }) {
            eprintln!("Error listening to input events: {:?}", e);
        }
    });

    // Start idle detection loop
    tokio::spawn(async move {
        let idle_threshold = std::time::Duration::from_secs(300); // 5 minutes
        let mut idle_start: Option<i64> = None;

        loop {
            let now = SystemTime::now();
            let last = {
                last_activity.lock().unwrap().clone()
            };

            let idle_duration = now.duration_since(last).unwrap_or_default();

            if idle_duration >= idle_threshold {
                if idle_start.is_none() {
                    // User just became idle
                    let start_ms = last
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as i64;
                    idle_start = Some(start_ms);
                    println!("User became idle at: {}", start_ms);
                }
            } else {
                if let Some(start_ms) = idle_start {
                    // User returned from idle
                    let end_ms = now
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as i64;

                    println!("Idle period ended: {} to {}", start_ms, end_ms);

                    // Record idle period in database
                    if let Err(e) = crate::data::with_db(|conn| {
                        crate::data::idle::insert_idle_period(conn, start_ms, end_ms)
                    }) {
                        eprintln!("Failed to record idle period: {}", e);
                    }

                    // TODO: Emit Tauri event to notify frontend
                    // app_handle.emit_all("idle-detected", IdlePeriodEvent { start_ms, end_ms })

                    idle_start = None;
                }
            }

            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    });
}

/// Tauri command: Resolve an idle period
#[tauri::command]
pub async fn resolve_idle_period(resolution: crate::types::IdlePeriodResolution) -> Result<crate::types::IdlePeriod, String> {
    crate::data::with_db(|conn| {
        crate::data::idle::resolve_idle_period_with_action(conn, &resolution)
    })
}
