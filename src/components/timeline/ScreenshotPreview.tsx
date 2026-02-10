import React from 'react';

interface ScreenshotPreviewProps {
  filePath?: string;
  dataUrl?: string;
  timestamp?: number;
}

export const ScreenshotPreview: React.FC<ScreenshotPreviewProps> = ({
  filePath,
  dataUrl,
  timestamp,
}) => {
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!filePath && !dataUrl) {
    return (
      <div className="panel preview-card">
        <div className="muted small">当前时间点没有可用截图</div>
      </div>
    );
  }

  const imageSrc = dataUrl || (filePath ? `asset://localhost/${filePath}` : undefined);

  return (
    <div className="panel preview-card">
      <h3 style={{ margin: '0 0 8px 0' }}>截图预览</h3>
      {timestamp && <div className="muted small">截图时间：{formatTime(timestamp)}</div>}
      <div className="preview-frame">
        <img
          src={imageSrc}
          alt="截图"
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = '<div style="color: #ffffff; padding: 20px;">截图加载失败</div>';
            }
          }}
        />
      </div>
      {filePath && <div className="small muted" style={{ marginTop: 8 }}>{filePath}</div>}
    </div>
  );
};
