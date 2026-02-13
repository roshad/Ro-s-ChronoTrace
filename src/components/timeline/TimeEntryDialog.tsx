import React, { useEffect, useState } from 'react';
import { TimeEntry, TimeEntryInput, TimeEntryUpdate } from '../../services/api';
import { CategorySelector } from './CategorySelector';

type CreateDialogProps = {
  mode: 'create';
  startTime: number;
  endTime: number;
  initialLabel?: string;
  onCreate: (entry: TimeEntryInput) => void;
  onCancel: () => void;
};

type EditDialogProps = {
  mode: 'edit';
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onRestart: (entry: TimeEntry) => void;
  onCancel: () => void;
  errorMessage?: string | null;
};

type TimeEntryDialogProps = CreateDialogProps | EditDialogProps;

const formatTimeInput = (timestamp: number) => {
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseTimeInput = (value: string, baseTimestamp: number) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const base = new Date(baseTimestamp);
  base.setHours(hours, minutes, 0, 0);
  return base.getTime();
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const getDurationText = (startTime: number, endTime: number) => {
  const durationMs = Math.max(0, endTime - startTime);
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  return `${hours}小时 ${minutes}分钟`;
};

export const TimeEntryDialog: React.FC<TimeEntryDialogProps> = (props) => {
  const isEdit = props.mode === 'edit';
  const sourceStartTime = isEdit ? props.entry.start_time : props.startTime;
  const sourceEndTime = isEdit ? props.entry.end_time : props.endTime;
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
      setLocalError('时间格式无效，请使用 HH:mm。');
      return;
    }

    const parsedEndTime = parseTimeInput(endTimeInput, sourceEndTime);
    if (!parsedEndTime) {
      setLocalError('时间格式无效，请使用 HH:mm。');
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

            <div className="dialog-actions" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
              {isEdit && (
                <div className="toolbar-row">
                  <button type="button" onClick={() => setShowDeleteConfirm(true)} className="btn btn-ghost">
                    删除
                  </button>
                  <button type="button" onClick={() => props.onRestart(props.entry)} className="btn btn-secondary">
                    重新开始
                  </button>
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
