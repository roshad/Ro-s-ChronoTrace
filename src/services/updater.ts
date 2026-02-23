let autoUpdateStarted = false;
export const AUTO_UPDATE_ERROR_EVENT = 'app:auto-update-error';

export type UpdateInstallResult =
  | { status: 'no-update' }
  | {
      status: 'updated';
      currentVersion: string;
      targetVersion: string;
    };

const ensureUpdaterRuntime = () => {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('当前不是 Tauri 运行环境，无法检测更新。');
  }

  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    throw new Error('开发模式下不支持更新检查，请在打包后的应用中使用。');
  }
};

export const checkAndInstallUpdate = async (): Promise<UpdateInstallResult> => {
  ensureUpdaterRuntime();

  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check({ timeout: 15000 });
  if (!update) {
    return { status: 'no-update' };
  }

  await update.downloadAndInstall();
  return {
    status: 'updated',
    currentVersion: update.currentVersion,
    targetVersion: update.version,
  };
};

export const relaunchApp = async () => {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
};

export const runAutoUpdater = async () => {
  if (autoUpdateStarted) {
    return;
  }
  autoUpdateStarted = true;

  try {
    const result = await checkAndInstallUpdate();
    if (result.status === 'no-update') {
      return;
    }

    console.info(
      `Update available: ${result.currentVersion} -> ${result.targetVersion}. Installed successfully, restarting...`
    );
    await relaunchApp();
  } catch (error) {
    console.error('Auto update check/install failed:', error);
    const detail = String(error ?? '未知错误');
    window.dispatchEvent(
      new CustomEvent<string>(AUTO_UPDATE_ERROR_EVENT, {
        detail,
      })
    );
  }
};
