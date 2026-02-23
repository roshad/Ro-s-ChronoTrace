const mockCheck = jest.fn();
const mockRelaunch = jest.fn();

jest.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

jest.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

const setTauriRuntime = () => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    configurable: true,
  });
};

const clearTauriRuntime = () => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
};

describe('updater service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    setTauriRuntime();
  });

  afterEach(() => {
    clearTauriRuntime();
    jest.restoreAllMocks();
  });

  it('throws when running outside tauri runtime', async () => {
    clearTauriRuntime();
    const { checkAndInstallUpdate } = await import('./updater');

    await expect(checkAndInstallUpdate()).rejects.toThrow('当前不是 Tauri 运行环境，无法检测更新。');
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('returns no-update when remote has no new release', async () => {
    mockCheck.mockResolvedValue(null);
    const { checkAndInstallUpdate } = await import('./updater');

    const result = await checkAndInstallUpdate();

    expect(mockCheck).toHaveBeenCalledWith({ timeout: 15000 });
    expect(result).toEqual({ status: 'no-update' });
  });

  it('downloads and installs when update exists', async () => {
    const downloadAndInstall = jest.fn().mockResolvedValue(undefined);
    mockCheck.mockResolvedValue({
      currentVersion: '1.1.0',
      version: '1.1.1',
      downloadAndInstall,
    });
    const { checkAndInstallUpdate } = await import('./updater');

    const result = await checkAndInstallUpdate();

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'updated',
      currentVersion: '1.1.0',
      targetVersion: '1.1.1',
    });
  });

  it('maps release json fetch failure to actionable message', async () => {
    const { toUpdaterErrorMessage } = await import('./updater');

    const message = toUpdaterErrorMessage(
      new Error('Could not fetch a valid release JSON from the remote')
    );

    expect(message).toContain('latest.json');
    expect(message).toContain('*.sig');
  });

  it('runAutoUpdater relaunches app after successful install', async () => {
    const downloadAndInstall = jest.fn().mockResolvedValue(undefined);
    mockCheck.mockResolvedValue({
      currentVersion: '1.0.0',
      version: '1.1.0',
      downloadAndInstall,
    });
    const { runAutoUpdater } = await import('./updater');

    await runAutoUpdater();

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
  });

  it('runAutoUpdater dispatches normalized error event on failure', async () => {
    mockCheck.mockRejectedValue(new Error('Could not fetch a valid release JSON from the remote'));
    const { AUTO_UPDATE_ERROR_EVENT, runAutoUpdater } = await import('./updater');

    const detailPromise = new Promise<string>((resolve) => {
      const handler = (event: Event) => {
        window.removeEventListener(AUTO_UPDATE_ERROR_EVENT, handler);
        resolve((event as CustomEvent<string>).detail);
      };
      window.addEventListener(AUTO_UPDATE_ERROR_EVENT, handler);
    });

    await runAutoUpdater();
    const detail = await detailPromise;

    expect(detail).toContain('latest.json');
    expect(mockRelaunch).not.toHaveBeenCalled();
  });
});
