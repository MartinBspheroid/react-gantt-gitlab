/**
 * GitLabDataContext
 *
 * Shared context for GitLab data between Gantt and Kanban views.
 * Provides access to tasks, links, sync operations, and filter state.
 *
 * This context extracts the shared data layer from GitLabGantt.jsx to enable
 * multiple views (Gantt, Kanban) to share the same data and synchronization logic.
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
  GitLabDataContextValue,
  ServerFilterOptions,
  GitLabConfig,
} from './GitLabDataContext.types';
import type { GitLabSyncOptions } from '../types/gitlab';
import { useProjectConfig } from '../hooks/useProjectConfig';
import { useGitLabSync } from '../hooks/useGitLabSync';
import { useGitLabHolidays } from '../hooks/useGitLabHolidays';
import { useFilterPresets } from '../hooks/useFilterPresets';
import { useHighlightTime } from '../hooks/useHighlightTime';
import { ToastContainer, useToast } from '../components/Toast';
import { toGitLabServerFilters } from '../utils/GitLabFilters';
import {
  loadProjectSettings,
  updateProjectFilterSettings,
  createStoredFilters,
  restoreFilterOptions,
  isFilterEmpty,
  hasServerFilters as checkHasServerFilters,
  hasClientFilters as checkHasClientFilters,
} from '../types/projectSettings';

/**
 * GitLabDataContext - React context for shared GitLab data
 */
const GitLabDataContext = createContext<GitLabDataContextValue | null>(null);

/**
 * Hook to access GitLab data context
 * @throws Error if used outside of GitLabDataProvider
 */
export function useGitLabData(): GitLabDataContextValue {
  const context = useContext(GitLabDataContext);
  if (!context) {
    throw new Error('useGitLabData must be used within a GitLabDataProvider');
  }
  return context;
}

/**
 * Hook to optionally access GitLab data context
 * Returns null if used outside of GitLabDataProvider (no error)
 */
export function useGitLabDataOptional(): GitLabDataContextValue | null {
  return useContext(GitLabDataContext);
}

export interface GitLabDataProviderProps {
  children: ReactNode;
  /** Initial config ID to load */
  initialConfigId?: string;
  /** Whether to auto-sync on mount */
  autoSync?: boolean;
}

/**
 * GitLabDataProvider
 *
 * Provider component that manages GitLab data state and exposes it via context.
 * Extracts the shared data layer from GitLabGantt including:
 * - Project configuration management (useProjectConfig)
 * - GitLab sync operations (useGitLabSync)
 * - Holidays and workdays (useGitLabHolidays)
 * - Filter presets (useFilterPresets)
 * - Filter state persistence
 * - Initial sync with saved filters
 * - Toast notifications
 */
