import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const HOURS_IN_DAY = 24;
  const MIN_VISIBLE_HOURS = 4;
  const MAX_VISIBLE_HOURS = 24;
  const height = 100;
  const dayStart = new Date(date).setHours(0, 0, 0, 0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingZoomAnchorRef = useRef<{ ratio: number; viewportOffset: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleHours, setVisibleHours] = useState(MAX_VISIBLE_HOURS);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.color));
    return map;
  }, [categories]);

  const timelineWidth = useMemo(() => {
    if (containerWidth <= 0) {
      return 1200;
    }
    return (containerWidth * HOURS_IN_DAY) / visibleHours;
  }, [containerWidth, visibleHours]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => setContainerWidth(container.clientWidth);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Convert time to x position
  const timeToX = (timestamp: number) => {
    const offset = timestamp - dayStart;
    return (offset / 86400000) * timelineWidth;
  };

  // Convert x position to timestamp
  const xToTime = (x: number) => {
    const clampedX = Math.max(0, Math.min(x, timelineWidth));
    return Math.round(dayStart + (clampedX / timelineWidth) * 86400000);
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

  const handleZoomChange = (nextVisibleHours: number) => {
    const boundedHours = Math.max(MIN_VISIBLE_HOURS, Math.min(nextVisibleHours, MAX_VISIBLE_HOURS));
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && timelineWidth > 0 && boundedHours !== visibleHours) {
      const viewportOffset = scrollContainer.clientWidth / 2;
      const anchorX = scrollContainer.scrollLeft + viewportOffset;
      pendingZoomAnchorRef.current = {
        ratio: anchorX / timelineWidth,
        viewportOffset,
      };
    }
    setVisibleHours(boundedHours);
  };

  const handleScrollWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportOffset = Math.max(0, Math.min(e.clientX - rect.left, scrollContainer.clientWidth));
      const anchorX = scrollContainer.scrollLeft + viewportOffset;
      const zoomDirection = e.deltaY > 0 ? 1 : -1;

      setVisibleHours((current) => {
        const next = Math.max(MIN_VISIBLE_HOURS, Math.min(current + zoomDirection, MAX_VISIBLE_HOURS));
        if (next === current || timelineWidth <= 0) {
          return current;
        }

        pendingZoomAnchorRef.current = {
          ratio: anchorX / timelineWidth,
          viewportOffset,
        };
        return next;
      });
      return;
    }

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollContainer.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const anchor = pendingZoomAnchorRef.current;
    if (!scrollContainer || !anchor) {
      return;
    }

    const maxScrollLeft = Math.max(0, timelineWidth - scrollContainer.clientWidth);
    const targetScrollLeft = Math.max(
      0,
      Math.min(
        maxScrollLeft,
        (anchor.ratio * timelineWidth) - anchor.viewportOffset
      )
    );
    scrollContainer.scrollLeft = targetScrollLeft;
    pendingZoomAnchorRef.current = null;
  }, [timelineWidth]);

  // Render time blocks
  const timeBlocks = useMemo(() => {
    return timeEntries.map((entry) => {
      const x = timeToX(entry.start_time);
      const blockWidth = Math.max(timeToX(entry.end_time) - x, 1);
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
            style={{ pointerEvents: 'none', display: blockWidth >= 36 ? 'block' : 'none' }}
          >
            {entry.label}
          </text>
        </g>
      );
    });
  }, [timeEntries, onEntryClick, categoryMap, timelineWidth]);

  // Render drag selection
  const dragSelection = useMemo(() => {
    if (dragStart === null || dragEnd === null) return null;

    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    const x = timeToX(start);
    const blockWidth = Math.max(timeToX(end) - x, 1);

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
  }, [dragStart, dragEnd, timelineWidth]);

  return (
    <div
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
        paddingTop: '12px',
      }}
    >
      <div className="timeline-zoom-row">
        <strong style={{ minWidth: 'fit-content' }}>时间轴缩放</strong>
        <input
          type="range"
          min={MIN_VISIBLE_HOURS}
          max={MAX_VISIBLE_HOURS}
          step={1}
          value={visibleHours}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          className="zoom-slider"
          aria-label="时间轴缩放小时数"
        />
        <span className="small muted">当前视野：{visibleHours} 小时</span>
      </div>

      <div ref={containerRef} style={{ width: '100%' }}>
        <div
          ref={scrollContainerRef}
          data-testid="timeline-scroll-container"
          className="timeline-scroll-container"
          onWheel={handleScrollWheel}
        >
          <svg
            width={timelineWidth}
            height={height}
            style={{ cursor: 'crosshair' }}
            className="timeline-svg"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {/* Background */}
            <rect width={timelineWidth} height={height} fill="var(--surface-soft)" />

            {/* Hour markers */}
            {Array.from({ length: HOURS_IN_DAY + 1 }, (_, i) => {
              const x = (i / HOURS_IN_DAY) * timelineWidth;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={height}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-muted)"
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
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';
