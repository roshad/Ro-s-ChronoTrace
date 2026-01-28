import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Timeline } from '../components/timeline/Timeline';
import { EntryDialog } from '../components/timeline/EntryDialog';
import { Navigation } from '../components/timeline/Navigation';
import { ScreenshotPreview } from '../components/timeline/ScreenshotPreview';
import { SearchBar } from '../components/search/SearchBar';
import { ExportButton } from '../components/export/ExportButton';
import { StatusIndicator } from '../components/capture/StatusIndicator';
import { useTimelineStore } from '../services/store';
import { api, TimeEntryInput } from '../services/api';

export const TimelineView: React.FC = () => {
  const { selectedDate, setSelectedDate } = useTimelineStore();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogRange, setDialogRange] = useState<{ start: number; end: number } | null>(null);
  const [hoveredScreenshot, setHoveredScreenshot] = useState<{ filePath?: string; timestamp?: number } | null>(null);

  const queryClient = useQueryClient();

  // Get start of day timestamp
  const dayTimestamp = new Date(selectedDate).setHours(0, 0, 0, 0);

  // Fetch time entries for selected date
  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ['timeEntries', dayTimestamp],
    queryFn: () => api.getTimeEntries(dayTimestamp),
  });

  // Create time entry mutation
  const createMutation = useMutation({
    mutationFn: (entry: TimeEntryInput) => api.createTimeEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', dayTimestamp] });
      setShowDialog(false);
      setDialogRange(null);
    },
  });

  const handleDragSelect = (start: number, end: number) => {
    setDialogRange({ start, end });
    setShowDialog(true);
  };

  const handleCreateEntry = (entry: TimeEntryInput) => {
    createMutation.mutate(entry);
  };

  const handleHover = async (timestamp: number) => {
    try {
      const screenshot = await api.getScreenshotForTime(timestamp);
      if (screenshot.file_path) {
        setHoveredScreenshot({ filePath: screenshot.file_path, timestamp });
      } else {
        setHoveredScreenshot(null);
      }
    } catch (error) {
      console.error('Failed to fetch screenshot:', error);
      setHoveredScreenshot(null);
    }
  };

  const navigateDay = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>Digital Diary</h1>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <StatusIndicator />

          <ExportButton />

          <Navigation
            selectedDate={selectedDate}
            onPreviousDay={() => navigateDay(-1)}
            onNextDay={() => navigateDay(1)}
            onGoToToday={goToToday}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : (
        <>
          <Timeline
            date={selectedDate}
            timeEntries={timeEntries}
            onDragSelect={handleDragSelect}
            onHover={handleHover}
          />

          {hoveredScreenshot && (
            <ScreenshotPreview
              filePath={hoveredScreenshot.filePath}
              timestamp={hoveredScreenshot.timestamp}
            />
          )}

          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Instructions</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Click and drag on the timeline to create a new time entry</li>
              <li>Hover over the timeline to see screenshot previews</li>
              <li>Use navigation buttons to view different days</li>
            </ul>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Search Activities</h3>
            <SearchBar />
          </div>
        </>
      )}

      {showDialog && dialogRange && (
        <EntryDialog
          startTime={dialogRange.start}
          endTime={dialogRange.end}
          onSubmit={handleCreateEntry}
          onCancel={() => {
            setShowDialog(false);
            setDialogRange(null);
          }}
        />
      )}
    </div>
  );
};
