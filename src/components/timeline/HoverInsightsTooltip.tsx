import React from 'react';

interface ProcessUsageItem {
  processName: string;
  seconds: number;
  percent: number;
}

interface HoverInsightsTooltipProps {
  position: { x: number; y: number };
  timestamp: number;
  rangeStart: number;
  rangeEnd: number;
  entryLabel?: string;
  categoryName?: string;
  filePath?: string;
  dataUrl?: string;
  processItems: ProcessUsageItem[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onImageClick?: () => void;
  isFading?: boolean;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}小时 ${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
};

export const HoverInsightsTooltip: React.FC<HoverInsightsTooltipProps> = ({
  position,
  timestamp,
  rangeStart,
  rangeEnd,
  entryLabel,
  categoryName,
  filePath,
  dataUrl,
  processItems,
  onMouseEnter,
  onMouseLeave,
  onImageClick,
  isFading = false,
}) => {
  const imageSrc = dataUrl || (filePath ? `asset://localhost/${filePath}` : undefined);

  return (
    <div
      className={`panel hover-insights-tooltip${isFading ? ' is-fading' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="small muted">时间点：{formatTime(timestamp)}</div>
      <div className="small muted">区间：{formatTime(rangeStart)} - {formatTime(rangeEnd)}</div>
      <div className="small muted">行为：{entryLabel ?? '（空白区间）'}</div>
      <div className="small muted">类别：{entryLabel ? (categoryName ?? '未分类') : '-'}</div>

      <div
        className={`hover-insights-image-wrap${imageSrc ? ' hover-insights-interactive' : ''}`}
        onMouseEnter={imageSrc ? onMouseEnter : undefined}
        onMouseLeave={imageSrc ? onMouseLeave : undefined}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="截图"
            className="hover-insights-image"
            onClick={onImageClick}
          />
        ) : (
          <div className="small muted">该时间点暂无截图</div>
        )}
      </div>

      <div className="hover-insights-section">
        {processItems.length === 0 ? (
          <div className="small muted">该区间暂无进程统计</div>
        ) : (
          processItems.map((item) => (
            <div key={item.processName} className="process-usage-row">
              <span className="small">{item.processName}</span>
              <span className="small muted">
                {formatDuration(item.seconds)} ({item.percent.toFixed(1)}%)
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

