import React, { useState } from 'react';
import { api } from '../../services/api';

interface IdlePromptProps {
  idlePeriod: {
    id: number;
    start_time: number;
    end_time: number;
  };
  onResolved: () => void;
  onClose: () => void;
}

export const IdlePrompt: React.FC<IdlePromptProps> = ({ idlePeriod, onResolved, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMinutes}m`;
    return `${minutes}m`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResolve = async (resolution: string) => {
    setLoading(true);
    try {
      await api.resolveIdlePeriod({
        id: idlePeriod.id,
        resolution,
        target_entry_id: undefined,
        new_entry_label: resolution === 'labeled' ? newLabel : undefined,
      });
      onResolved();
    } catch (error) {
      console.error('Failed to resolve idle period:', error);
      alert('Failed to resolve idle period. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const duration = idlePeriod.end_time - idlePeriod.start_time;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Idle Time Detected</h2>

        <div className="muted" style={{ marginBottom: 24 }}>
          <p style={{ margin: '8px 0' }}>
            <strong>Duration:</strong> {formatDuration(duration)}
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>Period:</strong> {formatTime(idlePeriod.start_time)} - {formatTime(idlePeriod.end_time)}
          </p>
        </div>

        <p style={{ marginBottom: 16 }}>What would you like to do with this idle time?</p>

        {!showLabelInput ? (
          <div className="stack-col">
            <button onClick={() => handleResolve('discarded')} disabled={loading} className="btn btn-secondary">
              Discard time (keep as gap)
            </button>
            <button onClick={() => handleResolve('merged')} disabled={loading} className="btn btn-primary">
              Add to previous task
            </button>
            <button onClick={() => setShowLabelInput(true)} disabled={loading} className="btn btn-success">
              Create new task
            </button>
            <button onClick={onClose} disabled={loading} className="btn btn-ghost">
              Decide later
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Enter task label..."
              autoFocus
              className="input"
              style={{ marginBottom: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) {
                  handleResolve('labeled');
                }
              }}
            />

            <div className="toolbar-row">
              <button
                onClick={() => handleResolve('labeled')}
                disabled={loading || !newLabel.trim()}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>

              <button onClick={() => setShowLabelInput(false)} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
