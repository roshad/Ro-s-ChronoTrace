pub mod screenshot;
pub mod window;

pub use screenshot::capture_screenshot;
pub use window::{get_active_window, WindowActivityCapture};
