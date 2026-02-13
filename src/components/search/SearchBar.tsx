import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

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

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const normalizedQuery = debouncedQuery.trim();
  const canSearch = getUtf8ByteLength(debouncedQuery) >= 2;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', normalizedQuery],
    queryFn: () => api.searchActivities(normalizedQuery),
    enabled: canSearch,
  });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="panel search-panel">
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索行为记录...（至少 1 个中文或 2 个英文字符）"
          className="input"
        />
      </div>

      {isLoading && canSearch && <div className="small muted">搜索中...</div>}

      {results.length > 0 && (
        <div className="result-list" style={{ maxHeight: 400 }}>
          {results.map((result, index) => (
            <div key={index} className="result-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{result.title}</div>
                <div className="small muted">
                  {result.type === 'time_entry' ? '时间条目' : '窗口活动'}
                  {result.process_name && ` - ${result.process_name}`}
                </div>
              </div>
              <div className="small muted">{formatTimestamp(result.timestamp)}</div>
            </div>
          ))}
        </div>
      )}

      {canSearch && !isLoading && results.length === 0 && (
        <div className="panel panel-soft" style={{ padding: 12, textAlign: 'center' }}>
          未找到结果
        </div>
      )}
    </div>
  );
};
