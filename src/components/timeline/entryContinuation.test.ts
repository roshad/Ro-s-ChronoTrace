import { TimeEntry } from '../../services/api';
import { getEntryContinuationPlan } from './entryContinuation';

const entry = (id: number, start_time: number, end_time: number): TimeEntry => ({
  id,
  start_time,
  end_time,
  label: `行为 ${id}`,
});

describe('getEntryContinuationPlan', () => {
  it('extends the selected entry from the beginning of the final gap', () => {
    const selected = entry(2, 2000, 3000);

    expect(getEntryContinuationPlan(selected, [entry(1, 1000, 2000), selected])).toEqual({
      action: 'extend-selected',
      gapStartTime: 3000,
    });
  });

  it('creates the selected behavior after the latest entry when another behavior follows it', () => {
    const selected = entry(1, 1000, 2000);

    expect(getEntryContinuationPlan(selected, [selected, entry(2, 2500, 4000)])).toEqual({
      action: 'create-after-latest',
      gapStartTime: 4000,
    });
  });

  it('finds the latest entry regardless of input order', () => {
    const selected = entry(1, 1000, 2000);

    expect(getEntryContinuationPlan(selected, [entry(3, 4000, 5000), selected, entry(2, 2500, 3000)])).toEqual({
      action: 'create-after-latest',
      gapStartTime: 5000,
    });
  });
});
