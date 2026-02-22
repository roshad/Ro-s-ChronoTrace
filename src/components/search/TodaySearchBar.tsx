import React, { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AppWindow, CheckCircle2, Clock, Search, Star, Trash2 } from 'lucide-react';
import { api, SearchResult, TimeEntry } from '../../services/api';

interface RangeSearchBarProps {
  date: Date;
}

type RangeType = 'day' | 'month' | 'year' | 'all';

const SAVED_SEARCHES_STORAGE_KEY = 'today-search-saved-items';
const MAX_SAVED_SEARCHES = 12;
const LIVE_REFRESH_INTERVAL_MS = 5000;

const getUtf8ByteLength = (value: string): number => {
  const normalized = value.trim();
  let length = 0;
  for (const char of normalized) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }
  return length;
};

const normalizeSavedQueries = (queries: string[]): string[] => {
  const unique = new Set<string>();
  for (const raw of queries) {
    const q = raw.trim();
    if (!q) {
      continue;
    }
    unique.add(q);
    if (unique.size >= MAX_SAVED_SEARCHES) {
      break;
    }
  }
  return Array.from(unique);
};

const getEntryOverlapDurationInRange = (entry: TimeEntry, rangeStart: number, rangeEnd: number) => {
  const overlapStart = Math.max(rangeStart, entry.start_time);
  const overlapEnd = Math.min(rangeEnd, entry.end_time);
  if (overlapEnd <= overlapStart) {
    return 0;
  }
  return overlapEnd - overlapStart;
};

