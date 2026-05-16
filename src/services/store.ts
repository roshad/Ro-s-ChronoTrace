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
  uiScale: number;
  setSelectedDate: (date: Date) => void;
  setDragSelection: (selection: { start: number; end: number } | null) => void;
  startTimer: (timer: ActiveTimer) => void;
  updateActiveTimerLabel: (label: string) => void;
  updateActiveTimerCategory: (categoryId?: number) => void;
  stopTimer: () => void;
  setUiScale: (scale: number | ((prev: number) => number)) => void;
}

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set) => ({
      selectedDate: new Date(),
      dragSelection: null,
      activeTimer: null,
      uiScale: 1,
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
      setUiScale: (scale) => set((state) => ({ 
        uiScale: typeof scale === 'function' ? scale(state.uiScale) : scale 
      })),
    }),
    {
      name: 'timeline-store',
      partialize: (state) => ({ activeTimer: state.activeTimer, uiScale: state.uiScale }),
    }
  )
);