export function GitLabDataProvider({
  children,
  initialConfigId,
  autoSync = false,
}: GitLabDataProviderProps) {
  // === Project Configuration ===
  // Use shared project config hook for credential resolution and provider creation
  // This hook properly resolves credentialId to gitlabUrl/token
  const {
    currentConfig,
    provider,
    configs,
    reloadConfigs,
    handleConfigChange: baseHandleConfigChange,
    handleQuickSwitch,
    projectPath,
    proxyConfig,
    configVersion,
  } = useProjectConfig(initialConfigId);

  // === Filter State ===
  const [filterOptions, setFilterOptions] = useState<Record<string, unknown>>(
    {},
  );
  const [serverFilterOptions, setServerFilterOptions] =
    useState<ServerFilterOptions | null>(null);
  const [serverFilterOptionsLoading, setServerFilterOptionsLoading] =
    useState(false);
  const [activeServerFilters, setActiveServerFilters] =
    useState<GitLabSyncOptions | null>(null);

  // === Permissions ===
  // canEditHolidays: whether user has permission to edit holidays and other project settings
  const [canEditHolidays, setCanEditHolidays] = useState(false);

  // === Toast ===
  const { toasts, showToast, removeToast } = useToast();

  // === Wrap handleConfigChange to add local state cleanup ===
  // NOTE: baseHandleConfigChange from useProjectConfig handles credential resolution
  // and provider creation. This wrapper adds component-specific state cleanup.
  const handleConfigChange = useCallback(
    (config: GitLabConfig) => {
      // Clear filter options when switching project/group
      // These will be restored from project settings after presets are loaded
      setFilterOptions({});

      // Clear server filter options and active server filters
      setServerFilterOptions(null);
      setActiveServerFilters(null);

      // Call the base handler which resolves credentials and creates provider
      baseHandleConfigChange(config);
    },
    [baseHandleConfigChange],
  );

  // === GitLab Sync ===
  // Use sync hook (no auto-sync on provider change - we control initial sync timing)
  const {
    tasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    reorderTaskLocal,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
  } = useGitLabSync(provider, autoSync, 60000, {
    onWarning: (message: string) => showToast(message, 'warning'),
  });

  // === Check permissions when provider changes ===
  useEffect(() => {
    if (!provider) {
      setCanEditHolidays(false);
      return;
    }

    provider.checkCanEdit().then((canEdit: boolean) => {
      setCanEditHolidays(canEdit);
    });
  }, [provider]);

  // === Load server filter options when provider changes ===
  useEffect(() => {
    if (!provider) {
      setServerFilterOptions(null);
      return;
    }

    const loadFilterOptions = async () => {
      setServerFilterOptionsLoading(true);
      try {
        const options = await provider.getFilterOptions();
        setServerFilterOptions(options as ServerFilterOptions);
      } catch (error) {
        console.error(
          '[GitLabDataContext] Failed to load filter options:',
          error,
        );
        setServerFilterOptions(null);
      } finally {
        setServerFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
  }, [provider]);

  // === Holidays & Workdays ===
  const {
    holidays,
    workdays,
    colorRules,
    holidaysText,
    workdaysText,
    loading: holidaysLoading,
    saving: holidaysSaving,
    error: holidaysError,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
  } = useGitLabHolidays(
    projectPath,
    proxyConfig,
    canEditHolidays,
    currentConfig?.type || 'project',
  );

  // === Highlight Time (workdays calculation) ===
  const { countWorkdays, calculateEndDateByWorkdays } = useHighlightTime({
    holidays,
    workdays,
  });

  // === Filter Presets ===
  const {
    presets: filterPresets,
    loading: presetsLoading,
    saving: presetsSaving,
    createNewPreset,
    updatePreset,
    renamePreset,
    deletePreset,
  } = useFilterPresets(
    projectPath,
    proxyConfig,
    currentConfig?.type || 'project',
    canEditHolidays,
  );

  // ============================================================
  // Project Settings: Filter State Persistence
  // ============================================================

  // Get config identifier for project settings
  const getConfigIdentifier = useCallback(() => {
    if (!currentConfig) return null;
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return { type: 'project' as const, id: currentConfig.projectId };
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return { type: 'group' as const, id: currentConfig.groupId };
    }
    return null;
  }, [currentConfig]);

  // Current preset ID and dirty state
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);
  const [filterDirty, setFilterDirty] = useState(false);

  // Ref to track if we're in the middle of a preset switch
  // This prevents filter changes from marking dirty during preset application
  const isApplyingPresetRef = useRef(false);

  // Flag to skip saving filter settings during initial load
  // This prevents FilterPanel's initial mount from clearing saved settings
  const skipFilterSaveRef = useRef(true);

  // Load project settings when config changes
  useEffect(() => {
    const identifier = getConfigIdentifier();
    if (!identifier) {
      setLastUsedPresetId(null);
      setFilterDirty(false);
      return;
    }

    const settings = loadProjectSettings(identifier.type, identifier.id);
    if (settings?.filter) {
      if (settings.filter.mode === 'preset') {
        setLastUsedPresetId(settings.filter.presetId || null);
        setFilterDirty(settings.filter.dirty || false);
      } else {
        setLastUsedPresetId(null);
        setFilterDirty(false);
      }
    } else {
      setLastUsedPresetId(null);
      setFilterDirty(false);
    }
  }, [getConfigIdentifier]);

  // Save filter settings helper
  const saveFilterSettings = useCallback(
    (presetId: string | null, dirty: boolean, filters: unknown) => {
      const identifier = getConfigIdentifier();
      if (!identifier) return;

      if (presetId) {
        // Preset mode
        const settings = {
          mode: 'preset' as const,
          presetId,
          dirty: dirty || false,
          filters: dirty ? filters : undefined,
        };
        updateProjectFilterSettings(identifier.type, identifier.id, settings);
      } else if (filters && !isFilterEmpty(filters)) {
        // Custom mode (no preset selected, but has filters)
        const settings = {
          mode: 'custom' as const,
          filters,
        };
        updateProjectFilterSettings(identifier.type, identifier.id, settings);
      } else {
        // Clear filter settings
        updateProjectFilterSettings(identifier.type, identifier.id, undefined);
      }
    },
    [getConfigIdentifier],
  );

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (presetId: string | null) => {
      // Set flag to prevent filter changes from marking dirty during preset application
      isApplyingPresetRef.current = true;

      setLastUsedPresetId(presetId);
      setFilterDirty(false);
      saveFilterSettings(presetId, false, null);

      // Clear the flag after a microtask to allow React state updates to settle
      // Using queueMicrotask ensures the flag is cleared after the current render cycle
      queueMicrotask(() => {
        isApplyingPresetRef.current = false;
      });
    },
    [saveFilterSettings],
  );

  // Handle filter change (from FilterPanel)
  // @param newFilters - The new filter state
  // @param isUserAction - true if this change was triggered by user interaction (should mark dirty)
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>, isUserAction = true) => {
      setFilterOptions(newFilters);

      // Skip saving during initial load to prevent overwriting saved settings
      if (skipFilterSaveRef.current) {
        return;
      }

      // Skip saving if this is not a user action (e.g., preset application, sync from parent)
      if (!isUserAction) {
        return;
      }

      // Skip saving if we're in the middle of a preset switch
      // This is a secondary guard in case isUserAction wasn't properly set
      if (isApplyingPresetRef.current) {
        return;
      }

      // Only save client filters here - server filters are saved in handleServerFilterApply
      const stored = createStoredFilters(newFilters, null);

      // If a preset is selected, mark as dirty
      if (lastUsedPresetId) {
        setFilterDirty(true);
        saveFilterSettings(lastUsedPresetId, true, stored);
      } else {
        // No preset - save as custom
        saveFilterSettings(null, false, stored);
      }
    },
    [lastUsedPresetId, saveFilterSettings],
  );

  // Wrapped sync function that preserves fold state
  // Automatically applies activeServerFilters if set
  const syncWithFilters = useCallback(
    async (options?: GitLabSyncOptions) => {
      // Merge activeServerFilters with provided options
      // This ensures all syncs respect the current server filter settings
      const mergedOptions = {
        ...options,
        serverFilters: options?.serverFilters || activeServerFilters,
      };

      // Call original sync with merged options
      await sync(mergedOptions);
    },
    [sync, activeServerFilters],
  );

  // Handle server filter apply (from FilterPanel)
  // Wrapper around the original sync handler that also saves settings to localStorage
  // @param serverFilters - The server filter state
  // @param isUserAction - true if this change was triggered by user interaction (should mark dirty)
  const handleServerFilterApply = useCallback(
    async (serverFilters: unknown, isUserAction = true) => {
      const gitlabFilters = toGitLabServerFilters(serverFilters);
      setActiveServerFilters(gitlabFilters);

      // Skip saving if this is not a user action (e.g., preset application)
      if (!isUserAction) {
        await syncWithFilters({ serverFilters: gitlabFilters });
        return;
      }

      // If a preset is selected, mark as dirty
      if (lastUsedPresetId) {
        setFilterDirty(true);
        const stored = createStoredFilters({}, serverFilters);
        saveFilterSettings(lastUsedPresetId, true, stored);
      } else {
        // No preset - save as custom
        const stored = createStoredFilters({}, serverFilters);
        saveFilterSettings(null, false, stored);
      }

      await syncWithFilters({ serverFilters: gitlabFilters });
    },
    [lastUsedPresetId, saveFilterSettings, syncWithFilters],
  );

  // === Initial Sync Logic ===
  // These refs track sync state to ensure proper initialization sequence
  const initialSyncDoneRef = useRef(false);
  const presetsLoadedForVersionRef = useRef(-1);
  const prevPresetsLoadingRef = useRef(true);

  // Reset sync state when provider changes
  useEffect(() => {
    initialSyncDoneRef.current = false;
    prevPresetsLoadingRef.current = true;
    skipFilterSaveRef.current = true; // Re-enable skip on provider change
  }, [provider]);

  // Track presetsLoading: true -> false transition to detect when presets finish loading
  useEffect(() => {
    const transitionedToLoaded =
      prevPresetsLoadingRef.current && !presetsLoading;
    if (transitionedToLoaded && proxyConfig) {
      presetsLoadedForVersionRef.current = configVersion;
    }
    prevPresetsLoadingRef.current = presetsLoading;
  }, [presetsLoading, proxyConfig, configVersion]);

  // Trigger initial sync after presets are loaded
  // This ensures server filters from saved preset or custom settings are applied on first sync
  useEffect(() => {
    // Skip if not ready or already synced
    if (
      !provider ||
      presetsLoading ||
      !proxyConfig ||
      initialSyncDoneRef.current
    ) {
      return;
    }

    // Wait until presets have been loaded for the current config version
    // This prevents using stale preset data from a previous project
    if (presetsLoadedForVersionRef.current !== configVersion) {
      return;
    }

    initialSyncDoneRef.current = true;

    // Allow saving after a short delay to let FilterPanel's initial effect run
    // This prevents the initial mount from overwriting saved settings
    setTimeout(() => {
      skipFilterSaveRef.current = false;
    }, 100);

    // Load project settings to determine initial filters
    const identifier = getConfigIdentifier();
    if (!identifier) {
      syncWithFilters();
      return;
    }

    const settings = loadProjectSettings(identifier.type, identifier.id);

    // Helper function to perform initial sync with error handling
    const performInitialSync = async (serverFilters?: GitLabSyncOptions) => {
      try {
        await syncWithFilters(serverFilters);
      } catch (error) {
        console.error('[GitLabDataContext] Initial sync failed:', error);
        showToast(
          error instanceof Error ? error.message : 'Failed to load data',
          'error',
        );
      }
    };

    if (settings?.filter) {
      const { mode, presetId, dirty, filters } = settings.filter;

      if (mode === 'preset' && presetId) {
        // Preset mode
        if (dirty && filters) {
          // Preset is dirty - use stored filters (modified from preset)
          // Support both client and server filters simultaneously
          const hasServer = checkHasServerFilters(filters);
          const hasClient = checkHasClientFilters(filters);

          if (hasServer) {
            const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
            setActiveServerFilters(gitlabFilters);
          }
          if (hasClient) {
            setFilterOptions(restoreFilterOptions(filters));
          }

          setLastUsedPresetId(presetId);
          setFilterDirty(true);

          if (hasServer) {
            const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
            performInitialSync({ serverFilters: gitlabFilters });
          } else {
            performInitialSync();
          }
        } else {
          // Preset is not dirty - load from preset itself
          const savedPreset = filterPresets.find((p) => p.id === presetId);
          if (savedPreset?.filters) {
            const presetFilters = savedPreset.filters;
            // Check if preset has server filters
            const hasServer =
              presetFilters.serverFilters &&
              ((presetFilters.serverFilters.labelNames?.length ?? 0) > 0 ||
                (presetFilters.serverFilters.milestoneTitles?.length ?? 0) >
                  0 ||
                (presetFilters.serverFilters.assigneeUsernames?.length ?? 0) >
                  0 ||
                presetFilters.serverFilters.dateRange?.createdAfter ||
                presetFilters.serverFilters.dateRange?.createdBefore);
            // Check if preset has client filters
            const hasClient =
              (presetFilters.milestoneIds?.length ?? 0) > 0 ||
              (presetFilters.epicIds?.length ?? 0) > 0 ||
              (presetFilters.labels?.length ?? 0) > 0 ||
              (presetFilters.assignees?.length ?? 0) > 0 ||
              (presetFilters.states?.length ?? 0) > 0 ||
              !!presetFilters.search;

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(
                presetFilters.serverFilters,
              );
              setActiveServerFilters(gitlabFilters);
            }
            if (hasClient) {
              setFilterOptions(presetFilters);
            }

            setLastUsedPresetId(presetId);

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(
                presetFilters.serverFilters,
              );
              performInitialSync({ serverFilters: gitlabFilters });
            } else {
              performInitialSync();
            }
          } else {
            // Preset not found - sync without filters
            performInitialSync();
          }
        }
      } else if (mode === 'custom' && filters) {
        // Custom mode - use stored filters
        // Support both client and server filters simultaneously
        const hasServer = checkHasServerFilters(filters);
        const hasClient = checkHasClientFilters(filters);

        if (hasServer) {
          const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
          setActiveServerFilters(gitlabFilters);
        }
        if (hasClient) {
          setFilterOptions(restoreFilterOptions(filters));
        }

        if (hasServer) {
          const gitlabFilters = toGitLabServerFilters(filters.serverFilters);
          performInitialSync({ serverFilters: gitlabFilters });
        } else {
          performInitialSync();
        }
      } else {
        performInitialSync();
      }
    } else {
      // No saved filter settings - sync without filters
      performInitialSync();
    }
  }, [
    provider,
    presetsLoading,
    proxyConfig,
    configVersion,
    getConfigIdentifier,
    filterPresets,
    syncWithFilters,
    showToast,
  ]);

  // === Build Context Value ===
  const contextValue = useMemo<GitLabDataContextValue>(
    () => {
      // Debug: log when context value is recalculated
      console.log('[GitLabDataContext] contextValue useMemo recalculating, tasks count:', tasks.length);
      const task22 = tasks.find((t) => t.id === 22);
      if (task22) {
        console.log('[GitLabDataContext] Task 22 relativePosition:', task22._gitlab?.relativePosition);
      }
      return {
      // Core Data
      tasks,
      links,
      milestones,
      epics,

      // Sync State & Actions
      syncState,
      sync: syncWithFilters,
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
      proxyConfig,
      configVersion,

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
      canEditHolidays,

      // Holidays & Workdays
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      holidaysLoading,
      holidaysSaving,
      holidaysError,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,

      // Utility Functions
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
    };
    },
    [
      tasks,
      links,
      milestones,
      epics,
      syncState,
      syncWithFilters,
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
      proxyConfig,
      configVersion,
      filterOptions,
      serverFilterOptions,
      serverFilterOptionsLoading,
      activeServerFilters,
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
      canEditHolidays,
      holidays,
      workdays,
      colorRules,
      holidaysText,
      workdaysText,
      holidaysLoading,
      holidaysSaving,
      holidaysError,
      setHolidaysText,
      setWorkdaysText,
      setColorRules,
      showToast,
      countWorkdays,
      calculateEndDateByWorkdays,
    ],
  );

  return (
    <GitLabDataContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </GitLabDataContext.Provider>
  );
}

export { GitLabDataContext };
export type { GitLabDataContextValue };
