import React, { useState } from 'react';
import { TimeEntry, TimeEntryUpdate } from '../../services/api';
import { CategorySelector } from './CategorySelector';

interface EditEntryDialogProps {
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onRestart: (entry: TimeEntry) => void;
  onCancel: () => void;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({
  entry,
  onSave,
  onDelete,
  onRestart,
  onCancel,
}) => {
  const [label, setLabel] = useState(entry.label);
  const [color, setColor] = useState(entry.color || '#4CAF50');
  const [categoryId, setCategoryId] = useState<number | undefined>(entry.category_id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState(formatTimeInput(entry.start_time));
  const [endTimeInput, setEndTimeInput] = useState(formatTimeInput(entry.end_time));

  function formatTimeInput(timestamp: number) {
    const d = new Date(timestamp);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const parseTimeInput = (value: string, baseTimestamp: number) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    const base = new Date(baseTimestamp);
    base.setHours(hours, minutes, 0, 0);
    return base.getTime();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getDuration = () => {
    const durationMs = entry.end_time - entry.start_time;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      const parsedStartTime = parseTimeInput(startTimeInput, entry.start_time);
      const parsedEndTime = parseTimeInput(endTimeInput, entry.end_time);

      if (!parsedStartTime || !parsedEndTime) {
        alert('Invalid time format. Please use HH:mm.');
        return;
      }

      if (parsedEndTime <= parsedStartTime) {
        alert('End time must be after start time.');
        return;
      }

      onSave(entry.id, {
        start_time: parsedStartTime,
        end_time: parsedEndTime,
        label: label.trim(),
        color,
        category_id: categoryId,
      });
    }
  };

  const handleDelete = () => {
    onDelete(entry.id);
  };

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          minWidth: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Edit Time Entry</h2>

        {!showDeleteConfirm ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Time Range
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="time"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  style={{
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <span>-</span>
                <input
                  type="time"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  style={{
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div style={{ color: '#666', marginTop: '6px' }}>
                Current: {formatTime(entry.start_time)} - {formatTime(entry.end_time)} ({getDuration()})
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

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  border: '1px solid #F44336',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#F44336',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>

              <button
                type="button"
                onClick={() => onRestart(entry)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  border: '1px solid #2196F3',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#2196F3',
                  cursor: 'pointer',
                }}
              >
                Restart
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
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
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div>
            <p style={{ marginBottom: '24px' }}>
              Are you sure you want to delete this time entry?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
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
                type="button"
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
