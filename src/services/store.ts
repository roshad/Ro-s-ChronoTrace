import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  updateActiveTimerLabel: (label: string) => void;
  updateActiveTimerCategory: (categoryId?: number) => void;
  stopTimer: () => void;
}

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set) => ({
      selectedDate: new Date(),
      dragSelection: null,
      activeTimer: null,
      setSelectedDate: (date) => set({ selectedDate: date }),
      setDragSelection: (selection) => set({ dragSelection: selection }),
      startTimer: (timer) => set({ activeTimer: timer }),
      updateActiveTimerLabel: (label) =>
        set((state) => ({
          activeTimer: state.activeTimer ? { ...state.activeTimer, label } : null,
        })),
      updateActiveTimerCategory: (categoryId) =>
        set((state) => ({
          activeTimer: state.activeTimer ? { ...state.activeTimer, categoryId } : null,
        })),
      stopTimer: () => set({ activeTimer: null }),
    }),
    {
      name: 'timeline-store',
      partialize: (state) => ({ activeTimer: state.activeTimer }),
    }
  )
);
