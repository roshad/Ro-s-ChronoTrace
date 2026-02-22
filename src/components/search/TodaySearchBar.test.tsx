import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TodaySearchBar } from './TodaySearchBar';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    searchActivities: jest.fn(),
    searchActivitiesByRange: jest.fn(),
    getCategories: jest.fn(),
    getTimeEntriesByRange: jest.fn(),
  },
}));

const mockSearchActivities = api.searchActivities as jest.MockedFunction<typeof api.searchActivities>;
const mockSearchActivitiesByRange = api.searchActivitiesByRange as jest.MockedFunction<typeof api.searchActivitiesByRange>;
const mockGetCategories = api.getCategories as jest.MockedFunction<typeof api.getCategories>;
const mockGetTimeEntriesByRange = api.getTimeEntriesByRange as jest.MockedFunction<typeof api.getTimeEntriesByRange>;

const QUERY_TEXT = '鍚冭嵂';
const WINDOW_QUERY = 'anki';

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

describe('TodaySearchBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-22T10:00:00+08:00'));
    jest.clearAllMocks();
    window.localStorage.clear();

    mockSearchActivities.mockResolvedValue([]);
    mockGetCategories.mockResolvedValue([]);

    const oneHourStart = new Date('2026-02-22T09:00:00+08:00').getTime();
    const oneHourEnd = oneHourStart + 3600_000;
    mockGetTimeEntriesByRange.mockResolvedValue([
      {
        id: 1,
        start_time: oneHourStart,
        end_time: oneHourEnd,
        label: QUERY_TEXT,
      },
    ]);

    mockSearchActivitiesByRange.mockImplementation(async (query) => {
      if (query === QUERY_TEXT) {
        return [
          {
            type: 'time_entry',
            timestamp: oneHourStart,
            title: QUERY_TEXT,
          },
        ];
      }
      return [];
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders stable layout containers and sections', () => {
    renderWithQueryClient(<TodaySearchBar date={new Date('2026-02-22T10:00:00+08:00')} />);

    expect(screen.getByTestId('today-search-layout')).toBeInTheDocument();
    expect(screen.getByTestId('today-search-main')).toBeInTheDocument();
    expect(screen.getByTestId('today-search-side')).toBeInTheDocument();
    expect(screen.getByTestId('today-search-results')).toBeInTheDocument();
    expect(screen.getByTestId('today-search-stats')).toBeInTheDocument();
  });

  it('saves search item and shows hit count and total duration', async () => {
    renderWithQueryClient(<TodaySearchBar date={new Date('2026-02-22T10:00:00+08:00')} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: QUERY_TEXT } });
    advanceTimers(300);

    await waitFor(() => {
      expect(mockSearchActivitiesByRange).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '保存当前搜索' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: QUERY_TEXT })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('命中 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('1小时')).toBeInTheDocument();
    });
  });

  it('counts saved search hits by matched time entries instead of raw window records', async () => {
    const oneHourStart = new Date('2026-02-22T09:00:00+08:00').getTime();
    mockSearchActivitiesByRange.mockImplementation(async (query) => {
      if (query === WINDOW_QUERY) {
        return [
          {
            type: 'window_activity',
            timestamp: oneHourStart + 5 * 60_000,
            title: 'Anki - deck',
            process_name: 'anki.exe',
          },
          {
            type: 'window_activity',
            timestamp: oneHourStart + 20 * 60_000,
            title: 'Anki - review',
            process_name: 'anki.exe',
          },
        ];
      }
      return [];
    });

    renderWithQueryClient(<TodaySearchBar date={new Date('2026-02-22T10:00:00+08:00')} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: WINDOW_QUERY } });
    advanceTimers(300);

    await waitFor(() => {
      expect(mockSearchActivitiesByRange).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '保存当前搜索' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: WINDOW_QUERY })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('命中 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('1小时')).toBeInTheDocument();
    });
  });

  it('refreshes stats automatically when selected range includes now', async () => {
    renderWithQueryClient(<TodaySearchBar date={new Date('2026-02-22T10:00:00+08:00')} />);

    await waitFor(() => {
      expect(mockGetTimeEntriesByRange).toHaveBeenCalledTimes(1);
    });

    advanceTimers(5000);

    await waitFor(() => {
      expect(mockGetTimeEntriesByRange).toHaveBeenCalledTimes(2);
    });
  });

  it('does not poll stats for past date ranges', async () => {
    renderWithQueryClient(<TodaySearchBar date={new Date('2025-02-22T10:00:00+08:00')} />);

    await waitFor(() => {
      expect(mockGetTimeEntriesByRange).toHaveBeenCalledTimes(1);
    });

    advanceTimers(20000);

    expect(mockGetTimeEntriesByRange).toHaveBeenCalledTimes(1);
  });
});

