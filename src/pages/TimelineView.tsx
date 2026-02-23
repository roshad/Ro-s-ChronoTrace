import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-shell';
import { ProcessRun, Timeline } from '../components/timeline/Timeline';
import { EntryDialog } from '../components/timeline/EntryDialog';
import { EditEntryDialog } from '../components/timeline/EditEntryDialog';
import { Navigation } from '../components/timeline/Navigation';
import { HoverInsightsTooltip } from '../components/timeline/HoverInsightsTooltip';
import { TodaySearchBar } from '../components/search/TodaySearchBar';
import { ExportButton } from '../components/export/ExportButton';
import { useTimelineStore } from '../services/store';
import { api, ScreenshotSettings, TimeEntry, TimeEntryInput, TimeEntryUpdate } from '../services/api';
import { TimerInput } from '../components/timeline/TimerInput';
import { checkAndInstallUpdate, relaunchApp, toUpdaterErrorMessage } from '../services/updater';

export const TimelineView: React.FC = () => {
  const { selectedDate, setSelectedDate, activeTimer, startTimer, stopTimer } = useTimelineStore();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogRange, setDialogRange] = useState<{ start: number; end: number } | null>(null);
  const [dialogInitialLabel, setDialogInitialLabel] = useState('');
  const [dialogSource, setDialogSource] = useState<'timeline' | 'process'>('timeline');
  const [hoverCard, setHoverCard] = useState<{
    point: { x: number; y: number };
    timestamp: number;
    rangeStart: number;
    rangeEnd: number;
    entryLabel?: string;
    categoryName?: string;
    screenshot?: { filePath?: string; dataUrl?: string };
    items: Array<{ processName: string; seconds: number; percent: number }>;
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editEntryError, setEditEntryError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<ScreenshotSettings>({
    quality: 40,
    max_width: 960,
    max_file_kb: 50,
    storage_dir: '',
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const hoverRequestIdRef = useRef(0);
  const hoverAnchorYRef = useRef<number | null>(null);
  const hoverDebounceTimerRef = useRef<number | null>(null);
  const tooltipHideTimerRef = useRef<number | null>(null);
  const isTimelineHoveringRef = useRef(false);
  const isTooltipHoveringRef = useRef(false);
  const [isTooltipFading, setIsTooltipFading] = useState(false);

  const queryClient = useQueryClient();
  const dayTimestamp = new Date(selectedDate).setHours(0, 0, 0, 0);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const isSelectedDayToday = dayTimestamp === todayStart;

  const invalidateEntryDerivedQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['timeEntries', dayTimestamp] });
    queryClient.invalidateQueries({ queryKey: ['statsEntries'] });
  }, [queryClient, dayTimestamp]);

  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ['timeEntries', dayTimestamp],
    queryFn: () => api.getTimeEntries(dayTimestamp),
  });

  const { data: screenshotSettings } = useQuery({
    queryKey: ['screenshotSettings'],
    queryFn: () => api.getScreenshotSettings(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: screenshotTimestamps = [] } = useQuery({
    queryKey: ['screenshotTimestamps', dayTimestamp],
    queryFn: () => api.getScreenshotTimestampsForDay(dayTimestamp),
    // Background capture writes every 5 minutes; poll current day so markers appear without date switching.
    refetchInterval: isSelectedDayToday ? 15000 : false,
    refetchOnWindowFocus: true,
  });

  const { data: processSamples = [] } = useQuery({
    queryKey: ['processSamples', dayTimestamp],
    queryFn: () => api.getProcessSamplesForDay(dayTimestamp),
    refetchInterval: isSelectedDayToday ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const sortedProcessSamples = React.useMemo(
    () => [...processSamples].sort((a, b) => a.timestamp - b.timestamp),
    [processSamples]
  );

  const categoryNameMap = React.useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const aggregateProcessUsage = React.useCallback((start: number, end: number) => {
    if (end <= start) {
      return new Map<string, number>();
    }

    const buckets = new Map<string, number>();
    for (let i = 0; i < sortedProcessSamples.length; i += 1) {
      const sample = sortedProcessSamples[i];
      const nextTs = sortedProcessSamples[i + 1]?.timestamp ?? (sample.timestamp + 1000);
      const overlapStart = Math.max(start, sample.timestamp);
      const overlapEnd = Math.min(end, nextTs);
      if (overlapEnd <= overlapStart) {
        continue;
      }
      const seconds = Math.max(1, Math.round((overlapEnd - overlapStart) / 1000));
      buckets.set(sample.process_name, (buckets.get(sample.process_name) ?? 0) + seconds);
    }

    return buckets;
  }, [sortedProcessSamples]);

  const processRuns = React.useMemo<ProcessRun[]>(() => {
    if (sortedProcessSamples.length === 0) {
      return [];
    }

    const colorForProcess = (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue} 58% 46%)`;
    };

    const dayEnd = dayTimestamp + 86400000;
    const viewWindowEnd = isSelectedDayToday ? Math.min(dayEnd, Date.now()) : dayEnd;
    const firstSampleTs = sortedProcessSamples[0].timestamp;
    const lastSampleTs = sortedProcessSamples[sortedProcessSamples.length - 1].timestamp;
    const windowStart = Math.max(dayTimestamp, firstSampleTs);
    const windowEnd = Math.min(viewWindowEnd, lastSampleTs + 1000);

    if (windowEnd <= windowStart) {
      return [];
    }

    const clippedEntries = timeEntries
      .filter((entry) => entry.end_time > windowStart && entry.start_time < windowEnd)
      .map((entry) => ({
        start: Math.max(windowStart, entry.start_time),
        end: Math.min(windowEnd, entry.end_time),
      }))
      .sort((a, b) => a.start - b.start);

    const gaps: Array<{ start: number; end: number }> = [];
    let cursor = windowStart;
    for (const entry of clippedEntries) {
      if (entry.start > cursor) {
        gaps.push({ start: cursor, end: entry.start });
      }
      cursor = Math.max(cursor, entry.end);
    }
    if (cursor < windowEnd) {
      gaps.push({ start: cursor, end: windowEnd });
    }

    const runs: ProcessRun[] = gaps
      .map((gap) => {
        const usage = aggregateProcessUsage(gap.start, gap.end);
        if (usage.size === 0) {
          return null;
        }

        const top = Array.from(usage.entries()).sort((a, b) => b[1] - a[1])[0];
        if (!top) {
          return null;
        }

        const [processName] = top;
        return {
          startTime: gap.start,
          endTime: gap.end,
          processName,
          color: colorForProcess(processName),
        } as ProcessRun;
      })
      .filter((run): run is ProcessRun => Boolean(run));

    return runs.filter((run) => run.endTime > run.startTime);
  }, [sortedProcessSamples, dayTimestamp, isSelectedDayToday, timeEntries, aggregateProcessUsage]);

  const latestStartableEntry = React.useMemo(() => {
    if (timeEntries.length === 0) {
      return null;
    }
    return [...timeEntries].sort((a, b) => {
      if (b.end_time !== a.end_time) {
        return b.end_time - a.end_time;
      }
      if (b.start_time !== a.start_time) {
        return b.start_time - a.start_time;
      }
      return b.id - a.id;
    })[0];
  }, [timeEntries]);

  useEffect(() => {
    if (!screenshotSettings) {
      return;
    }
    setSettingsForm({
      quality: screenshotSettings.quality,
      max_width: screenshotSettings.max_width,
      max_file_kb: screenshotSettings.max_file_kb,
      storage_dir: screenshotSettings.storage_dir ?? '',
    });
  }, [screenshotSettings]);

  const createMutation = useMutation({
    mutationFn: (entry: TimeEntryInput) => api.createTimeEntry(entry),
    onSuccess: () => {
      invalidateEntryDerivedQueries();
      setShowDialog(false);
      setDialogRange(null);
      setDialogInitialLabel('');
      setDialogSource('timeline');
    },
    onError: (error) => {
      console.error('Failed to create time entry:', error);
      alert(`创建时间条目失败：${error}`);
    },
  });

  const formatUpdateEntryError = (error: unknown): string => {
    const message = String(error ?? '');
    if (message.includes('No updates provided')) {
      return '未检测到可保存的修改。';
    }
    if (message.includes('Time entry overlaps with an existing entry')) {
      return '时间与现有条目重叠，请调整开始/结束时间。';
    }
    if (message.includes('end_time must be greater than start_time')) {
      return '结束时间必须晚于开始时间。';
    }
    return `更新条目失败：${message}`;
  };

  const isMissingTimeEntryError = (error: unknown): boolean => {
    const message = String(error ?? '');
    return message.includes('Failed to fetch time entry') && message.includes('Query returned no rows');
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: TimeEntryUpdate }) => api.updateTimeEntry(id, updates),
    onSuccess: () => {
      invalidateEntryDerivedQueries();
      setEditEntryError(null);
      setEditingEntry(null);
    },
    onError: (error) => {
      console.error('Failed to update time entry:', error);
      setEditEntryError(formatUpdateEntryError(error));
    },
  });

  const timerUpdateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: TimeEntryUpdate }) => api.updateTimeEntry(id, updates),
    onSuccess: () => {
      invalidateEntryDerivedQueries();
    },
    onError: (error) => {
      if (isMissingTimeEntryError(error)) {
        stopTimer();
        invalidateEntryDerivedQueries();
        console.warn('Running timer entry no longer exists. Stopped active timer.');
        return;
      }
      console.error('Failed to update running timer entry:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTimeEntry(id),
    onSuccess: (_, deletedId) => {
      if (activeTimer?.entryId === deletedId) {
        stopTimer();
      }
      invalidateEntryDerivedQueries();
      setEditingEntry(null);
    },
    onError: (error) => {
      console.error('Failed to delete time entry:', error);
      alert(`删除条目失败：${error}`);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: ScreenshotSettings) => api.updateScreenshotSettings(settings),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['screenshotSettings'] });
      setSettingsForm({
        quality: saved.quality,
        max_width: saved.max_width,
        max_file_kb: saved.max_file_kb,
        storage_dir: saved.storage_dir ?? '',
      });
      alert('截图设置已保存，新设置将在下一次自动截图时生效。');
      setShowSettings(false);
    },
    onError: (error) => {
      console.error('Failed to update screenshot settings:', error);
      alert(`保存截图设置失败：${error}`);
    },
  });

  const handleDragSelect = (start: number, end: number) => {
    setDialogRange({ start, end });
    setDialogInitialLabel('');
    setDialogSource('timeline');
    setShowDialog(true);
  };

  const handleCreateEntry = (entry: TimeEntryInput) => {
    createMutation.mutate(entry);
  };

  const handleEntryClick = (entry: TimeEntry) => {
    setEditEntryError(null);
    setEditingEntry(entry);
  };

  const handleUpdateEntry = (id: number, updates: TimeEntryUpdate) => {
    updateMutation.mutate({ id, updates });
  };

  const handleEntryRangeChange = (entry: TimeEntry, start: number, end: number) => {
    if (activeTimer?.entryId === entry.id) {
      alert('请先停止当前计时，再拖拽调整该条目的时间范围。');
      return;
    }

    updateMutation.mutate(
      {
        id: entry.id,
        updates: {
          start_time: start,
          end_time: end,
        },
      },
      {
        onError: (error) => {
          alert(formatUpdateEntryError(error));
        },
      }
    );
  };

  const handleDeleteEntry = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleRestartEntry = async (entry: TimeEntry) => {
    if (latestStartableEntry && entry.id !== latestStartableEntry.id) {
      alert('只有最后一个行为条目可以开始。');
      return;
    }

    if (activeTimer) {
      alert('请先停止当前计时，再开始其他条目。');
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
        startTime: now,
        label: entry.label,
        categoryId: entry.category_id,
      });

      setEditingEntry(null);
    } catch (error) {
      console.error('Failed to start entry:', error);
      alert(`开始条目失败：${error}`);
    }
  };

  const handleStartTimer = async (label: string, startTime: number, categoryId?: number): Promise<number> => {
    const entry = await createMutation.mutateAsync({
      label,
      start_time: startTime,
      end_time: startTime + 1000,
      category_id: categoryId,
    });
    return entry.id;
  };

  const handleStartFromDialog = async (draft: { label: string; categoryId?: number }) => {
    if (activeTimer) {
      alert('请先停止当前计时，再开始新的行为。');
      return;
    }

    const trimmedLabel = draft.label.trim();
    if (!trimmedLabel) {
      alert('请输入行为标签后再开始。');
      return;
    }

    const now = Date.now();
    try {
      const entryId = await handleStartTimer(trimmedLabel, now, draft.categoryId);
      startTimer({
        entryId,
        startTime: now,
        label: trimmedLabel,
        categoryId: draft.categoryId,
      });
      setShowDialog(false);
      setDialogRange(null);
      setDialogInitialLabel('');
      setDialogSource('timeline');
    } catch (error) {
      console.error('Failed to start timer from entry dialog:', error);
      alert(`开始计时失败：${error}`);
    }
  };

  const handleStopTimer = async (entryId: number, endTime: number): Promise<void> => {
    await timerUpdateMutation.mutateAsync({
      id: entryId,
      updates: { end_time: endTime },
    });
  };

  const handleUpdateTimerLabel = async (entryId: number, label: string): Promise<void> => {
    await timerUpdateMutation.mutateAsync({
      id: entryId,
      updates: { label },
    });
  };

  const handleUpdateTimerCategory = async (entryId: number, categoryId?: number): Promise<void> => {
    await timerUpdateMutation.mutateAsync({
      id: entryId,
      updates: { category_id: categoryId ?? null },
    });
  };

  const findTimeEntryAt = (timestamp: number) => (
    timeEntries.find((entry) => timestamp >= entry.start_time && timestamp < entry.end_time)
  );

  const findRunAt = (timestamp: number) => (
    processRuns.find((run) => timestamp >= run.startTime && timestamp < run.endTime)
  );

  const resolvedHoverEntry = React.useMemo(() => {
    if (!hoverCard) {
      return undefined;
    }
    return timeEntries.find(
      (entry) => hoverCard.timestamp >= entry.start_time && hoverCard.timestamp < entry.end_time
    );
  }, [hoverCard, timeEntries]);

  const resolvedHoverLabel = resolvedHoverEntry?.label ?? hoverCard?.entryLabel;
  const resolvedHoverCategoryName = resolvedHoverEntry
    ? (resolvedHoverEntry.category_id != null ? categoryNameMap.get(resolvedHoverEntry.category_id) : undefined)
    : hoverCard?.categoryName;

  const computeTopProcesses = (start: number, end: number) => {
    const buckets = aggregateProcessUsage(start, end);

    const total = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return [];
    }

    return Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([processName, seconds]) => ({
        processName,
        seconds,
        percent: (seconds / total) * 100,
      }));
  };

  const findGapContainingPoint = (point: number, rangeStart: number, rangeEnd: number) => {
    const overlaps = timeEntries
      .filter((entry) => entry.end_time > rangeStart && entry.start_time < rangeEnd)
      .map((entry) => ({
        start: Math.max(rangeStart, entry.start_time),
        end: Math.min(rangeEnd, entry.end_time),
      }))
      .sort((a, b) => a.start - b.start);

    if (overlaps.some((o) => point >= o.start && point < o.end)) {
      return null;
    }

    let cursor = rangeStart;
    for (const overlap of overlaps) {
      if (point >= cursor && point < overlap.start) {
        return { start: cursor, end: overlap.start };
      }
      cursor = Math.max(cursor, overlap.end);
    }
    if (point >= cursor && point < rangeEnd) {
      return { start: cursor, end: rangeEnd };
    }
    return null;
  };

  const handleProcessBarHover = (payload: { timestamp: number; clientX: number; clientY: number }) => {
    handleHover(payload);
  };

  const handleProcessBarLeave = () => {
    // no-op: keep unified hover tooltip behavior consistent with timeline hover
  };

  const handleProcessBarClick = (payload: { timestamp: number; clientX: number; clientY: number }) => {
    if (findTimeEntryAt(payload.timestamp)) {
      alert('该时间点已有行为条目。');
      return;
    }
    const run = findRunAt(payload.timestamp);
    if (!run) {
      alert('当前时间点无进程数据。');
      return;
    }

    const gap = findGapContainingPoint(payload.timestamp, run.startTime, run.endTime);
    if (!gap || gap.end - gap.start < 60000) {
      alert('该时间点没有可创建的空白区间。');
      return;
    }

    const topProcesses = computeTopProcesses(gap.start, gap.end);
    setDialogInitialLabel(topProcesses[0]?.processName ?? run.processName);
    setDialogRange(gap);
    setDialogSource('process');
    setShowDialog(true);
  };

  const handleHover = (payload: { timestamp: number; clientX: number; clientY: number }) => {
    isTimelineHoveringRef.current = true;

    if (tooltipHideTimerRef.current) {
      window.clearTimeout(tooltipHideTimerRef.current);
      tooltipHideTimerRef.current = null;
    }
    setIsTooltipFading(false);

    if (isTooltipHoveringRef.current) {
      return;
    }

    if (hoverDebounceTimerRef.current) {
      window.clearTimeout(hoverDebounceTimerRef.current);
    }

    hoverDebounceTimerRef.current = window.setTimeout(async () => {
      const requestId = ++hoverRequestIdRef.current;
      const entry = findTimeEntryAt(payload.timestamp);
      const run = findRunAt(payload.timestamp);
      if (!entry && !run) {
        setHoverCard(null);
        hoverAnchorYRef.current = null;
        setIsTooltipFading(false);
        return;
      }
      const safeRun = run!;
      const rangeStart = entry
        ? entry.start_time
        : safeRun.startTime;
      const rangeEnd = entry
        ? entry.end_time
        : safeRun.endTime;
      const entryLabel = entry?.label;
      const categoryName = entry?.category_id != null
        ? categoryNameMap.get(entry.category_id)
        : undefined;
      const items = computeTopProcesses(rangeStart, rangeEnd);

      try {
        const screenshot = await api.getScreenshotForTime(payload.timestamp);
        if (requestId !== hoverRequestIdRef.current || isTooltipHoveringRef.current) {
          return;
        }
        setHoverCard({
          point: {
            x: payload.clientX,
            y: hoverAnchorYRef.current ?? payload.clientY,
          },
          timestamp: payload.timestamp,
          rangeStart,
          rangeEnd,
          entryLabel,
          categoryName,
          screenshot: {
            filePath: screenshot.file_path,
            dataUrl: screenshot.data_url,
          },
          items,
        });
        if (hoverAnchorYRef.current === null) {
          hoverAnchorYRef.current = payload.clientY;
        }
        setIsTooltipFading(false);
      } catch (error) {
        if (requestId !== hoverRequestIdRef.current || isTooltipHoveringRef.current) {
          return;
        }

        console.error('Failed to fetch screenshot:', error);
        setHoverCard({
          point: {
            x: payload.clientX,
            y: hoverAnchorYRef.current ?? payload.clientY,
          },
          timestamp: payload.timestamp,
          rangeStart,
          rangeEnd,
          entryLabel,
          categoryName,
          screenshot: undefined,
          items,
        });
        if (hoverAnchorYRef.current === null) {
          hoverAnchorYRef.current = payload.clientY;
        }
        setIsTooltipFading(false);
      }
    }, 120);
  };

  const startTooltipHideTimer = () => {
    setIsTooltipFading(true);
    if (tooltipHideTimerRef.current) {
      window.clearTimeout(tooltipHideTimerRef.current);
    }
    tooltipHideTimerRef.current = window.setTimeout(() => {
      setHoverCard(null);
      hoverAnchorYRef.current = null;
      setIsTooltipFading(false);
      tooltipHideTimerRef.current = null;
    }, 500);
  };

  const handleHoverEnd = () => {
    isTimelineHoveringRef.current = false;
    hoverRequestIdRef.current += 1;
    if (hoverDebounceTimerRef.current) {
      window.clearTimeout(hoverDebounceTimerRef.current);
      hoverDebounceTimerRef.current = null;
    }
    if (!isTooltipHoveringRef.current && hoverCard) {
      startTooltipHideTimer();
    }
  };

  const handleTooltipMouseEnter = () => {
    isTooltipHoveringRef.current = true;
    if (tooltipHideTimerRef.current) {
      window.clearTimeout(tooltipHideTimerRef.current);
      tooltipHideTimerRef.current = null;
    }
    setIsTooltipFading(false);
  };

  const handleTooltipMouseLeave = () => {
    isTooltipHoveringRef.current = false;
    if (!isTimelineHoveringRef.current && hoverCard) {
      startTooltipHideTimer();
    }
  };

  const resolveScreenshotPath = async (storedPath: string): Promise<string> => (
    api.resolveScreenshotFilePath(storedPath)
  );

  const resolveScreenshotStorageRoot = async (configuredStorageDir?: string): Promise<string> => (
    api.resolveScreenshotStorageDir(configuredStorageDir)
  );

  const handleOpenHoveredScreenshot = async () => {
    if (!hoverCard?.screenshot?.filePath) {
      console.warn('Current screenshot cannot be opened directly because file path is unavailable.');
      return;
    }

    try {
      const absolutePath = await resolveScreenshotPath(hoverCard.screenshot.filePath);
      const normalizedPath = absolutePath.replace(/\\/g, '/');
      const fileUrl = /^[a-zA-Z]:\//.test(normalizedPath)
        ? `file:///${normalizedPath}`
        : `file://${normalizedPath}`;

      try {
        await open(fileUrl);
      } catch {
        await open(absolutePath);
      }
    } catch (error) {
      console.error('Failed to open screenshot file:', error);
    }
  };

  const handleOpenScreenshotStorageDir = async () => {
    try {
      const rootDir = await resolveScreenshotStorageRoot(settingsForm.storage_dir);
      const normalizedPath = rootDir.replace(/\\/g, '/');
      const fileUrl = /^[a-zA-Z]:\//.test(normalizedPath)
        ? `file:///${normalizedPath}`
        : `file://${normalizedPath}`;

      try {
        await open(fileUrl);
      } catch {
        await open(rootDir);
      }
    } catch (error) {
      console.error('Failed to open screenshot storage directory:', error);
    }
  };

  const getTooltipPosition = (point: { x: number; y: number }) => {
    const tooltipWidth = 340;
    const tooltipHeight = 290;
    const gap = 14;
    const margin = 10;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const maxX = Math.max(margin, window.innerWidth - tooltipWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - tooltipHeight - margin);

    let x = clamp(point.x + gap, margin, maxX);
    let y = clamp(point.y + gap, margin, maxY);

    const timelineScrollContainer = document.querySelector<HTMLElement>('[data-testid="timeline-scroll-container"]');
    if (!timelineScrollContainer) {
      return { x, y };
    }

    const timelineRect = timelineScrollContainer.getBoundingClientRect();
    const overlapAreaAt = (candidateX: number, candidateY: number) => {
      const tooltipLeft = candidateX;
      const tooltipRight = candidateX + tooltipWidth;
      const tooltipTop = candidateY;
      const tooltipBottom = candidateY + tooltipHeight;

      const overlapWidth = Math.max(
        0,
        Math.min(tooltipRight, timelineRect.right) - Math.max(tooltipLeft, timelineRect.left)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(tooltipBottom, timelineRect.bottom) - Math.max(tooltipTop, timelineRect.top)
      );

      return overlapWidth * overlapHeight;
    };

    if (overlapAreaAt(x, y) === 0) {
      return { x, y };
    }

    const candidateAboveY = clamp(timelineRect.top - tooltipHeight - gap, margin, maxY);
    const candidateBelowY = clamp(timelineRect.bottom + gap, margin, maxY);
    const aboveOverlap = overlapAreaAt(x, candidateAboveY);
    const belowOverlap = overlapAreaAt(x, candidateBelowY);

    if (aboveOverlap === 0 && belowOverlap === 0) {
      y = Math.abs(point.y - candidateAboveY) <= Math.abs(point.y - candidateBelowY)
        ? candidateAboveY
        : candidateBelowY;
    } else if (aboveOverlap === 0 || belowOverlap === 0) {
      y = aboveOverlap === 0 ? candidateAboveY : candidateBelowY;
    } else {
      y = aboveOverlap <= belowOverlap ? candidateAboveY : candidateBelowY;
    }

    if (overlapAreaAt(x, y) === 0) {
      return { x, y };
    }

    const candidateLeftX = clamp(timelineRect.left - tooltipWidth - gap, margin, maxX);
    const candidateRightX = clamp(timelineRect.right + gap, margin, maxX);
    const leftOverlap = overlapAreaAt(candidateLeftX, y);
    const rightOverlap = overlapAreaAt(candidateRightX, y);

    if (leftOverlap === rightOverlap) {
      x = Math.abs(point.x - candidateLeftX) <= Math.abs(point.x - candidateRightX)
        ? candidateLeftX
        : candidateRightX;
    } else {
      x = leftOverlap < rightOverlap ? candidateLeftX : candidateRightX;
    }

    return { x, y };
  };

  useEffect(() => {
    return () => {
      if (hoverDebounceTimerRef.current) {
        window.clearTimeout(hoverDebounceTimerRef.current);
      }
      if (tooltipHideTimerRef.current) {
        window.clearTimeout(tooltipHideTimerRef.current);
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

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkAndInstallUpdate();
      if (result.status === 'no-update') {
        alert('当前已是最新版本。');
        return;
      }

      alert(`检测到新版本 ${result.targetVersion}（当前 ${result.currentVersion}），已下载安装，应用将重启。`);
      await relaunchApp();
    } catch (error) {
      console.error('Manual update check/install failed:', error);
      alert(`手动检测更新失败：${toUpdaterErrorMessage(error)}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSaveSettings = () => {
    const quality = Number(settingsForm.quality);
    const maxWidth = Number(settingsForm.max_width);
    const maxFileKb = Number(settingsForm.max_file_kb);

    if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
      alert('质量必须在 1-100 之间。');
      return;
    }
    if (!Number.isFinite(maxWidth) || maxWidth < 640 || maxWidth > 7680) {
      alert('截图最大宽度必须在 640-7680 之间。');
      return;
    }
    if (!Number.isFinite(maxFileKb) || maxFileKb < 20 || maxFileKb > 2048) {
      alert('目标大小必须在 20-2048 KB 之间。');
      return;
    }

    updateSettingsMutation.mutate({
      quality,
      max_width: maxWidth,
      max_file_kb: maxFileKb,
      storage_dir: settingsForm.storage_dir?.trim() || undefined,
    });
  };

  const canStartEditingEntry = Boolean(
    editingEntry && latestStartableEntry && editingEntry.id === latestStartableEntry.id
  );

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="app-toolbar">
          <ExportButton />

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="btn btn-secondary btn-sm"
            aria-label="打开截图设置"
            title="截图设置"
          >
            设置
          </button>

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
          <TimerInput
            onStart={handleStartTimer}
            onStop={handleStopTimer}
            onUpdateLabel={handleUpdateTimerLabel}
            onUpdateCategory={handleUpdateTimerCategory}
          />
          <Timeline
            date={selectedDate}
            timeEntries={timeEntries}
            screenshotTimestamps={screenshotTimestamps}
            processRuns={processRuns}
            onDragSelect={handleDragSelect}
            onEntryRangeChange={handleEntryRangeChange}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
            onEntryClick={handleEntryClick}
            onProcessBarHover={handleProcessBarHover}
            onProcessBarLeave={handleProcessBarLeave}
            onProcessBarClick={handleProcessBarClick}
          />

          {hoverCard && (
            <HoverInsightsTooltip
              position={getTooltipPosition(hoverCard.point)}
              timestamp={hoverCard.timestamp}
              rangeStart={hoverCard.rangeStart}
              rangeEnd={hoverCard.rangeEnd}
              entryLabel={resolvedHoverLabel}
              categoryName={resolvedHoverCategoryName}
              filePath={hoverCard.screenshot?.filePath}
              dataUrl={hoverCard.screenshot?.dataUrl}
              processItems={hoverCard.items}
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
              onImageClick={handleOpenHoveredScreenshot}
              isFading={isTooltipFading}
            />
          )}

          <TodaySearchBar date={selectedDate} />
        </>
      )}

      {showDialog && dialogRange && (
        <EntryDialog
          startTime={dialogRange.start}
          endTime={dialogRange.end}
          initialLabel={dialogInitialLabel}
          onSubmit={handleCreateEntry}
          onStart={handleStartFromDialog}
          showStartAction={dialogSource === 'process'}
          onCancel={() => {
            setShowDialog(false);
            setDialogRange(null);
            setDialogInitialLabel('');
            setDialogSource('timeline');
          }}
        />
      )}

      {editingEntry && (
        <EditEntryDialog
          entry={editingEntry}
          onSave={handleUpdateEntry}
          onDelete={handleDeleteEntry}
          onRestart={handleRestartEntry}
          canStart={canStartEditingEntry}
          onCancel={() => {
            setEditEntryError(null);
            setEditingEntry(null);
          }}
          errorMessage={editEntryError}
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
                  <li>在时间轴上按住鼠标拖拽，可快速创建条目。</li>
                  <li>拖拽已有条目左右边缘，可快速调整时间范围。</li>
                  <li>点击已有条目，可编辑、删除；仅最后一个条目可直接开始计时。</li>
                  <li>鼠标悬停时间轴，可查看对应时间的截图预览。</li>
                </ul>
              </div>
              <div>
                <strong>缩放与滚动</strong>
                <ul>
                  <li>`Ctrl` / `Cmd` + 鼠标滚轮：缩放视野（4-24 小时）。</li>
                  <li>鼠标滚轮：横向滚动时间轴。</li>
                  <li>也可拖动“时间轴缩放”滑块精细调整。</li>
                </ul>
              </div>
              <div>
                <strong>快捷操作</strong>
                <ul>
                  <li>在计时输入框按 `Enter`：开始或停止计时。</li>
                  <li>使用“前一天 / 今天 / 后一天”快速切换日期。</li>
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

      {showSettings && (
        <div className="dialog-overlay" onClick={() => setShowSettings(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">截图设置</h2>
            <div className="field">
              <label className="field-label">应用更新</label>
              <div className="field-help">启动时会自动检查更新；你也可以手动触发检查。</div>
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleManualCheckUpdate()}
                  disabled={isCheckingUpdate || updateSettingsMutation.isPending}
                >
                  {isCheckingUpdate ? '检测中...' : '手动检测更新'}
                </button>
              </div>
            </div>
            <div className="stack-col">
              <div className="field">
                <label className="field-label">WebP 质量（1-100）</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settingsForm.quality}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, quality: Number(e.target.value) }))}
                  className="input"
                />
              </div>

              <div className="field">
                <label className="field-label">截图最大宽度（像素）</label>
                <input
                  type="number"
                  min={640}
                  max={7680}
                  step={10}
                  value={settingsForm.max_width}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, max_width: Number(e.target.value) }))}
                  className="input"
                />
                <div className="field-help">宽度越小，体积越小；高度会按比例缩放。</div>
              </div>

              <div className="field">
                <label className="field-label">目标大小（KB）</label>
                <input
                  type="number"
                  min={20}
                  max={2048}
                  value={settingsForm.max_file_kb}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, max_file_kb: Number(e.target.value) }))}
                  className="input"
                />
                <div className="field-help">系统会尽量压缩到该大小以下（复杂画面可能略超）。</div>
              </div>

              <div className="field">
                <label className="field-label">截图存储目录（留空使用默认）</label>
                <input
                  type="text"
                  value={settingsForm.storage_dir ?? ''}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, storage_dir: e.target.value }))}
                  className="input"
                  placeholder="例如：D:\\RosChronoTraceShots"
                />
                <div className="field-help">默认目录：`%LOCALAPPDATA%\\RosChronoTrace\\screenshots`</div>
              </div>
            </div>

            <div className="dialog-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenScreenshotStorageDir}
                disabled={updateSettingsMutation.isPending}
              >
                打开存储目录
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSettingsForm((prev) => ({ ...prev, storage_dir: '' }))}
                disabled={updateSettingsMutation.isPending}
              >
                使用默认目录
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowSettings(false)}
                disabled={updateSettingsMutation.isPending}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


