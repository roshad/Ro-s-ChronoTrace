import React from 'react';
import { TimeEntry, TimeEntryUpdate } from '../../services/api';
import { TimeEntryDialog } from './TimeEntryDialog';
import { EntryContinuationMode } from './entryContinuation';

interface EditEntryDialogProps {
  entry: TimeEntry;
  onSave: (id: number, updates: TimeEntryUpdate) => void;
  onDelete: (id: number) => void;
  onContinue: (entry: TimeEntry) => void;
  continueMode: EntryContinuationMode;
  onCancel: () => void;
  errorMessage?: string | null;
}

export const EditEntryDialog: React.FC<EditEntryDialogProps> = ({
  entry,
  onSave,
  onDelete,
  onContinue,
  continueMode,
  onCancel,
  errorMessage,
}) => (
  <TimeEntryDialog
    mode="edit"
    entry={entry}
    onSave={onSave}
    onDelete={onDelete}
    onContinue={onContinue}
    continueMode={continueMode}
    onCancel={onCancel}
    errorMessage={errorMessage}
  />
);
