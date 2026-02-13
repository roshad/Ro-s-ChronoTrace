import { invoke } from '@tauri-apps/api/core';

// Type definitions (matching Rust types)
export interface TimeEntry {
  id: number;
  start_time: number;
  end_time: number;
  label: string;
  color?: string;
  category_id?: number;
}

export interface TimeEntryInput {
  start_time: number;
  end_time: number;
  label: string;
  color?: string;
  category_id?: number;
}

export interface TimeEntryUpdate {
  start_time?: number;
  end_time?: number;
  label?: string;
  color?: string;
  category_id?: number | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface CategoryInput {
  name: string;
  color: string;
}

export interface ScreenshotInfo {
  file_path?: string;
  data_url?: string;
  placeholder?: string;
}

export interface ScreenshotSettings {
  quality: number;
  max_width: number;
  max_file_kb: number;
  storage_dir?: string;
}

export interface SearchResult {
  type: 'time_entry' | 'window_activity';
  timestamp: number;
  title: string;
  process_name?: string;
}

export interface ProcessSample {
  timestamp: number;
  process_name: string;
}

export interface ExportData {
  version: string;
  exported_at: string;
  time_entries: TimeEntry[];
  screenshots: Array<{ timestamp: number; file_path: string }>;
  window_activities: Array<{
    id: number;
    timestamp: number;
    window_title: string;
    process_name: string;
  }>;
  idle_periods: Array<{
    id: number;
    start_time: number;
    end_time: number;
    resolution?: string;
  }>;
}

// API functions
export const api = {
  // Time entries
  getTimeEntries: (date: number): Promise<TimeEntry[]> =>
    invoke('get_time_entries', { date }),

  getTimeEntriesByRange: (startTime: number, endTime: number): Promise<TimeEntry[]> =>
    invoke('get_time_entries_by_range', { startTime, endTime }),

  createTimeEntry: (entry: TimeEntryInput): Promise<TimeEntry> =>
    invoke('create_time_entry', { entry }),

  updateTimeEntry: (id: number, updates: TimeEntryUpdate): Promise<TimeEntry> =>
    invoke('update_time_entry', { id, updates }),

  deleteTimeEntry: (id: number): Promise<void> =>
    invoke('delete_time_entry', { id }),

  // Screenshots
  getScreenshotForTime: (timestamp: number): Promise<ScreenshotInfo> =>
    invoke('get_screenshot_for_time', { timestamp }),

  getScreenshotTimestampsForDay: (date: number): Promise<number[]> =>
    invoke('get_screenshot_timestamps_for_day', { date }),

  getProcessSamplesForDay: (date: number): Promise<ProcessSample[]> =>
    invoke('get_process_samples_for_day', { date }),

  getScreenshotSettings: (): Promise<ScreenshotSettings> =>
    invoke('get_screenshot_settings_cmd'),

  updateScreenshotSettings: (settings: ScreenshotSettings): Promise<ScreenshotSettings> =>
    invoke('update_screenshot_settings_cmd', { settings }),

  resolveScreenshotStorageDir: (storageDir?: string): Promise<string> =>
    invoke('resolve_screenshot_storage_dir_cmd', { storageDir }),

  resolveScreenshotFilePath: (storedPath: string): Promise<string> =>
    invoke('resolve_screenshot_file_path_cmd', { storedPath }),

  // Search
  searchActivities: (query: string): Promise<SearchResult[]> =>
    invoke('search_activities_cmd', { query }),

  searchActivitiesByRange: (query: string, startTime: number, endTime: number): Promise<SearchResult[]> =>
    invoke('search_activities_by_range_cmd', { query, startTime, endTime }),

  // Export
  exportData: (): Promise<ExportData> =>
    invoke('export_data_cmd'),

  // Categories
  getCategories: (): Promise<Category[]> =>
    invoke('get_categories'),

  createCategory: (category: CategoryInput): Promise<Category> =>
    invoke('create_category', { category }),

  updateCategory: (id: number, category: CategoryInput): Promise<Category> =>
    invoke('update_category', { id, category }),

  deleteCategory: (id: number): Promise<void> =>
    invoke('delete_category', { id }),

  // Idle
  resolveIdlePeriod: (resolution: {
    id: number;
    resolution: string;
    target_entry_id?: number;
    new_entry_label?: string;
  }): Promise<any> =>
    invoke('resolve_idle_period', { resolution }),
};
