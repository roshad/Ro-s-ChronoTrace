import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, TimeEntry } from '../../services/api';

interface TimelineProps {
  date: Date;
  timeEntries: TimeEntry[];
  onHover?: (timestamp: number) => void;
  onHoverEnd?: () => void;
  onDragSelect?: (start: number, end: number) => void;
  onEntryClick?: (entry: TimeEntry) => void;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
  date,
  timeEntries,
  onHover,
  onHoverEnd,
  onDragSelect,
  onEntryClick,
}) => {
  const width = 1200;
  const height = 100;
  const dayStart = new Date(date).setHours(0, 0, 0, 0);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.color));
    return map;
  }, [categories]);

  // Convert time to x position
  const timeToX = (timestamp: number) => {
    const offset = timestamp - dayStart;
    return (offset / 86400000) * width;
  };

  // Convert x position to timestamp
  const xToTime = (x: number) => {
    return Math.round(dayStart + (x / width) * 86400000);
  };

  const [dragStart, setDragStart] = React.useState<number | null>(null);
  const [dragEnd, setDragEnd] = React.useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timestamp = xToTime(x);
    setDragStart(timestamp);
    setDragEnd(timestamp);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timestamp = xToTime(x);
    const isDragging = dragStart !== null;

    // Hover preview
    if (onHover && !isDragging) {
      onHover(timestamp);
    }

    // Drag selection
    if (isDragging) {
      setDragEnd(timestamp);
    }
  };

  const handleMouseUp = () => {
    if (dragStart !== null && dragEnd !== null && onDragSelect) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);
      if (end - start > 60000) { // At least 1 minute
        onDragSelect(start, end);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    if (onHoverEnd) {
      onHoverEnd();
    }
  };

  // Render time blocks
  const timeBlocks = useMemo(() => {
    return timeEntries.map((entry) => {
      const x = timeToX(entry.start_time);
      const blockWidth = timeToX(entry.end_time) - x;
      const color =
        (entry.category_id && categoryMap.get(entry.category_id)) ||
        entry.color ||
        '#4CAF50';

      return (
        <g
          key={entry.id}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            if (onEntryClick) {
              onEntryClick(entry);
            }
          }}
        >
          <rect
            x={x}
            y={20}
            width={blockWidth}
            height={60}
            fill={color}
            stroke="#333"
            strokeWidth={1}
            rx={4}
          />
          <text
            x={x + blockWidth / 2}
            y={55}
            textAnchor="middle"
            fill="white"
            fontSize={12}
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {entry.label}
          </text>
        </g>
      );
    });
  }, [timeEntries, dayStart, onEntryClick, categoryMap]);

  // Render drag selection
  const dragSelection = useMemo(() => {
    if (dragStart === null || dragEnd === null) return null;

    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    const x = timeToX(start);
    const blockWidth = timeToX(end) - x;

    return (
      <rect
        x={x}
        y={20}
        width={blockWidth}
        height={60}
        fill="rgba(33, 150, 243, 0.3)"
        stroke="#2196F3"
        strokeWidth={2}
        strokeDasharray="5,5"
        rx={4}
      />
    );
  }, [dragStart, dragEnd, dayStart]);

  return (
    <div style={{ padding: '20px' }}>
      <svg
        width={width}
        height={height}
        style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background */}
        <rect width={width} height={height} fill="#f5f5f5" />

        {/* Hour markers */}
        {Array.from({ length: 25 }, (_, i) => {
          const x = (i / 24) * width;
          return (
            <g key={i}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke="#ddd"
                strokeWidth={1}
              />
              <text
                x={x}
                y={15}
                textAnchor="middle"
                fontSize={10}
                fill="#666"
              >
                {i}:00
              </text>
            </g>
          );
        })}

        {/* Time blocks */}
        {timeBlocks}

        {/* Drag selection */}
        {dragSelection}
      </svg>
    </div>
  );
});

Timeline.displayName = 'Timeline';
