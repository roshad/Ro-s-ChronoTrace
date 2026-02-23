import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { TimelineView } from './pages/TimelineView';
import { AUTO_UPDATE_ERROR_EVENT, runAutoUpdater } from './services/updater';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [autoUpdateError, setAutoUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const onAutoUpdateError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setAutoUpdateError(customEvent.detail || '自动更新失败，请稍后在设置中手动检测更新。');
    };

    window.addEventListener(AUTO_UPDATE_ERROR_EVENT, onAutoUpdateError);
    void runAutoUpdater();

    return () => {
      window.removeEventListener(AUTO_UPDATE_ERROR_EVENT, onAutoUpdateError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {autoUpdateError && (
        <div className="update-notice" role="status" aria-live="polite">
          <span className="update-notice-text">
            自动更新失败：{autoUpdateError}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAutoUpdateError(null)}
            aria-label="关闭自动更新错误提示"
          >
            知道了
          </button>
        </div>
      )}
      <TimelineView />
    </QueryClientProvider>
  );
}

export default App;
