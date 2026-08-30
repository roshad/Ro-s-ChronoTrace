import { TimeEntry } from '../../services/api';
import { getEntryContinuationMode } from './entryContinuation';

const entry = (id: number, start_time: number, end_time: number): TimeEntry => ({
  id,
  start_time,
  end_time,
  label: `行为 ${id}`,
});

describe('getEntryContinuationMode', () => {
  it('extends the selected entry when no later behavior exists', () => {
    const selected = entry(2, 2000, 3000);

    expect(getEntryContinuationMode(selected, [entry(1, 1000, 2000), selected])).toBe('extend');
  });

  it('creates a new entry when another behavior follows the selected entry', () => {
    const selected = entry(1, 1000, 2000);

    expect(getEntryContinuationMode(selected, [selected, entry(2, 2500, 3000)])).toBe('new-entry');
  });
});
