import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.searchActivities(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
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
          placeholder="Search activities... (min 2 characters)"
          className="input"
        />
      </div>

      {isLoading && debouncedQuery.length >= 2 && <div className="small muted">Searching...</div>}

      {results.length > 0 && (
        <div className="result-list" style={{ maxHeight: 400 }}>
          {results.map((result, index) => (
            <div key={index} className="result-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{result.title}</div>
                <div className="small muted">
                  {result.type === 'time_entry' ? 'Time Entry' : 'Window Activity'}
                  {result.process_name && ` - ${result.process_name}`}
                </div>
              </div>
              <div className="small muted">{formatTimestamp(result.timestamp)}</div>
            </div>
          ))}
        </div>
      )}

      {debouncedQuery.length >= 2 && !isLoading && results.length === 0 && (
        <div className="panel panel-soft" style={{ padding: 12, textAlign: 'center' }}>
          No results found
        </div>
      )}
    </div>
  );
};
