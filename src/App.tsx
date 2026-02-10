import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimelineView } from './pages/TimelineView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TimelineView />
    </QueryClientProvider>
  );
}

export default App;
