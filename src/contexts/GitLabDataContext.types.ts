import type { ITask, ILink } from '@svar-ui/gantt-store';
import type {
  GitLabMilestone,
  GitLabEpic,
  GitLabSyncOptions,
} from '../types/gitlab';
import type { SyncState } from '../hooks/useGitLabSync';
import type { FilterPreset } from '../types/filterPreset';
import type { GitLabDataProvider } from '../providers/GitLabDataProvider';
import type { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider';

/** Server filter options from GitLab (labels, milestones, members) */
export interface ServerFilterOptions {
  labels?: Array<{ name: string; color: string }>;
  milestones?: Array<{ id: number; title: string; iid: number }>;
  members?: Array<{ id: number; username: string; name: string }>;
}

/** GitLab project/group configuration */
export interface GitLabConfig {
  id: string;
  type: 'project' | 'group';
  projectId?: string;
  groupId?: string;
  credentialId?: string;
}

/** Proxy configuration for API calls */
export interface ProxyConfig {
  gitlabUrl: string;
  token: string;
}

/** Toast notification function type */
export type ShowToastFn = (
  message: string,
  type?: 'info' | 'success' | 'warning' | 'error',
) => void;

/** GitLabDataContext value type */
export interface GitLabDataContextValue {
  // === Core Data ===
  tasks: ITask[];
  links: ILink[];
  milestones: GitLabMilestone[];
  epics: GitLabEpic[];

  // === Sync State & Actions ===
  syncState: SyncState;
  sync: (options?: GitLabSyncOptions) => Promise<void>;
  syncTask: (id: number | string, updates: Partial<ITask>) => Promise<void>;
  createTask: (task: Partial<ITask>) => Promise<ITask>;
  createMilestone: (milestone: Partial<ITask>) => Promise<ITask>;
  deleteTask: (id: number | string, taskData?: ITask) => Promise<void>;
  createLink: (link: Partial<ILink>) => Promise<void>;
  deleteLink: (
    linkId: number | string,
    apiSourceIid: number | string,
    linkedWorkItemGlobalId: string | undefined,
    options?: {
      isNativeLink?: boolean;
      metadataRelation?: 'blocks' | 'blocked_by';
      metadataTargetIid?: number;
    },
  ) => Promise<void>;

  // === Configuration ===
  currentConfig: GitLabConfig | null;
  provider: GitLabDataProvider | GitLabGraphQLProvider | null;
  configs: GitLabConfig[];
  reloadConfigs: () => void;
  handleConfigChange: (config: GitLabConfig) => void;
  handleQuickSwitch: (configId: string) => void;
  projectPath: string;
  proxyConfig: ProxyConfig | null;
  configVersion: number;

  // === Filter State ===
  filterOptions: Record<string, unknown>;
  setFilterOptions: (options: Record<string, unknown>) => void;
  serverFilterOptions: ServerFilterOptions | null;
  serverFilterOptionsLoading: boolean;
  activeServerFilters: GitLabSyncOptions | null;
  setActiveServerFilters: (filters: GitLabSyncOptions | null) => void;

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
  canEditHolidays: boolean;

  // === Holidays & Workdays ===
  holidays: Date[];
  workdays: Date[];
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
}
