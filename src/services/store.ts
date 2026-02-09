import { create } from 'zustand';

interface ActiveTimer {
  entryId: number;
  startTime: number;
  label: string;
  categoryId?: number;
}

interface TimelineState {
  selectedDate: Date;
  dragSelection: { start: number; end: number } | null;
  activeTimer: ActiveTimer | null;
  setSelectedDate: (date: Date) => void;
  setDragSelection: (selection: { start: number; end: number } | null) => void;
  startTimer: (timer: ActiveTimer) => void;
  stopTimer: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  selectedDate: new Date(),
  dragSelection: null,
  activeTimer: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDragSelection: (selection) => set({ dragSelection: selection }),
  startTimer: (timer) => set({ activeTimer: timer }),
  stopTimer: () => set({ activeTimer: null }),
}));
