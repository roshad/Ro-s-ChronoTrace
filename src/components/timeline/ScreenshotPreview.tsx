import React from 'react';

interface ScreenshotPreviewProps {
  filePath?: string;
  dataUrl?: string;
  timestamp?: number;
  variant?: 'panel' | 'tooltip';
  position?: { x: number; y: number };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onImageClick?: () => void;
  isFading?: boolean;
}

export const ScreenshotPreview: React.FC<ScreenshotPreviewProps> = ({
  filePath,
  dataUrl,
  timestamp,
  variant = 'panel',
  position,
  onMouseEnter,
  onMouseLeave,
  onImageClick,
  isFading = false,
}) => {
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const cardClassName = variant === 'tooltip'
    ? `screenshot-tooltip${isFading ? ' is-fading' : ''}`
    : 'preview-card';

  if (!filePath && !dataUrl) {
    return (
      <div className={`panel ${cardClassName}`}>
        <div className="muted small">当前时间点没有可用截图</div>
      </div>
    );
  }

  const imageSrc = dataUrl || (filePath ? `asset://localhost/${filePath}` : undefined);
  const wrapperStyle = variant === 'tooltip' && position
    ? {
      left: position.x,
      top: position.y,
    }
    : undefined;

  return (
    <div
      className={`panel ${cardClassName}`}
      style={wrapperStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {variant !== 'tooltip' && <h3 style={{ margin: '0 0 8px 0' }}>截图预览</h3>}
      {timestamp && <div className="muted small">{variant === 'tooltip' ? '时间：' : '截图时间：'}{formatTime(timestamp)}</div>}
      <div className={variant === 'tooltip' ? 'preview-frame preview-frame-tooltip' : 'preview-frame'}>
        <img
          src={imageSrc}
          alt="截图"
          style={{
            maxWidth: '100%',
            maxHeight: variant === 'tooltip' ? '210px' : '400px',
            objectFit: 'contain',
            cursor: onImageClick ? 'pointer' : 'default',
          }}
          onClick={onImageClick}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = '<div style="color: #ffffff; padding: 20px;">截图加载失败</div>';
            }
          }}
        />
      </div>
      {filePath && variant !== 'tooltip' && <div className="small muted" style={{ marginTop: 8 }}>{filePath}</div>}
      {variant === 'tooltip' && <div className="small muted" style={{ marginTop: 8 }}>左键点击图片可打开原图</div>}
    </div>
  );
};
