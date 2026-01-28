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

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>
          Idle Time Detected
        </h2>

        <div style={{ marginBottom: '24px', color: '#666' }}>
          <p style={{ margin: '8px 0' }}>
            <strong>Duration:</strong> {formatDuration(duration)}
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>Period:</strong> {formatTime(idlePeriod.start_time)} - {formatTime(idlePeriod.end_time)}
          </p>
        </div>

        <p style={{ marginBottom: '16px', color: '#333' }}>
          What would you like to do with this idle time?
        </p>

        {!showLabelInput ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handleResolve('discarded')}
              disabled={loading}
              style={{
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
            >
              Discard time (keep as gap)
            </button>

            <button
              onClick={() => handleResolve('merged')}
              disabled={loading}
              style={{
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #2196F3',
                borderRadius: '4px',
                backgroundColor: '#2196F3',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1976D2')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
            >
              Add to previous task
            </button>

            <button
              onClick={() => setShowLabelInput(true)}
              disabled={loading}
              style={{
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #4CAF50',
                borderRadius: '4px',
                backgroundColor: '#4CAF50',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#45a049')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
            >
              Create new task
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
            >
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
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '12px',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) {
                  handleResolve('labeled');
                }
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleResolve('labeled')}
                disabled={loading || !newLabel.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: newLabel.trim() ? '#4CAF50' : '#ccc',
                  color: 'white',
                  cursor: loading || !newLabel.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>

              <button
                onClick={() => setShowLabelInput(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
