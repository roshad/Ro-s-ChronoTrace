import { TimeEntry } from '../../services/api';

export type EntryContinuationMode = 'extend' | 'new-entry';

export const getEntryContinuationMode = (
  entry: TimeEntry,
  timeEntries: TimeEntry[]
): EntryContinuationMode => (
  timeEntries.some((candidate) => (
    candidate.id !== entry.id && candidate.end_time > entry.end_time
  ))
    ? 'new-entry'
    : 'extend'
);
