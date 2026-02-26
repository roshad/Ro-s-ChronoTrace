import React, { useState, useEffect, useRef } from 'react';
import { useTimelineStore } from '../../services/store';
import { CategorySelector } from './CategorySelector';

interface TimerInputProps {
  onStart: (label: string, startTime: number, categoryId?: number) => Promise<number>;
  onStop: (entryId: number, endTime: number) => Promise<void>;
  onDeleteCurrent: (entryId: number) => Promise<void>;
  onUpdateLabel: (entryId: number, label: string) => Promise<void>;
  onUpdateCategory: (entryId: number, categoryId?: number) => Promise<void>;
}

export const TimerInput: React.FC<TimerInputProps> = ({
  onStart,
  onStop,
  onDeleteCurrent,
  onUpdateLabel,
  onUpdateCategory,
}) => {
  const { activeTimer, startTimer, updateActiveTimerLabel, updateActiveTimerCategory, stopTimer } = useTimelineStore();
  const [label, setLabel] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const saveLabelTimerRef = useRef<number | null>(null);
  const saveCategoryTimerRef = useRef<number | null>(null);

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

  const commitLabelUpdate = async () => {
    if (!activeTimer) {
      return;
    }

    const nextLabel = label.trim();
    if (!nextLabel) {
      setLabel(activeTimer.label);
      return;
    }

    if (nextLabel === activeTimer.label) {
      return;
    }

    await onUpdateLabel(activeTimer.entryId, nextLabel);
    updateActiveTimerLabel(nextLabel);
  };

  const commitCategoryUpdate = async () => {
    if (!activeTimer) {
      return;
    }

    const nextCategory = categoryId ?? undefined;
    const currentCategory = activeTimer.categoryId ?? undefined;
    if (nextCategory === currentCategory) {
      return;
    }

    await onUpdateCategory(activeTimer.entryId, nextCategory);
    updateActiveTimerCategory(nextCategory);
  };

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    if (saveLabelTimerRef.current) {
      window.clearTimeout(saveLabelTimerRef.current);
      saveLabelTimerRef.current = null;
    }

    const nextLabel = label.trim();
    if (!nextLabel || nextLabel === activeTimer.label) {
      return;
    }

    saveLabelTimerRef.current = window.setTimeout(async () => {
      try {
        await onUpdateLabel(activeTimer.entryId, nextLabel);
        updateActiveTimerLabel(nextLabel);
      } catch (error) {
        console.error('Failed to update running timer label:', error);
      }
    }, 600);

    return () => {
      if (saveLabelTimerRef.current) {
        window.clearTimeout(saveLabelTimerRef.current);
        saveLabelTimerRef.current = null;
      }
    };
  }, [activeTimer?.entryId, activeTimer?.label, label, onUpdateLabel, updateActiveTimerLabel]);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    if (saveCategoryTimerRef.current) {
      window.clearTimeout(saveCategoryTimerRef.current);
      saveCategoryTimerRef.current = null;
    }

    const nextCategory = categoryId ?? undefined;
    const currentCategory = activeTimer.categoryId ?? undefined;
    if (nextCategory === currentCategory) {
      return;
    }

    saveCategoryTimerRef.current = window.setTimeout(async () => {
      try {
        await onUpdateCategory(activeTimer.entryId, nextCategory);
        updateActiveTimerCategory(nextCategory);
      } catch (error) {
        console.error('Failed to update running timer category:', error);
      }
    }, 300);

    return () => {
      if (saveCategoryTimerRef.current) {
        window.clearTimeout(saveCategoryTimerRef.current);
        saveCategoryTimerRef.current = null;
      }
    };
  }, [activeTimer?.entryId, activeTimer?.categoryId, categoryId, onUpdateCategory, updateActiveTimerCategory]);

  const handleStartStop = async () => {
    if (loading) {
      return;
    }

    if (activeTimer) {
      try {
        setLoading(true);
        await commitLabelUpdate();
        await commitCategoryUpdate();
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
        const nextLabel = label.trim();
        const entryId = await onStart(nextLabel, startTime, categoryId);
        startTimer({
          entryId,
          startTime,
          label: nextLabel,
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

  const handleDeleteCurrent = async () => {
    if (!activeTimer || loading) {
      return;
    }

    const shouldDelete = window.confirm('确认删除当前行为吗？删除后不可恢复。');
    if (!shouldDelete) {
      return;
    }

    try {
      setLoading(true);
      await onDeleteCurrent(activeTimer.entryId);
      stopTimer();
      setLabel('');
      setCategoryId(undefined);
    } catch (error) {
      console.error('Failed to delete running timer entry:', error);
      alert(`删除当前行为失败：${error}`);
    } finally {
      setLoading(false);
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
        disabled={loading}
        className="input timer-label-input"
        onBlur={() => {
          if (activeTimer) {
            void commitLabelUpdate();
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') {
            return;
          }

          if (activeTimer) {
            e.preventDefault();
            void commitLabelUpdate();
            return;
          }

          void handleStartStop();
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

      {activeTimer && (
        <button
          type="button"
          onClick={handleDeleteCurrent}
          disabled={loading}
          className="btn btn-ghost"
          style={{ minWidth: 110 }}
        >
          删除
        </button>
      )}
    </div>
  );
};
