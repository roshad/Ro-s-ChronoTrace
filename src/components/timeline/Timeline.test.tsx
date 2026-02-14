import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Timeline } from './Timeline';
import { api, TimeEntry } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    getCategories: jest.fn(),
  },
}));

const mockGetCategories = api.getCategories as jest.MockedFunction<typeof api.getCategories>;

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

describe('Timeline', () => {
  const mockDate = new Date('2026-01-28T00:00:00Z');
  const mockTimeEntries: TimeEntry[] = [
    {
      id: 1,
      start_time: new Date('2026-01-28T09:00:00Z').getTime(),
      end_time: new Date('2026-01-28T10:00:00Z').getTime(),
      label: 'Work',
      color: '#4CAF50',
    },
    {
      id: 2,
      start_time: new Date('2026-01-28T14:00:00Z').getTime(),
      end_time: new Date('2026-01-28T15:30:00Z').getTime(),
      label: 'Meeting',
      color: '#2196F3',
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    mockGetCategories.mockResolvedValue([]);
  });

  it('renders timeline with time entries', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('renders hour markers', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('24:00')).toBeInTheDocument();
  });

  it('calls onHover when mouse moves over timeline lane', () => {
    const mockOnHover = jest.fn();
    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        onHover={mockOnHover}
      />
    );

    const svg = document.querySelector('svg');
    if (svg) {
      fireEvent.mouseMove(svg, {
        clientX: 300,
        clientY: 50,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      expect(mockOnHover).toHaveBeenCalled();
      const firstCall = mockOnHover.mock.calls[0]?.[0];
      expect(firstCall).toEqual(expect.objectContaining({
        timestamp: expect.any(Number),
        clientX: 300,
        clientY: 50,
      }));
    }
  });

  it('handles drag selection', () => {
    const mockOnDragSelect = jest.fn();
    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        onDragSelect={mockOnDragSelect}
      />
    );

    const svg = document.querySelector('svg');
    if (svg) {
      fireEvent.mouseDown(svg, {
        clientX: 300,
        clientY: 40,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      fireEvent.mouseMove(svg, {
        clientX: 600,
        clientY: 40,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      fireEvent.mouseUp(svg);

      expect(mockOnDragSelect).toHaveBeenCalled();
    }
  });

  it('does not call onDragSelect for selections less than 1 minute', () => {
    const mockOnDragSelect = jest.fn();
    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        onDragSelect={mockOnDragSelect}
      />
    );

    const svg = document.querySelector('svg');
    if (svg) {
      fireEvent.mouseDown(svg, {
        clientX: 300,
        clientY: 40,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      fireEvent.mouseMove(svg, {
        clientX: 300.5,
        clientY: 40,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      fireEvent.mouseUp(svg);

      expect(mockOnDragSelect).not.toHaveBeenCalled();
    }
  });

  it('renders empty timeline when no time entries', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={[]} />);

    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
  });

  it('renders screenshot markers on timeline', () => {
    const screenshotTimestamps = [
      new Date('2026-01-28T09:15:00Z').getTime(),
      new Date('2026-01-28T14:45:00Z').getTime(),
    ];

    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        screenshotTimestamps={screenshotTimestamps}
      />
    );

    const markers = document.querySelectorAll('.screenshot-marker');
    expect(markers.length).toBe(2);
  });

  it('clears drag selection on mouse leave', () => {
    const mockOnDragSelect = jest.fn();
    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        onDragSelect={mockOnDragSelect}
      />
    );

    const svg = document.querySelector('svg');
    if (svg) {
      fireEvent.mouseDown(svg, {
        clientX: 300,
        clientY: 40,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      });

      fireEvent.mouseLeave(svg);
      fireEvent.mouseUp(svg);

      expect(mockOnDragSelect).not.toHaveBeenCalled();
    }
  });

  it('renders zoom controls with default 24h view', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    expect(screen.getByText('时间轴缩放')).toBeInTheDocument();
    expect(screen.getByText('当前视野：24 小时')).toBeInTheDocument();
    expect(screen.getByLabelText('时间轴缩放小时数')).toBeInTheDocument();
  });

  it('zooms with ctrl+wheel', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const scrollContainer = screen.getByTestId('timeline-scroll-container');
    fireEvent.wheel(scrollContainer, { deltaY: -100, ctrlKey: true, clientX: 200 });

    expect(screen.getByText('当前视野：23 小时')).toBeInTheDocument();
  });

  it('restores previous zoom level from localStorage on startup', () => {
    window.localStorage.setItem('timeline-visible-hours', '7');

    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    expect(screen.getByText('当前视野：7 小时')).toBeInTheDocument();
  });

  it('keeps normal wheel as pan and not zoom', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const scrollContainer = screen.getByTestId('timeline-scroll-container');
    fireEvent.wheel(scrollContainer, { deltaY: -100, clientX: 200 });

    expect(screen.getByText('当前视野：24 小时')).toBeInTheDocument();
  });

  it('does not show drag selection ghost when mousedown on existing entry block', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const firstEntryRect = document.querySelector('.time-entry-block rect');
    expect(firstEntryRect).toBeTruthy();
    if (!firstEntryRect) {
      return;
    }

    fireEvent.mouseDown(firstEntryRect, {
      clientX: 300,
      clientY: 40,
    });

    const dragGhost = document.querySelector('rect[stroke-dasharray="5,5"]');
    expect(dragGhost).toBeNull();
  });

  it('calls onEntryRangeChange when dragging an existing entry handle', () => {
    const mockOnEntryRangeChange = jest.fn();
    renderWithQueryClient(
      <Timeline
        date={mockDate}
        timeEntries={mockTimeEntries}
        onEntryRangeChange={mockOnEntryRangeChange}
      />
    );

    const endHandle = document.querySelector('.time-entry-resize-handle.end');
    const svg = document.querySelector('svg');
    expect(endHandle).toBeTruthy();
    expect(svg).toBeTruthy();
    if (!endHandle || !svg) {
      return;
    }

    fireEvent.mouseDown(endHandle, {
      clientX: 420,
      clientY: 40,
    });

    fireEvent.mouseMove(svg, {
      clientX: 560,
      clientY: 40,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    });

    fireEvent.mouseUp(svg);

    expect(mockOnEntryRangeChange).toHaveBeenCalledTimes(1);
    const [entry, start, end] = mockOnEntryRangeChange.mock.calls[0];
    expect(entry).toEqual(expect.objectContaining({ id: 1 }));
    expect(start).toBe(mockTimeEntries[0].start_time);
    expect(end).not.toBe(mockTimeEntries[0].end_time);
    expect(end).toBeGreaterThan(start);
  });

  it('clips entry label text so it does not overflow block bounds', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const label = screen.getByText('Work');
    const textElement = label.closest('text');
    expect(textElement).not.toBeNull();
    expect(textElement?.getAttribute('clip-path')).toMatch(/^url\(#time-entry-label-clip-/);
  });

  it('uses category color as the single source when entry has category_id', async () => {
    mockGetCategories.mockResolvedValue([
      { id: 1, name: 'Focus', color: '#ff0000' },
    ]);

    const categorizedEntries: TimeEntry[] = [{
      id: 3,
      start_time: new Date('2026-01-28T16:00:00Z').getTime(),
      end_time: new Date('2026-01-28T17:00:00Z').getTime(),
      label: 'Categorized',
      color: '#00ff00',
      category_id: 1,
    }];

    renderWithQueryClient(<Timeline date={mockDate} timeEntries={categorizedEntries} />);

    await waitFor(() => {
      const entryRect = document.querySelector('.time-entry-block > rect');
      expect(entryRect?.getAttribute('fill')).toBe('#ff0000');
    });
  });

  it('renders uncategorized entry as gray even when entry.color exists', () => {
    const uncategorizedEntries: TimeEntry[] = [{
      id: 4,
      start_time: new Date('2026-01-28T18:00:00Z').getTime(),
      end_time: new Date('2026-01-28T19:00:00Z').getTime(),
      label: 'Uncategorized',
      color: '#00ff00',
      category_id: undefined,
    }];

    renderWithQueryClient(<Timeline date={mockDate} timeEntries={uncategorizedEntries} />);

    const entryRect = document.querySelector('.time-entry-block > rect');
    expect(entryRect?.getAttribute('fill')).toBe('#6b7280');
  });
});
