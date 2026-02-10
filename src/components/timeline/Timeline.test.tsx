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

    // Check if time entry labels are rendered
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('renders hour markers', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    // Check if some hour markers are rendered
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('24:00')).toBeInTheDocument();
  });

  it('calls onHover when mouse moves over timeline', () => {
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
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      expect(mockOnHover).toHaveBeenCalled();
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
      // Mouse down
      fireEvent.mouseDown(svg, {
        clientX: 300,
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      // Mouse move
      fireEvent.mouseMove(svg, {
        clientX: 600,
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      // Mouse up
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
      // Mouse down
      fireEvent.mouseDown(svg, {
        clientX: 300,
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      // Mouse move (very small distance, less than 1 minute)
      // Timeline is 24 hours wide at default zoom.
      // 1 minute = 60000ms = (60000 / 86400000) * 1200 = 0.833px
      // So moving less than 1 pixel should be less than 1 minute
      fireEvent.mouseMove(svg, {
        clientX: 300.5,
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      // Mouse up
      fireEvent.mouseUp(svg);

      expect(mockOnDragSelect).not.toHaveBeenCalled();
    }
  });

  it('renders empty timeline when no time entries', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={[]} />);

    // Check that no time entry labels are rendered
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
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
      // Mouse down
      fireEvent.mouseDown(svg, {
        clientX: 300,
        currentTarget: { getBoundingClientRect: () => ({ left: 0 }) },
      });

      // Mouse leave
      fireEvent.mouseLeave(svg);

      // Mouse up should not trigger onDragSelect after mouse leave
      fireEvent.mouseUp(svg);

      expect(mockOnDragSelect).not.toHaveBeenCalled();
    }
  });

  it('renders zoom controls with default 24h view', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    expect(screen.getByText('Timeline Zoom')).toBeInTheDocument();
    expect(screen.getByText('24h view')).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline zoom hours')).toBeInTheDocument();
  });

  it('zooms with ctrl+wheel', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const scrollContainer = screen.getByTestId('timeline-scroll-container');
    fireEvent.wheel(scrollContainer, { deltaY: -100, ctrlKey: true, clientX: 200 });

    expect(screen.getByText('23h view')).toBeInTheDocument();
  });

  it('keeps normal wheel as pan and not zoom', () => {
    renderWithQueryClient(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    const scrollContainer = screen.getByTestId('timeline-scroll-container');
    fireEvent.wheel(scrollContainer, { deltaY: -100, clientX: 200 });

    expect(screen.getByText('24h view')).toBeInTheDocument();
  });
});
