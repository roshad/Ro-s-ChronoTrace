import React from 'react';
import { TimeEntry, TimeEntryUpdate } from '../../services/api';
import { TimeEntryDialog } from './TimeEntryDialog';

interface EditEntryDialogProps {
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onRestart: (entry: TimeEntry) => void;
  onCancel: () => void;
  errorMessage?: string | null;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({
  entry,
  onSave,
  onDelete,
  onRestart,
  onCancel,
  errorMessage,
}) => (
  <TimeEntryDialog
    mode="edit"
    entry={entry}
    onSave={onSave}
    onDelete={onDelete}
    onRestart={onRestart}
    onCancel={onCancel}
    errorMessage={errorMessage}
  />
);
