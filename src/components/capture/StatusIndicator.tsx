import React, { useState } from 'react';

interface StatusIndicatorProps {
  lastCaptureTime?: number;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ lastCaptureTime }) => {
  const [isActive] = useState(true); // Capture is always active when app is running

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: isActive ? '#e8f5e9' : '#ffebee',
        borderRadius: '4px',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isActive ? '#4CAF50' : '#f44336',
        }}
      />
      <span style={{ fontWeight: 'bold', color: isActive ? '#2e7d32' : '#c62828' }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
      {lastCaptureTime && (
        <span style={{ color: '#666', marginLeft: '8px' }}>
          Last capture: {formatTime(lastCaptureTime)}
        </span>
      )}
    </div>
  );
};
