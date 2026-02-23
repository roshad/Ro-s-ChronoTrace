import React, { useEffect, useState } from 'react';
import { TimeEntry, TimeEntryInput, TimeEntryUpdate } from '../../services/api';
import { CategorySelector } from './CategorySelector';

type CreateDialogProps = {
  mode: 'create';
  startTime: number;
  endTime: number;
  initialLabel?: string;
  onCreate: (entry: TimeEntryInput) => void;
  onStart?: (draft: { label: string; categoryId?: number }) => void;
  showStartAction?: boolean;
  onCancel: () => void;
};

type EditDialogProps = {
  mode: 'edit';
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onRestart: (entry: TimeEntry) => void;
  canStart?: boolean;
  onCancel: () => void;
  errorMessage?: string | null;
};

type TimeEntryDialogProps = CreateDialogProps | EditDialogProps;

const formatTimeInput = (timestamp: number) => {
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const parseTimeInput = (value: string, baseTimestamp: number) => {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  const base = new Date(baseTimestamp);
  base.setHours(hours, minutes, seconds, 0);
  return base.getTime();
};

const normalizeCreateRange = (startTime: number, endTime: number) => {
  const normalizedStart = Math.ceil(startTime / 1000) * 1000;
  const normalizedEnd = Math.floor(endTime / 1000) * 1000;

  // If snapping would collapse/flip the range, keep original values.
  if (normalizedEnd <= normalizedStart) {
    return { startTime, endTime };
  }

  return {
    startTime: normalizedStart,
    endTime: normalizedEnd,
  };
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const getDurationText = (startTime: number, endTime: number) => {
  const durationMs = Math.max(0, endTime - startTime);
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}小时 ${minutes}分钟 ${seconds}秒`;
};

export const TimeEntryDialog: React.FC<TimeEntryDialogProps> = (props) => {
  const isEdit = props.mode === 'edit';
  const sourceRange = isEdit
    ? { startTime: props.entry.start_time, endTime: props.entry.end_time }
    : normalizeCreateRange(props.startTime, props.endTime);
  const sourceStartTime = sourceRange.startTime;
  const sourceEndTime = sourceRange.endTime;
  const sourceLabel = isEdit ? props.entry.label : (props.initialLabel ?? '');
  const sourceCategoryId = isEdit ? props.entry.category_id : undefined;

  const [label, setLabel] = useState(sourceLabel);
  const [categoryId, setCategoryId] = useState<number | undefined>(sourceCategoryId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState(formatTimeInput(sourceStartTime));
  const [endTimeInput, setEndTimeInput] = useState(formatTimeInput(sourceEndTime));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(sourceLabel);
    setCategoryId(sourceCategoryId);
    setShowDeleteConfirm(false);
    setStartTimeInput(formatTimeInput(sourceStartTime));
    setEndTimeInput(formatTimeInput(sourceEndTime));
    setLocalError(null);
  }, [sourceLabel, sourceCategoryId, sourceStartTime, sourceEndTime]);

  const previewStart = parseTimeInput(startTimeInput, sourceStartTime);
  const previewEnd = parseTimeInput(endTimeInput, sourceEndTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }

    const parsedStartTime = parseTimeInput(startTimeInput, sourceStartTime);
    if (!parsedStartTime) {
      setLocalError('时间格式无效，请使用 HH:mm:ss。');
      return;
    }

    const parsedEndTime = parseTimeInput(endTimeInput, sourceEndTime);
    if (!parsedEndTime) {
      setLocalError('时间格式无效，请使用 HH:mm:ss。');
      return;
    }

    if (parsedEndTime <= parsedStartTime) {
      setLocalError('结束时间必须晚于开始时间。');
      return;
    }

    if (!isEdit) {
      props.onCreate({
        start_time: parsedStartTime,
        end_time: parsedEndTime,
        label: trimmedLabel,
        category_id: categoryId,
      });
      return;
    }

    const initialStartInput = formatTimeInput(props.entry.start_time);
    const initialEndInput = formatTimeInput(props.entry.end_time);
    const updates: TimeEntryUpdate = {};

    if (startTimeInput !== initialStartInput) {
      updates.start_time = parsedStartTime;
    }
    if (endTimeInput !== initialEndInput) {
      updates.end_time = parsedEndTime;
    }
    if (trimmedLabel !== props.entry.label) {
      updates.label = trimmedLabel;
    }

    // Always send category_id so edit save never becomes an empty update payload.
    updates.category_id = categoryId ?? null;
    props.onSave(props.entry.id, updates);
  };

  const handleStart = () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setLocalError('请输入行为标签后再开始。');
      return;
    }

    if (isEdit) {
      props.onRestart(props.entry);
      return;
    }

    props.onStart?.({
      label: trimmedLabel,
      categoryId,
    });
  };

  const shouldShowStartButton = isEdit ? props.canStart !== false : Boolean(props.showStartAction && props.onStart);
  const actionJustify = (isEdit || shouldShowStartButton) ? 'space-between' : 'flex-end';

  return (
    <div className="dialog-overlay">
      <div className="dialog-card">
        <h2 className="dialog-title">{isEdit ? '编辑时间条目' : '创建时间条目'}</h2>

        {!isEdit || !showDeleteConfirm ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">时间范围</label>
              <div className="toolbar-row">
                <input
                  type="time"
                  step={1}
                  value={startTimeInput}
                  onChange={(e) => {
                    setLocalError(null);
                    setStartTimeInput(e.target.value);
                  }}
                  className="input"
                />
                <span>-</span>
                <input
                  type="time"
                  step={1}
                  value={endTimeInput}
                  onChange={(e) => {
                    setLocalError(null);
                    setEndTimeInput(e.target.value);
                  }}
                  className="input"
                />
              </div>
              <div className="field-help">
                {previewStart && previewEnd && previewEnd > previewStart
                  ? `当前：${formatTime(previewStart)} - ${formatTime(previewEnd)} (${getDurationText(previewStart, previewEnd)})`
                  : `当前：${formatTime(sourceStartTime)} - ${formatTime(sourceEndTime)} (${getDurationText(sourceStartTime, sourceEndTime)})`}
              </div>
            </div>

            <div className="field">
              <label className="field-label">分类</label>
              <CategorySelector
                selectedCategoryId={categoryId}
                onSelect={(id) => {
                  setLocalError(null);
                  setCategoryId(id);
                }}
              />
            </div>

            <div className="field">
              <label className="field-label">标签 *</label>
              <input
                type="text"
                value={label}
                onChange={(e) => {
                  setLocalError(null);
                  setLabel(e.target.value);
                }}
                placeholder="你刚刚在做什么？"
                autoFocus
                required
                className="input"
              />
            </div>

            {(localError || (isEdit ? props.errorMessage : null)) && (
              <div className="small" style={{ color: '#fda4af', marginBottom: 8 }}>
                {localError ?? (isEdit ? props.errorMessage : null)}
              </div>
            )}

            <div className="dialog-actions" style={{ justifyContent: actionJustify }}>
              {(isEdit || shouldShowStartButton) && (
                <div className="toolbar-row">
                  {isEdit && (
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} className="btn btn-ghost">
                      删除
                    </button>
                  )}
                  {shouldShowStartButton && (
                    <button type="button" onClick={handleStart} className="btn btn-secondary">
                      开始
                    </button>
                  )}
                </div>
              )}
              <div className="toolbar-row">
                <button type="button" onClick={props.onCancel} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEdit ? '保存修改' : '创建条目'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div>
            <p style={{ marginBottom: '24px' }}>确认删除该时间条目吗？</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                取消
              </button>
              <button type="button" onClick={() => props.onDelete(props.entry.id)} className="btn btn-danger">
                删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
