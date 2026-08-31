import { TimeEntry } from '../../services/api';

export type EntryContinuationPlan = {
  action: 'extend-selected' | 'create-after-latest';
  gapStartTime: number;
};

export const getEntryContinuationPlan = (
  entry: TimeEntry,
  timeEntries: TimeEntry[]
): EntryContinuationPlan => {
  const latestEntry = timeEntries.reduce((latest, candidate) => {
    if (candidate.end_time !== latest.end_time) {
      return candidate.end_time > latest.end_time ? candidate : latest;
    }
    if (candidate.start_time !== latest.start_time) {
      return candidate.start_time > latest.start_time ? candidate : latest;
    }
    return candidate.id > latest.id ? candidate : latest;
  }, entry);

  return {
    action: latestEntry.id === entry.id ? 'extend-selected' : 'create-after-latest',
    gapStartTime: latestEntry.end_time,
  };
};
