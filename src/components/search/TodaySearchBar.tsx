import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, SearchResult, TimeEntry } from '../../services/api';
import { Search, CheckCircle2, Clock, AppWindow } from 'lucide-react';

interface RangeSearchBarProps {
  date: Date;
}

type RangeType = 'day' | 'month' | 'year' | 'all';

export const TodaySearchBar: React.FC<RangeSearchBarProps> = ({ date }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [range, setRange] = useState<RangeType>('day');

  const timeRange = useMemo(() => {
    if (range === 'all') return { start: 0, end: 0 };
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

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['searchRange', timeRange.start, timeRange.end, range, debouncedQuery],
    queryFn: () => {
      if (range === 'all') {
        return api.searchActivities(debouncedQuery);
      }
      return api.searchActivitiesByRange(debouncedQuery, timeRange.start, timeRange.end);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: statsEntries = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ['statsEntries', range, statsRange.start, statsRange.end],
    queryFn: () => api.getTimeEntriesByRange(statsRange.start, statsRange.end),
  });

  const stats = useMemo(() => {
    const totals = new Map<string, { key: string; label: string; color: string; durationMs: number }>();
    let totalDurationMs = 0;

    for (const entry of statsEntries as TimeEntry[]) {
      const overlapStart = Math.max(statsRange.start, entry.start_time);
      const overlapEnd = Math.min(statsRange.end, entry.end_time);
      if (overlapEnd <= overlapStart) continue;
      const durationMs = overlapEnd - overlapStart;
      totalDurationMs += durationMs;

      const key = entry.category_id ? `category-${entry.category_id}` : 'uncategorized';
      const category = entry.category_id ? categories.find((c) => c.id === entry.category_id) : undefined;
      const resolvedColor = entry.category_id
        ? (category?.color ?? '#6b7280')
        : '#6b7280';
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

  const formatDuration = (durationMs: number) => {
    const totalMinutes = Math.round(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}分钟`;
    if (minutes === 0) return `${hours}小时`;
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
    day: '今天',
    month: '本月',
    year: '本年',
    all: '全部',
  };

  return (
    <div className="panel search-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <h3 className="search-heading">
            <Search size={20} color="var(--primary)" />
            行为搜索
          </h3>
          <div className="segment-control">
            {(['day', 'month', 'year', 'all'] as RangeType[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`segment-btn ${range === r ? 'active' : ''}`}>
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
      </div>

      <div className="stats-group">
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

      {debouncedQuery.length >= 2 && (
        <div style={{ marginTop: 16 }}>
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
              未找到与“{debouncedQuery}”相关的记录。
            </div>
          )}
        </div>
      )}
    </div>
  );
};
