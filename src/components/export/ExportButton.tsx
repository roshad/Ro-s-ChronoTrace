import React, { useState } from 'react';
import { api } from '../../services/api';

export const ExportButton: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await api.exportData();

      // Create JSON blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digital-diary-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      style={{
        padding: '8px 16px',
        fontSize: '14px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: isExporting ? '#ccc' : '#4CAF50',
        color: 'white',
        cursor: isExporting ? 'not-allowed' : 'pointer',
        fontWeight: 'bold',
      }}
    >
      {isExporting ? 'Exporting...' : 'Export Data (JSON)'}
    </button>
  );
};
