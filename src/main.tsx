import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const revealWindowAfterFirstFrame = async () => {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().show();
  } catch (error) {
    // Non-Tauri environments (pure web preview) may not support window APIs.
    console.debug("Skip window.show() outside Tauri runtime:", error);
  }
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.requestAnimationFrame(() => {
  void revealWindowAfterFirstFrame();
});