export const TodaySearchBar: React.FC<RangeSearchBarProps> = ({ date }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [range, setRange] = useState<RangeType>('day');
  const [savedQueries, setSavedQueries] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return normalizeSavedQueries(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
      return [];
    }
  });

  const normalizedQuery = debouncedQuery.trim();
  const canSearch = getUtf8ByteLength(debouncedQuery) >= 2;

  const timeRange = useMemo(() => {
    if (range === 'all') {
      return { start: 0, end: 0 };
    }

    const d = new Date(date);
    let start: number;
    let end: number;

    if (range === 'day') {
      start = new Date(d).setHours(0, 0, 0, 0);
      end = start + 86400000;
    } else if (range === 'month') {
      start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    } else {
      start = new Date(d.getFullYear(), 0, 1).getTime();
      end = new Date(d.getFullYear() + 1, 0, 1).getTime();
    }

    return { start, end };
  }, [date, range]);

  const statsRange = useMemo(() => {
    if (range === 'all') {
      return { start: 0, end: Date.now() + 1 };
    }
    return timeRange;
  }, [range, timeRange]);

  const shouldLiveRefresh = useMemo(() => {
    const now = Date.now();
    return now >= statsRange.start && now < statsRange.end;
  }, [statsRange.end, statsRange.start]);
  const liveRefetchInterval: number | false = shouldLiveRefresh ? LIVE_REFRESH_INTERVAL_MS : false;
  const searchRefetchInterval: number | false = canSearch && shouldLiveRefresh ? LIVE_REFRESH_INTERVAL_MS : false;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(savedQueries));
    } catch {
      // Ignore localStorage failures and keep in-memory state usable.
    }
  }, [savedQueries]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['searchRange', timeRange.start, timeRange.end, range, normalizedQuery],
    queryFn: () => {
      if (range === 'all') {
        return api.searchActivities(normalizedQuery);
      }
      return api.searchActivitiesByRange(normalizedQuery, timeRange.start, timeRange.end);
    },
    enabled: canSearch,
    refetchInterval: searchRefetchInterval,
    refetchOnWindowFocus: true,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: statsEntries = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ['statsEntries', range, statsRange.start, statsRange.end],
    queryFn: () => api.getTimeEntriesByRange(statsRange.start, statsRange.end),
    refetchInterval: liveRefetchInterval,
    refetchOnWindowFocus: true,
  });

  const savedSearchQueries = useQueries({
    queries: savedQueries.map((savedQuery) => ({
      queryKey: ['savedSearchRange', savedQuery, timeRange.start, timeRange.end, range],
      queryFn: () => {
        if (range === 'all') {
          return api.searchActivities(savedQuery);
        }
        return api.searchActivitiesByRange(savedQuery, timeRange.start, timeRange.end);
      },
      enabled: getUtf8ByteLength(savedQuery) >= 2,
      refetchInterval: liveRefetchInterval,
      refetchOnWindowFocus: true,
    })),
  });

  const stats = useMemo(() => {
    const totals = new Map<string, { key: string; label: string; color: string; durationMs: number }>();
    let totalDurationMs = 0;

    for (const entry of statsEntries as TimeEntry[]) {
      const durationMs = getEntryOverlapDurationInRange(entry, statsRange.start, statsRange.end);
      if (durationMs <= 0) {
        continue;
      }
      totalDurationMs += durationMs;

      const key = entry.category_id ? `category-${entry.category_id}` : 'uncategorized';
      const category = entry.category_id ? categories.find((c) => c.id === entry.category_id) : undefined;
      const resolvedColor = entry.category_id ? (category?.color ?? '#6b7280') : '#6b7280';
      const existing = totals.get(key);
      if (existing) {
        existing.durationMs += durationMs;
      } else {
        totals.set(key, {
          key,
          label: category?.name ?? (entry.category_id ? '未知分类' : '未分类'),
          color: resolvedColor,
          durationMs,
        });
      }
    }

    const items = Array.from(totals.values())
      .sort((a, b) => b.durationMs - a.durationMs)
      .map((item) => ({
        ...item,
        percent: totalDurationMs > 0 ? (item.durationMs / totalDurationMs) * 100 : 0,
      }));

    return { totalDurationMs, items };
  }, [categories, statsEntries, statsRange.end, statsRange.start]);

  const savedQueryMetrics = useMemo(() => {
    return savedQueries.map((savedQuery, idx) => {
      const queryState = savedSearchQueries[idx];
      const queryResults = queryState?.data ?? [];
      const matchedEntryIds = new Set<number>();
      let totalDurationMs = 0;

      for (const result of queryResults) {
        const matchedEntry = (statsEntries as TimeEntry[]).find(
          (entry) => result.timestamp >= entry.start_time && result.timestamp < entry.end_time
        );
        if (!matchedEntry || matchedEntryIds.has(matchedEntry.id)) {
          continue;
        }

        matchedEntryIds.add(matchedEntry.id);
        totalDurationMs += getEntryOverlapDurationInRange(matchedEntry, statsRange.start, statsRange.end);
      }

      return {
        query: savedQuery,
        hitCount: matchedEntryIds.size,
        totalDurationMs,
        isLoading: Boolean(queryState?.isLoading || queryState?.isFetching || isLoadingStats),
      };
    });
  }, [savedQueries, savedSearchQueries, statsEntries, statsRange.end, statsRange.start, isLoadingStats]);

  const formatDuration = (durationMs: number) => {
    const totalMinutes = Math.round(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
      return `${minutes}分钟`;
    }
    if (minutes === 0) {
      return `${hours}小时`;
    }
    return `${hours}小时 ${minutes}分钟`;
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    if (range === 'day') {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const rangeLabels: Record<RangeType, string> = {
    day: '当天',
    month: '本月',
    year: '本年',
    all: '全部',
  };

  const canSaveCurrentQuery = canSearch && !savedQueries.includes(normalizedQuery);

  const handleSaveCurrentQuery = () => {
    if (!canSearch) {
      return;
    }
    setSavedQueries((prev) => normalizeSavedQueries([normalizedQuery, ...prev]));
  };

  const handleRemoveSavedQuery = (targetQuery: string) => {
    setSavedQueries((prev) => prev.filter((item) => item !== targetQuery));
  };

  const handleUseSavedQuery = (savedQuery: string) => {
    setQuery(savedQuery);
    setDebouncedQuery(savedQuery);
  };

  return (
    <div className="panel search-panel">
      <div className="today-search-layout" data-testid="today-search-layout">
        <div className="today-search-main" data-testid="today-search-main">
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h3 className="search-heading">
                <Search size={20} color="var(--primary)" />
                行为搜索
              </h3>
              <div className="segment-control">
                {(['day', 'month', 'year', 'all'] as RangeType[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`segment-btn ${range === r ? 'active' : ''}`}
                  >
                    {rangeLabels[r]}
                  </button>
                ))}
              </div>
            </div>

            <p className="muted small" style={{ marginBottom: 12 }}>
              在 {rangeLabels[range]} 范围内搜索行为记录。
            </p>

            <div className="search-input-wrap">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`搜索${rangeLabels[range]}范围内的记录...`}
                className="input search-input"
              />
              <div className="search-icon-wrap">
                {isLoading ? <div className="spin" /> : <Search size={18} color="var(--text-muted)" />}
              </div>
            </div>

            <div className="saved-search-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSaveCurrentQuery}
                disabled={!canSaveCurrentQuery}
              >
                <Star size={14} />
                保存当前搜索
              </button>
              <span className="small muted">
                {savedQueries.length > 0
                  ? `已保存 ${savedQueries.length} 项`
                  : '可保存常用搜索词并实时查看命中与时长'}
              </span>
            </div>
          </div>

          <div className={`today-search-results${canSearch ? ' is-active' : ''}`} data-testid="today-search-results">
            {canSearch && (
              <>
                {results.length > 0 ? (
                  <div className="result-list">
                    {results.map((result: SearchResult, index: number) => (
                      <div key={index} className="result-item">
                        <div
                          className="result-icon"
                          style={{
                            backgroundColor: result.type === 'time_entry' ? '#dcfce7' : '#e0e7ff',
                          }}
                        >
                          {result.type === 'time_entry' ? (
                            <CheckCircle2 size={16} color="#16a34a" />
                          ) : (
                            <AppWindow size={16} color="#4f46e5" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{result.title}</div>
                          <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {formatTime(result.timestamp)}
                            {result.process_name && ` - ${result.process_name}`}
                          </div>
                        </div>
                        <div
                          className="result-tag"
                          style={{
                            backgroundColor: result.type === 'time_entry' ? '#f0fdf4' : '#eef2ff',
                            color: result.type === 'time_entry' ? '#166534' : '#4338ca',
                          }}
                        >
                          {result.type === 'time_entry' ? '条目' : '窗口'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !isLoading && (
                  <div className="panel panel-soft" style={{ padding: 16, textAlign: 'center' }}>
                    未找到与“{normalizedQuery}”相关的记录。
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="today-search-side" data-testid="today-search-side">
          <div className="today-search-side-scroll">
            {savedQueries.length > 0 && (
              <div className="panel panel-soft saved-search-panel">
                {savedQueryMetrics.map((metric) => (
                  <div key={metric.query} className="saved-search-row">
                    <button type="button" className="saved-search-query" onClick={() => handleUseSavedQuery(metric.query)}>
                      {metric.query}
                    </button>
                    <div className="saved-search-metrics">
                      <span className="saved-search-badge">
                        {metric.isLoading ? '命中 ...' : `命中 ${metric.hitCount}`}
                      </span>
                      <span className="saved-search-badge">
                        {metric.isLoading ? '时长 ...' : formatDuration(metric.totalDurationMs)}
                      </span>
                      <button
                        type="button"
                        className="saved-search-remove"
                        onClick={() => handleRemoveSavedQuery(metric.query)}
                        aria-label={`删除已保存搜索：${metric.query}`}
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="stats-group" data-testid="today-search-stats">
              <div className="stats-row" style={{ marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>时间占比统计</h4>
                {isLoadingStats ? (
                  <span className="small muted">加载中...</span>
                ) : (
                  <span className="small" style={{ fontWeight: 700 }}>
                    总计 {formatDuration(stats.totalDurationMs)}
                  </span>
                )}
              </div>

              {!isLoadingStats && stats.items.length === 0 && <div className="small muted">该范围内暂无时间条目。</div>}

              {!isLoadingStats && stats.items.length > 0 && (
                <div className="stack-col">
                  {stats.items.map((item) => (
                    <div key={item.key}>
                      <div className="stats-row" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{item.label}</span>
                        <span className="small muted">
                          {formatDuration(item.durationMs)} ({item.percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="stat-bar-wrap">
                        <div
                          className="stat-bar"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: item.color,
                            minWidth: item.percent > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
