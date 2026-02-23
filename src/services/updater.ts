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
};

export const toUpdaterErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? '未知错误');

  if (/Could not fetch a valid release JSON from the remote/i.test(raw)) {
    return '未获取到有效更新元数据（latest.json）。请检查 Release 是否已上传 latest.json 与签名文件（*.sig）。';
  }

  return raw;
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
    const detail = toUpdaterErrorMessage(error);
    window.dispatchEvent(
      new CustomEvent<string>(AUTO_UPDATE_ERROR_EVENT, {
        detail,
      })
    );
  }
};
