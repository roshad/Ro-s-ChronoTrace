let autoUpdateStarted = false;

export const runAutoUpdater = async () => {
  if (autoUpdateStarted) {
    return;
  }
  autoUpdateStarted = true;

  if (!('__TAURI_INTERNALS__' in window)) {
    return;
  }
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return;
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check({ timeout: 15000 });
    if (!update) {
      return;
    }

    console.info(
      `Update available: ${update.currentVersion} -> ${update.version}. Downloading and installing...`
    );
    await update.downloadAndInstall();

    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (error) {
    console.error('Auto update check/install failed:', error);
  }
};
