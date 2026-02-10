import React, { useState } from 'react';
import { api } from '../../services/api';

export const ExportButton: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digital-diary-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('导出成功！');
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={isExporting} className="btn btn-primary btn-sm">
      {isExporting ? '导出中...' : '导出数据（JSON）'}
    </button>
  );
};
