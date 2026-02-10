import React, { useState } from 'react';
import { api } from '../../services/api';

interface IdlePromptProps {
  idlePeriod: {
    id: number;
    start_time: number;
    end_time: number;
  };
  onResolved: () => void;
  onClose: () => void;
}

export const IdlePrompt: React.FC<IdlePromptProps> = ({ idlePeriod, onResolved, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) return `${hours}小时 ${remainingMinutes}分钟`;
    return `${minutes}分钟`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResolve = async (resolution: string) => {
    setLoading(true);
    try {
      await api.resolveIdlePeriod({
        id: idlePeriod.id,
        resolution,
        target_entry_id: undefined,
        new_entry_label: resolution === 'labeled' ? newLabel : undefined,
      });
      onResolved();
    } catch (error) {
      console.error('Failed to resolve idle period:', error);
      alert('处理空闲时段失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const duration = idlePeriod.end_time - idlePeriod.start_time;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">检测到空闲时间</h2>

        <div className="muted" style={{ marginBottom: 24 }}>
          <p style={{ margin: '8px 0' }}>
            <strong>时长：</strong> {formatDuration(duration)}
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>时间段：</strong> {formatTime(idlePeriod.start_time)} - {formatTime(idlePeriod.end_time)}
          </p>
        </div>

        <p style={{ marginBottom: 16 }}>这段空闲时间你想怎么处理？</p>

        {!showLabelInput ? (
          <div className="stack-col">
            <button onClick={() => handleResolve('discarded')} disabled={loading} className="btn btn-secondary">
              丢弃（保持为空档）
            </button>
            <button onClick={() => handleResolve('merged')} disabled={loading} className="btn btn-primary">
              合并到上一条任务
            </button>
            <button onClick={() => setShowLabelInput(true)} disabled={loading} className="btn btn-success">
              创建新任务
            </button>
            <button onClick={onClose} disabled={loading} className="btn btn-ghost">
              稍后决定
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="请输入任务标签..."
              autoFocus
              className="input"
              style={{ marginBottom: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) {
                  handleResolve('labeled');
                }
              }}
            />

            <div className="toolbar-row">
              <button
                onClick={() => handleResolve('labeled')}
                disabled={loading || !newLabel.trim()}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                  {loading ? '创建中...' : '创建任务'}
                </button>

              <button onClick={() => setShowLabelInput(false)} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
