import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, SearchResult } from '../../services/api';
import { Search, CheckCircle2, Clock, AppWindow } from 'lucide-react';

interface RangeSearchBarProps {
    date: Date;
}

type RangeType = 'day' | 'month' | 'year' | 'all';

export const TodaySearchBar: React.FC<RangeSearchBarProps> = ({ date }) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [range, setRange] = useState<RangeType>('day');

    // Calculate time range based on selected date and range type
    const timeRange = useMemo(() => {
        if (range === 'all') return { start: 0, end: 0 };

        const d = new Date(date);
        let start, end;

        if (range === 'day') {
            start = new Date(d).setHours(0, 0, 0, 0);
            end = start + 86400000;
        } else if (range === 'month') {
            start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
            end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
        } else { // year
            start = new Date(d.getFullYear(), 0, 1).getTime();
            end = new Date(d.getFullYear() + 1, 0, 1).getTime();
        }

        return { start, end };
    }, [date, range]);

    // Debounce search query
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

    const formatTime = (timestamp: number) => {
        const d = new Date(timestamp);
        if (range === 'day') {
            return d.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } else {
            return d.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
    };

    const rangeLabels = {
        day: '当日',
        month: '本月',
        year: '本年',
        all: '全部'
    };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e5e7eb'
        }}>
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                        <Search size={20} color="#6366f1" />
                        行为搜索
                    </h3>
                    <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '2px', borderRadius: '6px' }}>
                        {(['day', 'month', 'year', 'all'] as RangeType[]).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    backgroundColor: range === r ? 'white' : 'transparent',
                                    color: range === r ? '#4f46e5' : '#6b7280',
                                    fontWeight: range === r ? '600' : '500',
                                    boxShadow: range === r ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {rangeLabels[r]}
                            </button>
                        ))}
                    </div>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                    在{range === 'all' ? '所有历史记录' : rangeLabels[range]}内搜索活动（例如：“吃药”、“项目 A”）。
                </p>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`搜索${rangeLabels[range]}活动...`}
                        style={{
                            width: '100%',
                            padding: '12px 40px 12px 16px',
                            fontSize: '15px',
                            border: '2px solid #f3f4f6',
                            borderRadius: '8px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            backgroundColor: '#f9fafb'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.target.style.borderColor = '#f3f4f6'}
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                        {isLoading ? (
                            <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : <Search size={18} color="#9ca3af" />}
                    </div>
                </div>
            </div>

            {debouncedQuery.length >= 2 && (
                <div style={{ marginTop: '16px' }}>
                    {results.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                            {results.map((result: SearchResult, index: number) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'transform 0.1s',
                                        cursor: 'default'
                                    }}
                                >
                                    <div style={{
                                        backgroundColor: result.type === 'time_entry' ? '#dcfce7' : '#e0e7ff',
                                        padding: '8px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {result.type === 'time_entry' ? (
                                            <CheckCircle2 size={16} color="#16a34a" />
                                        ) : (
                                            <AppWindow size={16} color="#4f46e5" />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px', marginBottom: '2px' }}>
                                            {result.title}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            {formatTime(result.timestamp)}
                                            {result.process_name && ` • ${result.process_name}`}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: result.type === 'time_entry' ? '#f0fdf4' : '#f5f3ff',
                                        color: result.type === 'time_entry' ? '#166534' : '#5b21b6',
                                        fontWeight: '500'
                                    }}>
                                        {result.type === 'time_entry' ? '条目' : '窗口'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !isLoading && (
                        <div style={{
                            padding: '24px',
                            textAlign: 'center',
                            backgroundColor: '#fff7ed',
                            borderRadius: '8px',
                            border: '1px solid #ffedd5',
                            color: '#9a3412',
                            fontSize: '14px'
                        }}>
                            在那内没有找到包含 “{debouncedQuery}” 的记录。
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: #e5e7eb;
                    border-radius: 3px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #d1d5db;
                }
            `}</style>
        </div>
    );
};
