import React from 'react';
import { TimeEntryInput } from '../../services/api';
import { TimeEntryDialog } from './TimeEntryDialog';

interface EntryDialogProps {
  startTime: number;
  endTime: number;
  initialLabel?: string;
  onSubmit: (entry: TimeEntryInput) => void;
  onStart?: (draft: { label: string; categoryId?: number }) => void;
  showStartAction?: boolean;
  onCancel: () => void;
}

export const EntryDialog: React.FC<EntryDialogProps> = ({
  startTime,
  endTime,
  initialLabel,
  onSubmit,
  onStart,
  showStartAction,
  onCancel,
}) => (
  <TimeEntryDialog
    mode="create"
    startTime={startTime}
    endTime={endTime}
    initialLabel={initialLabel}
    onCreate={onSubmit}
    onStart={onStart}
    showStartAction={showStartAction}
    onCancel={onCancel}
  />
);
