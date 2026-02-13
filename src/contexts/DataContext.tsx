/**
 * DataContext
 *
 * Generic data context for working with any data source.
 * Provides access to tasks, links, sync operations, filter state,
 * holidays/workdays, and highlight time calculations.
 *
 * This is the sole data context - replaces the former provider-specific context.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  DataContextValue,
  FilterOptions,
  DataSourceConfig,
  HolidayEntry,
} from './DataContext.types';
import type {
  SyncOptions,
  DataProviderInterface,
} from '../providers/core/DataProviderInterface';
import type { ITask } from '@svar-ui/gantt-store';
import { useDataSync } from '../hooks/useDataSync';
import { useHighlightTime } from '../hooks/useHighlightTime';
import { ToastContainer, useToast } from '../components/Toast';

/**
 * DataContext - React context for shared data operations
 */
const DataContext = createContext<DataContextValue | null>(null);

/**
 * Hook to access data context
 * @throws Error if used outside of DataProvider
 */
export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

/**
 * Hook to optionally access data context
 * Returns null if used outside of DataProvider (no error)
 */
export function useDataOptional(): DataContextValue | null {
  return useContext(DataContext);
}

export interface DataProviderProps {
  children: ReactNode;
  /** Data provider instance */
  provider: DataProviderInterface;
  /** Whether to auto-sync on mount */
  autoSync?: boolean;
}

/**
 * DataProvider
 *
 * Provider component that manages data state and exposes it via context.
 * Accepts a pre-built provider instance (no internal provider creation).
 */
export function DataProvider({
  children,
  provider,
  autoSync = true,
}: DataProviderProps) {
  // === Configuration State ===
  const [currentConfig, setCurrentConfig] = useState<DataSourceConfig | null>(
    null,
  );
  const [configs, setConfigs] = useState<DataSourceConfig[]>([]);
  const [projectPath, setProjectPath] = useState('');

  // === Filter State ===
  const [filterOptions, setFilterOptions] = useState<Record<string, unknown>>(
    {},
  );
  const [serverFilterOptions, setServerFilterOptions] =
    useState<FilterOptions | null>(null);
  const [serverFilterOptionsLoading, setServerFilterOptionsLoading] =
    useState(false);
  const [activeServerFilters, setActiveServerFilters] =
    useState<SyncOptions | null>(null);

  // === Permissions ===
  const [canEdit, setCanEdit] = useState(true);
  const [canEditHolidays, setCanEditHolidays] = useState(false);

  // === Holidays & Workdays (local state, no API) ===
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [workdays, setWorkdays] = useState<HolidayEntry[]>([]);
  const [colorRules, setColorRules] = useState<unknown[]>([]);
  const [holidaysText, setHolidaysText] = useState('');
  const [workdaysText, setWorkdaysText] = useState('');

  // === Toast ===
  const { toasts, showToast, removeToast } = useToast();

  // === Data Sync ===
  const {
    tasks,
    links,
    metadata,
    syncState,
    sync,
    syncTask,
    reorderTaskLocal,
    createTask,
    deleteTask,
    createLink,
    deleteLink,
  } = useDataSync(provider, autoSync);

  // === Highlight Time ===
  const { countWorkdays, calculateEndDateByWorkdays, highlightTime } =
    useHighlightTime({ holidays, workdays });

  // === Filter Presets (stub) ===
  const [filterPresets, setFilterPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsSaving, setPresetsSaving] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);
  const [filterDirty, setFilterDirty] = useState(false);

  // === Configuration Management ===
  const reloadConfigs = useCallback(() => {}, []);

  const handleConfigChange = useCallback((config: DataSourceConfig) => {
    setCurrentConfig(config);
    setFilterOptions({});
    setServerFilterOptions(null);
    setActiveServerFilters(null);
  }, []);

  const handleQuickSwitch = useCallback((configId: string) => {}, []);

  // === Filter Management ===
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>, isUserAction = false) => {
      setFilterOptions(newFilters);
      if (isUserAction) {
        setFilterDirty(true);
      }
    },
    [],
  );

  const handleServerFilterApply = useCallback(
    async (serverFilters: unknown, isUserAction = false) => {},
    [],
  );

  const handlePresetSelect = useCallback((presetId: string | null) => {}, []);

  const createNewPreset = useCallback(
    async (name: string, filters: unknown) => {},
    [],
  );
  const updatePreset = useCallback(
    async (id: string, filters: unknown) => {},
    [],
  );
  const renamePreset = useCallback(async (id: string, name: string) => {}, []);
  const deletePreset = useCallback(async (id: string) => {}, []);

  // === createMilestone (delegates to createTask) ===
  const createMilestone = useCallback(
    async (milestone: Partial<ITask>) => {
      return createTask(milestone);
    },
    [createTask],
  );

  // === Context Value ===
  const value = useMemo<DataContextValue>(
    () => ({
      // Core Data
      tasks,
      links,
      metadata,
      milestones: [],
      epics: [],

      // Sync State & Actions
      syncState,
      sync,
      syncTask,
      reorderTaskLocal,
      createTask,
      createMilestone,
      deleteTask,
      createLink,
      deleteLink,

      // Configuration
      currentConfig,
      provider,
      configs,
      reloadConfigs,
      handleConfigChange,
      handleQuickSwitch,
      projectPath,
      proxyConfig: null,
      configVersion: 0,

      // Filter State
      filterOptions,
      setFilterOptions,
      serverFilterOptions,
      serverFilterOptionsLoading,
      activeServerFilters,
      setActiveServerFilters,

      // Filter Presets
      filterPresets,
      presetsLoading,
      presetsSaving,
      createNewPreset,
      updatePreset,
      renamePreset,
      deletePreset,
      lastUsedPresetId,
      filterDirty,
      handlePresetSelect,
      handleFilterChange,
      handleServerFilterApply,

      // Permissions
      canEdit,
      canEditHolidays,

      // Holidays & Workdays
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      holidaysLoading: false,
      holidaysSaving: false,
      holidaysError: null,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,

      // Utilities
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
      highlightTime,
    }),
    [
      tasks,
      links,
      metadata,
      syncState,
      sync,
      syncTask,
      reorderTaskLocal,
      createTask,
      createMilestone,
      deleteTask,
      createLink,
      deleteLink,
      currentConfig,
      provider,
      configs,
      reloadConfigs,
      handleConfigChange,
      handleQuickSwitch,
      projectPath,
      filterOptions,
      setFilterOptions,
      serverFilterOptions,
      serverFilterOptionsLoading,
      activeServerFilters,
      setActiveServerFilters,
      filterPresets,
      presetsLoading,
      presetsSaving,
      createNewPreset,
      updatePreset,
      renamePreset,
      deletePreset,
      lastUsedPresetId,
      filterDirty,
      handlePresetSelect,
      handleFilterChange,
      handleServerFilterApply,
      canEdit,
      canEditHolidays,
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
      highlightTime,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </DataContext.Provider>
  );
}
