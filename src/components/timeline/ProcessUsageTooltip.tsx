import React from 'react';

interface ProcessUsageItem {
  processName: string;
  seconds: number;
  percent: number;
}

interface ProcessUsageTooltipProps {
  position: { x: number; y: number };
  rangeStart: number;
  rangeEnd: number;
  items: ProcessUsageItem[];
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}小时 ${m}分 ${s}秒`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

export const ProcessUsageTooltip: React.FC<ProcessUsageTooltipProps> = ({
  position,
  rangeStart,
  rangeEnd,
  items,
}) => {
  return (
    <div
      className="panel process-usage-tooltip"
      style={{ left: position.x, top: position.y }}
    >
      <div className="small muted">
        区间：{formatTime(rangeStart)} - {formatTime(rangeEnd)}
      </div>

      {items.length === 0 ? (
        <div className="small muted" style={{ marginTop: 8 }}>
          当前区间无进程数据
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {items.map((item) => (
            <div key={item.processName} className="process-usage-row">
              <span className="small">{item.processName}</span>
              <span className="small muted">
                {formatDuration(item.seconds)} ({item.percent.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
