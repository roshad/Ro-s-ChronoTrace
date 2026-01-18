pub mod window;
pub mod screenshot;

pub use window::{get_active_window, WindowActivityCapture};
pub use screenshot::{capture_screenshot, get_screenshot_for_time};
