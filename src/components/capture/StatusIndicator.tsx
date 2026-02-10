import React, { useState } from 'react';

interface StatusIndicatorProps {
  lastCaptureTime?: number;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ lastCaptureTime }) => {
  const [isActive] = useState(true);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`status-indicator ${isActive ? '' : 'inactive'}`}>
      <span className="status-dot" />
      <span>{isActive ? '运行中' : '已停止'}</span>
      {lastCaptureTime && <span className="small muted">最近截图：{formatTime(lastCaptureTime)}</span>}
    </div>
  );
};
