import React, { useState } from 'react';
import { TimeEntryInput } from '../../services/api';
import { CategorySelector } from './CategorySelector';

interface EntryDialogProps {
  startTime: number;
  endTime: number;
  onSubmit: (entry: TimeEntryInput) => void;
  onCancel: () => void;
}

export const EntryDialog: React.FC<EntryDialogProps> = ({
  startTime,
  endTime,
  onSubmit,
  onCancel,
}) => {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#4CAF50');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getDuration = () => {
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onSubmit({
        start_time: startTime,
        end_time: endTime,
        label: label.trim(),
        color,
        category_id: categoryId,
      });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        minWidth: '400px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <h2 style={{ marginTop: 0 }}>Create Time Entry</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Time Range
            </label>
            <div style={{ color: '#666' }}>
              {formatTime(startTime)} - {formatTime(endTime)} ({getDuration()})
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Category
            </label>
            <CategorySelector
              selectedCategoryId={categoryId}
              onSelect={setCategoryId}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Label *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="What were you working on?"
              autoFocus
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#607D8B'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: c,
                    border: color === c ? '3px solid #333' : '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#2196F3',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Create Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
