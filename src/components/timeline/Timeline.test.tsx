import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('keeps normal wheel as pan and not zoom', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const scrollContainer = screen.getByTestId('timeline-scroll-container');
    fireEvent.wheel(scrollContainer, { deltaY: -100, clientX: 200 });

    expect(screen.getByText('当前视野：24 小时')).toBeInTheDocument();
  });
});
