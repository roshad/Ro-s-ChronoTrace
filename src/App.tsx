import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { TimelineView } from './pages/TimelineView';
import { runAutoUpdater } from './services/updater';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  useEffect(() => {
    void runAutoUpdater();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TimelineView />
    </QueryClientProvider>
  );
}

export default App;
