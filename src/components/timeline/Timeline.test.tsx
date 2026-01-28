import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';
import { TimeEntry } from '../../services/api';

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

  it('renders timeline with time entries', () => {
    render(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    // Check if time entry labels are rendered
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('renders hour markers', () => {
    render(<Timeline date={mockDate} timeEntries={mockTimeEntries} />);

    // Check if some hour markers are rendered
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('24:00')).toBeInTheDocument();
  });

  it('calls onHover when mouse moves over timeline', () => {
    const mockOnHover = jest.fn();
    render(
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
    render(
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
    render(
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
      // Timeline width is 1200px for 24 hours (86400000ms)
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
    render(<Timeline date={mockDate} timeEntries={[]} />);

    // Check that no time entry labels are rendered
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
  });

  it('clears drag selection on mouse leave', () => {
    const mockOnDragSelect = jest.fn();
    render(
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
});
