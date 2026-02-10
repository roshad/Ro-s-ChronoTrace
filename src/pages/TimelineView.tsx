import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Timeline } from '../components/timeline/Timeline';
import { EntryDialog } from '../components/timeline/EntryDialog';
import { EditEntryDialog } from '../components/timeline/EditEntryDialog';
import { Navigation } from '../components/timeline/Navigation';
import { ScreenshotPreview } from '../components/timeline/ScreenshotPreview';
import { TodaySearchBar } from '../components/search/TodaySearchBar';
import { ExportButton } from '../components/export/ExportButton';
import { StatusIndicator } from '../components/capture/StatusIndicator';
import { useTimelineStore } from '../services/store';
import { api, TimeEntry, TimeEntryInput, TimeEntryUpdate } from '../services/api';
import { TimerInput } from '../components/timeline/TimerInput';

export const TimelineView: React.FC = () => {
  const { selectedDate, setSelectedDate, activeTimer, startTimer } = useTimelineStore();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogRange, setDialogRange] = useState<{ start: number; end: number } | null>(null);
  const [hoveredScreenshot, setHoveredScreenshot] = useState<{ filePath?: string; dataUrl?: string; timestamp?: number } | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const hoverRequestIdRef = useRef(0);
  const hoverDebounceTimerRef = useRef<number | null>(null);

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
    onError: (error) => {
      console.error('Failed to create time entry:', error);
      alert(`创建时间条目失败：${error}`);
    },
  });

  // Update time entry mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: TimeEntryUpdate }) =>
      api.updateTimeEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', dayTimestamp] });
      setEditingEntry(null);
    },
    onError: (error) => {
      console.error('Failed to update time entry:', error);
      alert(`更新条目失败：${error}`);
    },
  });

  // Timer growth updates should not close edit dialogs.
  const timerUpdateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: TimeEntryUpdate }) =>
      api.updateTimeEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', dayTimestamp] });
    },
    onError: (error) => {
      console.error('Failed to update running timer entry:', error);
    },
  });

  // Delete time entry mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTimeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', dayTimestamp] });
      setEditingEntry(null);
    },
    onError: (error) => {
      console.error('Failed to delete time entry:', error);
      alert(`删除条目失败：${error}`);
    },
  });

  const handleDragSelect = (start: number, end: number) => {
    setDialogRange({ start, end });
    setShowDialog(true);
  };

  const handleCreateEntry = (entry: TimeEntryInput) => {
    console.log('Creating entry:', entry);
    createMutation.mutate(entry);
  };

  const handleEntryClick = (entry: TimeEntry) => {
    setEditingEntry(entry);
  };

  const handleUpdateEntry = (id: number, updates: TimeEntryUpdate) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDeleteEntry = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleRestartEntry = async (entry: TimeEntry) => {
    if (activeTimer) {
      alert('请先停止当前计时，再重新开始其他条目。');
      return;
    }

    const now = Date.now();
    try {
      await timerUpdateMutation.mutateAsync({
        id: entry.id,
        updates: { end_time: now },
      });

      startTimer({
        entryId: entry.id,
        startTime: entry.start_time,
        label: entry.label,
        categoryId: entry.category_id,
      });

      setEditingEntry(null);
    } catch (error) {
      console.error('Failed to restart entry:', error);
      alert(`重新开始条目失败：${error}`);
    }
  };

  const handleStartTimer = async (label: string, startTime: number, categoryId?: number): Promise<number> => {
    const entry = await createMutation.mutateAsync({
      label,
      start_time: startTime,
      // Create with a valid initial duration, then grow by updating end_time.
      end_time: startTime + 1000,
      category_id: categoryId,
    });
    return entry.id;
  };

  const handleStopTimer = async (entryId: number, endTime: number): Promise<void> => {
    await timerUpdateMutation.mutateAsync({
      id: entryId,
      updates: { end_time: endTime },
    });
  };

  const handleHover = (timestamp: number) => {
    if (hoverDebounceTimerRef.current) {
      window.clearTimeout(hoverDebounceTimerRef.current);
    }

    hoverDebounceTimerRef.current = window.setTimeout(async () => {
      const requestId = ++hoverRequestIdRef.current;

      try {
        const screenshot = await api.getScreenshotForTime(timestamp);
        if (requestId !== hoverRequestIdRef.current) {
          return;
        }

        if (screenshot.file_path || screenshot.data_url) {
          setHoveredScreenshot({ filePath: screenshot.file_path, dataUrl: screenshot.data_url, timestamp });
        } else {
          setHoveredScreenshot(null);
        }
      } catch (error) {
        if (requestId !== hoverRequestIdRef.current) {
          return;
        }

        console.error('Failed to fetch screenshot:', error);
        setHoveredScreenshot(null);
      }
    }, 120);
  };

  const handleHoverEnd = () => {
    hoverRequestIdRef.current += 1;
    if (hoverDebounceTimerRef.current) {
      window.clearTimeout(hoverDebounceTimerRef.current);
      hoverDebounceTimerRef.current = null;
    }
    setHoveredScreenshot(null);
  };

  useEffect(() => {
    return () => {
      if (hoverDebounceTimerRef.current) {
        window.clearTimeout(hoverDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    const timerId = window.setInterval(() => {
      timerUpdateMutation.mutate({
        id: activeTimer.entryId,
        updates: { end_time: Date.now() },
      });
    }, 3000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeTimer?.entryId]);

  const navigateDay = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1 className="app-title">数字日志</h1>

        <div className="app-toolbar">
          <StatusIndicator />

          <ExportButton />

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="btn btn-secondary btn-sm"
            aria-label="打开操作帮助"
            title="操作帮助"
          >
            ? 帮助
          </button>

          <Navigation
            selectedDate={selectedDate}
            onPreviousDay={() => navigateDay(-1)}
            onNextDay={() => navigateDay(1)}
            onGoToToday={goToToday}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
      ) : (
        <>
          <TimerInput onStart={handleStartTimer} onStop={handleStopTimer} />
          <Timeline
            date={selectedDate}
            timeEntries={timeEntries}
            onDragSelect={handleDragSelect}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
            onEntryClick={handleEntryClick}
          />

          {hoveredScreenshot && (
            <ScreenshotPreview
              filePath={hoveredScreenshot.filePath}
              dataUrl={hoveredScreenshot.dataUrl}
              timestamp={hoveredScreenshot.timestamp}
            />
          )}

          <div>
            <TodaySearchBar date={selectedDate} />
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

      {editingEntry && (
        <EditEntryDialog
          entry={editingEntry}
          onSave={handleUpdateEntry}
          onDelete={handleDeleteEntry}
          onRestart={handleRestartEntry}
          onCancel={() => setEditingEntry(null)}
        />
      )}

      {showHelp && (
        <div className="dialog-overlay" onClick={() => setShowHelp(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">操作帮助</h2>
            <div className="stack-col">
              <div>
                <strong>时间轴操作</strong>
                <ul>
                  <li>在时间轴上按住鼠标拖拽，可快速创建条目</li>
                  <li>点击已有条目，可编辑、删除或重新开始计时</li>
                  <li>鼠标悬停时间轴，可查看对应时间截图</li>
                </ul>
              </div>
              <div>
                <strong>缩放与滚动</strong>
                <ul>
                  <li>`Ctrl` / `Cmd` + 鼠标滚轮：缩放视野（4-24 小时）</li>
                  <li>鼠标滚轮：横向滚动时间轴</li>
                  <li>也可拖动“时间轴缩放”滑块精细调整</li>
                </ul>
              </div>
              <div>
                <strong>快捷操作</strong>
                <ul>
                  <li>在计时输入框按 `Enter`：开始或停止计时</li>
                  <li>使用“前一天 / 今天 / 后一天”快速切换日期</li>
                </ul>
              </div>
            </div>
            <div className="dialog-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-primary" onClick={() => setShowHelp(false)}>
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
