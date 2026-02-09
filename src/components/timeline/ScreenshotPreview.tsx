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
      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#666', fontSize: '14px' }}>
          No screenshot available for this time
        </div>
      </div>
    );
  }

  const imageSrc = dataUrl || (filePath ? `asset://localhost/${filePath}` : undefined);

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '16px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Screenshot Preview</h3>
      {timestamp && (
        <div style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
          Captured at: {formatTime(timestamp)}
        </div>
      )}
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
        }}
      >
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
              parent.innerHTML = '<div style="color: #fff; padding: 20px;">Failed to load screenshot</div>';
            }
          }}
        />
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
        {filePath}
      </div>
    </div>
  );
};
