import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { TimelineView } from './pages/TimelineView';
import { AUTO_UPDATE_ERROR_EVENT, runAutoUpdater } from './services/updater';
import { useTimelineStore } from './services/store';

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

  const uiScale = useTimelineStore((state) => state.uiScale);
  const setUiScale = useTimelineStore((state) => state.setUiScale);

  useEffect(() => {
    // Apply UI Scale to document root
    document.documentElement.style.zoom = `${uiScale}`;
  }, [uiScale]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDirection = e.deltaY > 0 ? -0.1 : 0.1;
        setUiScale((prev) => Math.max(0.5, Math.min(prev + zoomDirection, 3)));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setUiScale((prev) => Math.min(prev + 0.1, 3));
        } else if (e.key === '-') {
          e.preventDefault();
          setUiScale((prev) => Math.max(0.5, prev - 0.1));
        } else if (e.key === '0') {
          e.preventDefault();
          setUiScale(1);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setUiScale]);

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
