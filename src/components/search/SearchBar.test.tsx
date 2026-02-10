import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchBar } from './SearchBar';
import { api } from '../../services/api';

// Mock API module
jest.mock('../../services/api', () => ({
  api: {
    searchActivities: jest.fn(),
  },
}));

const mockSearchActivities = api.searchActivities as jest.MockedFunction<typeof api.searchActivities>;

// Helper function to render with QueryClient
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

const advanceTimers = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

describe('SearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearchActivities.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders search input', () => {
    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    expect(searchInput).toBeInTheDocument();
  });

  it('updates query state when typing', () => {
    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(searchInput.value).toBe('test');
  });

  it('debounces search query', async () => {
    mockSearchActivities.mockResolvedValue([]);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Should not call API immediately
    expect(mockSearchActivities).not.toHaveBeenCalled();

    // Fast-forward 300ms
    advanceTimers(300);

    await waitFor(() => {
      expect(mockSearchActivities).toHaveBeenCalledWith('test');
    });
  });

  it('does not search with less than 2 characters', () => {
    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 't' } });

    advanceTimers(300);

    expect(mockSearchActivities).not.toHaveBeenCalled();
  });

  it('displays loading state', async () => {
    mockSearchActivities.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    advanceTimers(300);

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText('搜索中...')).toBeInTheDocument();
    });
  });

  it('displays search results', async () => {
    const mockResults = [
      {
        title: 'Test Activity',
        type: 'time_entry' as const,
        timestamp: new Date('2026-01-28T10:00:00Z').getTime(),
        process_name: 'chrome.exe',
      },
    ];

    mockSearchActivities.mockResolvedValue(mockResults);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    advanceTimers(300);

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument();
    });

    // Use function matcher to find text even if split across elements
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'DIV' && content.includes('时间条目');
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'DIV' && content.includes('chrome.exe');
    })).toBeInTheDocument();
  });

  it('displays no results message', async () => {
    mockSearchActivities.mockResolvedValue([]);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    advanceTimers(300);

    await waitFor(() => {
      expect(screen.getByText('未找到结果')).toBeInTheDocument();
    });
  });

  it('formats timestamp correctly', async () => {
    const mockResults = [
      {
        title: 'Test Activity',
        type: 'time_entry' as const,
        timestamp: new Date('2026-01-28T10:30:00Z').getTime(),
      },
    ];

    mockSearchActivities.mockResolvedValue(mockResults);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    advanceTimers(300);

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument();
    });

    // Check that timestamp is displayed (format may vary by timezone)
    const timestampElement = screen.getByText((content, element) => {
      return element?.tagName === 'DIV' && content.includes('1月') && content.includes(':');
    });
    expect(timestampElement).toBeInTheDocument();
  });

  it('displays 窗口活动 type', async () => {
    const mockResults = [
      {
        title: 'Test Window',
        type: 'window_activity' as const,
        timestamp: new Date('2026-01-28T10:00:00Z').getTime(),
      },
    ];

    mockSearchActivities.mockResolvedValue(mockResults);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    advanceTimers(300);

    await waitFor(() => {
      expect(screen.getByText('Test Window')).toBeInTheDocument();
    });

    // Use function matcher to find text even if split across elements
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'DIV' && content.includes('窗口活动');
    })).toBeInTheDocument();
  });

  it('clears previous timer when typing quickly', async () => {
    mockSearchActivities.mockResolvedValue([]);

    renderWithQueryClient(<SearchBar />);

    const searchInput = screen.getByPlaceholderText('搜索行为记录...（至少 2 个字符）');

    // Type quickly
    fireEvent.change(searchInput, { target: { value: 't' } });
    advanceTimers(100);

    fireEvent.change(searchInput, { target: { value: 'te' } });
    advanceTimers(100);

    fireEvent.change(searchInput, { target: { value: 'tes' } });
    advanceTimers(100);

    fireEvent.change(searchInput, { target: { value: 'test' } });
    advanceTimers(300);

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockSearchActivities).toHaveBeenCalled();
    });

    // Should only call API once with final value
    expect(mockSearchActivities).toHaveBeenCalledTimes(1);
    expect(mockSearchActivities).toHaveBeenCalledWith('test');
  });
});

