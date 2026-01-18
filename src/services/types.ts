// Auto-generated types from Rust

export interface TimeEntry {
  id: number;
  start_time: number;
  end_time: number;
  label: string;
  color?: string;
}

export interface TimeEntryInput {
  start_time: number;
  end_time: number;
  label: string;
  color?: string;
}

export interface TimeEntryUpdate {
  label?: string;
  color?: string;
}

export interface WindowActivity {
  id: number;
  timestamp: number;
  window_title: string;
  process_name: string;
}

export interface IdlePeriod {
  id: number;
  start_time: number;
  end_time: number;
  resolution?: string;
}

export interface IdlePeriodResolution {
  id: number;
  resolution: string;
  target_entry_id?: number;
  new_entry_label?: string;
}

export interface SearchResult {
  type: string;
  timestamp: number;
  title: string;
  process_name?: string;
}

export interface ScreenshotInfo {
  file_path?: string;
  placeholder?: string;
}

export interface ExportData {
  version: string;
  exported_at: string;
  time_entries: TimeEntry[];
  screenshots: ScreenshotRef[];
  window_activities: WindowActivity[];
  idle_periods: IdlePeriod[];
}

export interface ScreenshotRef {
  timestamp: number;
  file_path: string;
}
