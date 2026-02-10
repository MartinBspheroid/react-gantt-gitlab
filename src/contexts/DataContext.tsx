/**
 * DataContext
 *
 * Generic data context for working with any data source (GitLab, Azure DevOps, custom).
 * Provides access to tasks, links, sync operations, and filter state.
 *
 * This context replaces the GitLab-specific GitLabDataContext with a data-source-agnostic
 * version that works with any provider implementing DataProviderInterface.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  DataContextValue,
  FilterOptions,
  DataSourceConfig,
} from './DataContext.types';
import type { SyncOptions } from '../providers/core/DataProviderInterface';
import { useDataSync } from '../hooks/useDataSync';
import { useFilterPresets } from '../hooks/useFilterPresets';
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
  /** Initial config ID to load */
  initialConfigId?: string;
  /** Whether to auto-sync on mount */
  autoSync?: boolean;
}

/**
 * DataProvider
 *
 * Provider component that manages data state and exposes it via context.
 * Coordinates:
 * - Data source configuration and provider creation
 * - Data synchronization (sync, createTask, deleteTask, etc.)
 * - Filter state and presets
 * - Toast notifications
 *
 * Note: This is a minimal implementation that provides the core data layer.
 * Additional features like holidays, workdays, and source-specific features
 * should be managed by adapters or specialized hooks.
 */
export function DataProvider({
  children,
  initialConfigId,
  autoSync = false,
}: DataProviderProps) {
  // === Configuration State ===
  // TODO: Implement configuration management using DataSourceConfigManager
  // For now, accept null provider to allow flexibility during transition
  const [currentConfig, setCurrentConfig] = useState<DataSourceConfig | null>(
    null,
  );
  const [provider, setProvider] = useState<any>(null); // TODO: Use DataProviderInterface type
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
  const [canEdit, setCanEdit] = useState(false);

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

  // === Filter Presets ===
  // TODO: Implement preset management - for now use stub
  const [filterPresets, setFilterPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsSaving, setPresetsSaving] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);
  const [filterDirty, setFilterDirty] = useState(false);

  // === Configuration Management ===
  const reloadConfigs = useCallback(() => {
    // TODO: Load configs from DataSourceConfigManager
  }, []);

  const handleConfigChange = useCallback((config: DataSourceConfig) => {
    // TODO: Create provider from config using DataProviderFactory
    setCurrentConfig(config);
    // Clear filter state when switching config
    setFilterOptions({});
    setServerFilterOptions(null);
    setActiveServerFilters(null);
  }, []);

  const handleQuickSwitch = useCallback((configId: string) => {
    // TODO: Implement quick switch using configs
  }, []);

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
    async (serverFilters: unknown, isUserAction = false) => {
      // TODO: Implement server filter application
    },
    [],
  );

  const handlePresetSelect = useCallback((presetId: string | null) => {
    // TODO: Implement preset selection
  }, []);

  // === Filter Preset Operations ===
  const createNewPreset = useCallback(async (name: string, filters: unknown) => {
    // TODO: Implement using preset manager
  }, []);

  const updatePreset = useCallback(async (id: string, filters: unknown) => {
    // TODO: Implement using preset manager
  }, []);

  const renamePreset = useCallback(async (id: string, name: string) => {
    // TODO: Implement using preset manager
  }, []);

  const deletePreset = useCallback(async (id: string) => {
    // TODO: Implement using preset manager
  }, []);

  // === Context Value ===
  const value = useMemo<DataContextValue>(
    () => ({
      // Core Data
      tasks,
      links,
      metadata,

      // Sync State & Actions
      syncState,
      sync,
      syncTask,
      reorderTaskLocal,
      createTask,
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

      // Utilities
      showToast,
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
      showToast,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </DataContext.Provider>
  );
}
