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
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!filePath && !dataUrl) {
    return (
      <div className="panel preview-card">
        <div className="muted small">No screenshot available for this time</div>
      </div>
    );
  }

  const imageSrc = dataUrl || (filePath ? `asset://localhost/${filePath}` : undefined);

  return (
    <div className="panel preview-card">
      <h3 style={{ margin: '0 0 8px 0' }}>Screenshot Preview</h3>
      {timestamp && <div className="muted small">Captured at: {formatTime(timestamp)}</div>}
      <div className="preview-frame">
        <img
          src={imageSrc}
          alt="Screenshot"
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = '<div style="color: #ffffff; padding: 20px;">Failed to load screenshot</div>';
            }
          }}
        />
      </div>
      {filePath && <div className="small muted" style={{ marginTop: 8 }}>{filePath}</div>}
    </div>
  );
};
