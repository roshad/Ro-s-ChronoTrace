import { create } from 'zustand';

interface TimelineState {
  selectedDate: Date;
  dragSelection: { start: number; end: number } | null;
  setSelectedDate: (date: Date) => void;
  setDragSelection: (selection: { start: number; end: number } | null) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  selectedDate: new Date(),
  dragSelection: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDragSelection: (selection) => set({ dragSelection: selection }),
}));
