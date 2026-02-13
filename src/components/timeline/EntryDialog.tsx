import React from 'react';
import { TimeEntryInput } from '../../services/api';
import { TimeEntryDialog } from './TimeEntryDialog';

interface EntryDialogProps {
  startTime: number;
  endTime: number;
  initialLabel?: string;
  onSubmit: (entry: TimeEntryInput) => void;
  onCancel: () => void;
}

export const EntryDialog: React.FC<EntryDialogProps> = ({
  startTime,
  endTime,
  initialLabel,
  onSubmit,
  onCancel,
}) => (
  <TimeEntryDialog
    mode="create"
    startTime={startTime}
    endTime={endTime}
    initialLabel={initialLabel}
    onCreate={onSubmit}
    onCancel={onCancel}
  />
);
