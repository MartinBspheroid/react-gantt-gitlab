/**
 * Generic Data Context Types
 *
 * These types are data-source agnostic and work with any provider
 * implementing DataProviderInterface.
 */

import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  DataProviderInterface,
  SyncOptions,
} from '../providers/core/DataProviderInterface';
import type { SyncState } from '../hooks/useDataSync';
import type { FilterPreset } from '../types/filterPreset';

/** Filter options available from data source (labels, milestones, members) */
export interface FilterOptions {
  labels?: Array<{ title: string; color?: string }>;
  milestones?: Array<{ id: string | number; title: string }>;
  members?: Array<{ username: string; name: string }>;
  assignees?: Array<{ username: string; name: string } | string>;
}

/** Generic data source configuration */
export interface DataSourceConfig {
  id: string;
  type: string;
  credentialId?: string;
  projectId?: string | number;
  metadata?: Record<string, unknown>;
}

/** Holiday entry */
export interface HolidayEntry {
  date: string;
  name?: string;
}

/** Toast notification function type */
export type ShowToastFn = (
  message: string,
  type?: 'info' | 'success' | 'warning' | 'error',
) => void;

/** Data Context value type */
export interface DataContextValue {
  // === Core Data ===
  tasks: ITask[];
  links: ILink[];
  metadata: Record<string, unknown>;
  milestones: unknown[];
  epics: unknown[];

  // === Sync State & Actions ===
  syncState: SyncState;
  sync: (options?: SyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<ITask>;
  reorderTaskLocal: (
    taskId: number | string,
    targetTaskId: number | string,
    position: 'before' | 'after',
  ) => { rollback: () => void };
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  createMilestone: (milestone: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string, taskData?: ITask) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<ILink>;
  deleteLink: (linkId: number | string, ...args: unknown[]) => Promise<void>;

  // === Configuration ===
  currentConfig: DataSourceConfig | null;
  provider: DataProviderInterface | null;
  configs: DataSourceConfig[];
  reloadConfigs: () => void;
  handleConfigChange: (config: DataSourceConfig) => void;
  handleQuickSwitch: (configId: string) => void;
  projectPath: string;
  proxyConfig: unknown | null;
  configVersion: number;

  // === Filter State ===
  filterOptions: Record<string, unknown>;
  setFilterOptions: (options: Record<string, unknown>) => void;
  serverFilterOptions: FilterOptions | null;
  serverFilterOptionsLoading: boolean;
  activeServerFilters: SyncOptions | null;
  setActiveServerFilters: (filters: SyncOptions | null) => void;

  // === Filter Presets ===
  filterPresets: FilterPreset[];
  presetsLoading: boolean;
  presetsSaving: boolean;
  createNewPreset: (name: string, filters: unknown) => Promise<void>;
  updatePreset: (id: string, filters: unknown) => Promise<void>;
  renamePreset: (id: string, name: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  lastUsedPresetId: string | null;
  filterDirty: boolean;
  handlePresetSelect: (presetId: string | null) => void;
  handleFilterChange: (
    newFilters: Record<string, unknown>,
    isUserAction?: boolean,
  ) => void;
  handleServerFilterApply: (
    serverFilters: unknown,
    isUserAction?: boolean,
  ) => Promise<void>;

  // === Permissions ===
  canEdit: boolean;
  canEditHolidays: boolean;

  // === Holidays & Workdays ===
  holidays: HolidayEntry[];
  workdays: HolidayEntry[];
  colorRules: unknown[];
  holidaysText: string;
  workdaysText: string;
  holidaysLoading: boolean;
  holidaysSaving: boolean;
  holidaysError: string | null;
  setHolidaysText: (text: string) => void;
  setWorkdaysText: (text: string) => void;
  setColorRules: (rules: unknown[]) => void;

  // === Utility Functions ===
  showToast: ShowToastFn;
  countWorkdays: (start: Date, end: Date) => number;
  calculateEndDateByWorkdays: (start: Date, workdays: number) => Date;
  highlightTime: (date: Date, unit: string) => string;
}
