import React from 'react';
import { TimeEntry, TimeEntryUpdate } from '../../services/api';
import { TimeEntryDialog } from './TimeEntryDialog';

interface EditEntryDialogProps {
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onContinue: (entry: TimeEntry) => void;
  onCancel: () => void;
  errorMessage?: string | null;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({
  entry,
  onSave,
  onDelete,
  onContinue,
  onCancel,
  errorMessage,
}) => (
  <TimeEntryDialog
    mode="edit"
    entry={entry}
    onSave={onSave}
    onDelete={onDelete}
    onContinue={onContinue}
    onCancel={onCancel}
    errorMessage={errorMessage}
  />
);
