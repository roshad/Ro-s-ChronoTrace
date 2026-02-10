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
  const [color, setColor] = useState(entry.color || '#0d9488');
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
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
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
    if (!label.trim()) return;

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
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-card">
        <h2 className="dialog-title">Edit Time Entry</h2>

        {!showDeleteConfirm ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Time Range</label>
              <div className="toolbar-row">
                <input type="time" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} className="input" />
                <span>-</span>
                <input type="time" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} className="input" />
              </div>
              <div className="field-help">
                Current: {formatTime(entry.start_time)} - {formatTime(entry.end_time)} ({getDuration()})
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
                {['#0d9488', '#14b8a6', '#f97316', '#16a34a', '#6366f1', '#dc2626'].map((c) => (
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

            <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
              <div className="toolbar-row">
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className="btn btn-ghost">
                  Delete
                </button>
                <button type="button" onClick={() => onRestart(entry)} className="btn btn-secondary">
                  Restart
                </button>
              </div>
              <div className="toolbar-row">
                <button type="button" onClick={onCancel} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div>
            <p style={{ marginBottom: '24px' }}>Are you sure you want to delete this time entry?</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => onDelete(entry.id)} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
