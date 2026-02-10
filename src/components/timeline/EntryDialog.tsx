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
      hour12: false,
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
    if (!label.trim()) {
      return;
    }
    onSubmit({
      start_time: startTime,
      end_time: endTime,
      label: label.trim(),
      color,
      category_id: categoryId,
    });
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-card">
        <h2 className="dialog-title">Create Time Entry</h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label">Time Range</label>
            <div className="mono-time">
              {formatTime(startTime)} - {formatTime(endTime)} ({getDuration()})
            </div>
          </div>

          <div className="field">
            <label className="field-label">Category</label>
            <CategorySelector selectedCategoryId={categoryId} onSelect={setCategoryId} />
          </div>

          <div className="field">
            <label className="field-label">Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="What were you working on?"
              autoFocus
              required
              className="input"
            />
          </div>

          <div className="field">
            <label className="field-label">Color</label>
            <div className="toolbar-row">
              {['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#607D8B'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: color === c ? '2px solid var(--text)' : '1px solid var(--border-strong)',
                    backgroundColor: c,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="dialog-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
