import React, { useState, useEffect } from 'react';
import { useTimelineStore } from '../../services/store';
import { CategorySelector } from './CategorySelector';

interface TimerInputProps {
  onStart: (label: string, startTime: number, categoryId?: number) => Promise<number>;
  onStop: (entryId: number, endTime: number) => Promise<void>;
}

export const TimerInput: React.FC<TimerInputProps> = ({ onStart, onStop }) => {
  const { activeTimer, startTimer, stopTimer } = useTimelineStore();
  const [label, setLabel] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (activeTimer) {
      setLabel(activeTimer.label);
      setCategoryId(activeTimer.categoryId);
      interval = window.setInterval(() => {
        setElapsed(Date.now() - activeTimer.startTime);
      }, 1000);
    } else {
      setElapsed(0);
      setCategoryId(undefined);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStartStop = async () => {
    if (loading) {
      return;
    }

    if (activeTimer) {
      try {
        setLoading(true);
        const endTime = Date.now();
        await onStop(activeTimer.entryId, endTime);
        stopTimer();
        setLabel('');
        setCategoryId(undefined);
      } catch (error) {
        console.error('Failed to stop timer:', error);
        alert(`停止计时失败：${error}`);
      } finally {
        setLoading(false);
      }
    } else if (label.trim()) {
      try {
        setLoading(true);
        const startTime = Date.now();
        const entryId = await onStart(label.trim(), startTime, categoryId);
        startTimer({
          entryId,
          startTime,
          label: label.trim(),
          categoryId,
        });
      } catch (error) {
        console.error('Failed to start timer:', error);
        alert(`开始计时失败：${error}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel timer-panel">
      <input
        type="text"
        placeholder="你正在做什么？"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={!!activeTimer || loading}
        className="input timer-label-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleStartStop();
        }}
      />

      <CategorySelector selectedCategoryId={categoryId} onSelect={setCategoryId} />

      {activeTimer && <div className="mono-time timer-value">{formatElapsedTime(elapsed)}</div>}

      <button
        onClick={handleStartStop}
        disabled={loading || (!activeTimer && !label.trim())}
        className={`btn ${activeTimer ? 'btn-danger' : 'btn-success'}`}
        style={{ minWidth: 110 }}
      >
        {loading ? '处理中...' : activeTimer ? '停止' : '开始'}
      </button>
    </div>
  );
};
