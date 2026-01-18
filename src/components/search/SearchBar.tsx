import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
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
    <div style={{ marginTop: '20px' }}>
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activities... (min 2 characters)"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {isLoading && debouncedQuery.length >= 2 && (
        <div style={{ padding: '12px', color: '#666' }}>Searching...</div>
      )}

      {results.length > 0 && (
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                borderBottom: index < results.length - 1 ? '1px solid #eee' : 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {result.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {result.type === 'time_entry' ? 'Time Entry' : 'Window Activity'}
                    {result.process_name && ` • ${result.process_name}`}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {formatTimestamp(result.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {debouncedQuery.length >= 2 && !isLoading && results.length === 0 && (
        <div style={{ padding: '12px', color: '#666', textAlign: 'center' }}>
          No results found
        </div>
      )}
    </div>
  );
};
