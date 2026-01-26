/**
 * GitLab Gantt Component
 * Main component that integrates GitLab data with react-gantt
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import './LabelCell.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Gantt from './Gantt.jsx';
import Editor from './Editor.jsx';
import Toolbar from './Toolbar.jsx';
import ContextMenu from './ContextMenu.jsx';
import SmartTaskContent from './SmartTaskContent.jsx';
import { ToastContainer, useToast } from './Toast.jsx';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider.ts';
import { gitlabConfigManager } from '../config/GitLabConfigManager.ts';
import { useGitLabSync } from '../hooks/useGitLabSync.ts';
import { useGitLabHolidays } from '../hooks/useGitLabHolidays.ts';
import { useFilterPresets } from '../hooks/useFilterPresets.ts';
import { useDateRangePreset } from '../hooks/useDateRangePreset.ts';
import { useHighlightTime } from '../hooks/useHighlightTime.ts';
import { GitLabFilters, toGitLabServerFilters } from '../utils/GitLabFilters.ts';
import {
  loadProjectSettings,
  updateProjectFilterSettings,
  createStoredFilters,
  restoreFilterOptions,
  isFilterEmpty,
  hasServerFilters as checkHasServerFilters,
  hasClientFilters as checkHasClientFilters,
} from '../types/projectSettings.ts';
import { ProjectSelector } from './ProjectSelector.jsx';
import { SyncButton } from './SyncButton.jsx';
import { FilterPanel } from './FilterPanel.jsx';
import {
  ColumnSettingsDropdown,
  useColumnSettings,
  buildColumnsFromSettings,
} from './ColumnSettingsDropdown.jsx';
import { ColorRulesEditor } from './ColorRulesEditor.jsx';
import { MoveInModal } from './MoveInModal.jsx';
import { SaveBlueprintModal } from './SaveBlueprintModal.jsx';
import { ApplyBlueprintModal } from './ApplyBlueprintModal.jsx';
import { BlueprintManager } from './BlueprintManager.jsx';
import { useBlueprint } from '../hooks/useBlueprint.ts';
import { applyBlueprint as applyBlueprintService } from '../providers/BlueprintService.ts';
import { defaultMenuOptions } from '@svar-ui/gantt-store';
import {
  findLinkBySourceTarget,
  validateLinkGitLabMetadata,
} from '../utils/GitLabLinkUtils';

/**
 * Extract tasks array from SVAR Gantt store state
 *
 * IMPORTANT: SVAR Gantt Internal Data Structure
 * ============================================
 * state.tasks is NOT a simple Array or Map. It's a custom class (internally named "Xn")
 * with the following structure:
 *   - _pool: Map<id, task> - Contains ALL tasks (flat structure, including nested children)
 *   - _sort: undefined | function - Sorting configuration
 *
 * The tasks in _pool have a hierarchical relationship via:
 *   - task.parent: number | 0 - Parent task ID (0 = root level)
 *   - task.data: Array<task> - Array of child tasks (for display purposes)
 *   - task.open: boolean - Whether the task's children are expanded
 *
 * @param {Object} state - The state object from api.getState()
 * @returns {Array} Array of task objects
 */
function getTasksFromState(state) {
  let tasks = state?.tasks || [];

  if (tasks._pool instanceof Map) {
    // SVAR Gantt uses a custom class with _pool Map containing all tasks
    tasks = Array.from(tasks._pool.values());
  } else if (tasks instanceof Map) {
    tasks = Array.from(tasks.values());
  } else if (!Array.isArray(tasks)) {
    // Fallback: Try to convert object to array if needed
    tasks = Object.values(tasks);
  }

  // Filter out any undefined/null entries (sparse arrays or objects)
  return tasks.filter(task => task != null);
}

export function GitLabGantt({ initialConfigId, autoSync = false }) {
  const [api, setApi] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [provider, setProvider] = useState(null);
  const [filterOptions, setFilterOptions] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // MoveInModal state
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [moveInProcessing, setMoveInProcessing] = useState(false);
  const [configs, setConfigs] = useState([]);

  // Blueprint state
  const [showSaveBlueprintModal, setShowSaveBlueprintModal] = useState(false);
  const [showApplyBlueprintModal, setShowApplyBlueprintModal] = useState(false);
  const [showBlueprintManager, setShowBlueprintManager] = useState(false);
  const [selectedMilestoneForBlueprint, setSelectedMilestoneForBlueprint] = useState(null);

  // Server filter options (labels, milestones, members from GitLab)
  const [serverFilterOptions, setServerFilterOptions] = useState(null);
  const [serverFilterOptionsLoading, setServerFilterOptionsLoading] = useState(false);
  // Active server filters (applied to API calls)
  const [activeServerFilters, setActiveServerFilters] = useState(null);

  // Store reference to all tasks for event handlers
  const allTasksRef = useRef([]);
  // Store reference to links for event handlers (to avoid stale closure)
  const linksRef = useRef([]);

  // Load settings from localStorage with defaults
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-width');
    return saved ? Number(saved) : 40;
  });
  // Display value for slider (updates immediately for smooth UX)
  const [cellWidthDisplay, setCellWidthDisplay] = useState(cellWidth);
  const cellWidthTimerRef = useRef(null);

  const [cellHeight, setCellHeight] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-height');
    return saved ? Number(saved) : 38;
  });
  // Display value for slider (updates immediately for smooth UX)
  const [cellHeightDisplay, setCellHeightDisplay] = useState(cellHeight);
  const cellHeightTimerRef = useRef(null);

  // Debounced cell width update to reduce re-renders
  const handleCellWidthChange = useCallback((value) => {
    setCellWidthDisplay(value);
    if (cellWidthTimerRef.current) {
      clearTimeout(cellWidthTimerRef.current);
    }
    cellWidthTimerRef.current = setTimeout(() => {
      setCellWidth(value);
    }, 100);
  }, []);

  // Debounced cell height update to reduce re-renders
  const handleCellHeightChange = useCallback((value) => {
    setCellHeightDisplay(value);
    if (cellHeightTimerRef.current) {
      clearTimeout(cellHeightTimerRef.current);
    }
    cellHeightTimerRef.current = setTimeout(() => {
      setCellHeight(value);
    }, 100);
  }, []);

  // canEditHolidays: whether user has permission to edit holidays and other project settings
  const [canEditHolidays, setCanEditHolidays] = useState(false);

  // Toast notification state (supports multiple stacked toasts)
  const { toasts, showToast, removeToast } = useToast();

  const [lengthUnit, setLengthUnit] = useState(() => {
    const saved = localStorage.getItem('gantt-length-unit');
    return saved || 'day';
  });

  // Column settings (visibility + order) from extracted hook
  const { columnSettings, toggleColumn, reorderColumns } = useColumnSettings();

  // Show/hide column settings panel
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Use shared date range preset hook
  const {
    dateRangePreset,
    setDateRangePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useDateRangePreset({ storagePrefix: 'gantt' });

  // Calculate effective cellWidth based on lengthUnit
  const effectiveCellWidth = useMemo(() => {
    if (lengthUnit === 'day') {
      // Only in 'day' mode, use user-controlled cellWidth
      return cellWidth;
    }
    // For other units, use fixed defaults
    switch (lengthUnit) {
      case 'hour':
        return 80; // Wider cells for hour view to reduce total count
      case 'week':
        return 100;
      case 'month':
        return 120;
      case 'quarter':
        return 150;
      default:
        return cellWidth;
    }
  }, [lengthUnit, cellWidth]);

  // Save cell width to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-width', cellWidth.toString());
  }, [cellWidth]);

  // Save cell height to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-height', cellHeight.toString());
  }, [cellHeight]);

  // Save length unit to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-length-unit', lengthUnit);
  }, [lengthUnit]);

  // Reload configs list (used on mount and after add/update/delete)
  const reloadConfigs = useCallback(() => {
    setConfigs(gitlabConfigManager.getAllConfigs());
  }, []);

  // Load configs on mount
  useEffect(() => {
    reloadConfigs();
  }, []);

  // Initialize provider when config changes
  const handleConfigChange = useCallback((config) => {
    setCurrentConfig(config);

    // Clear filter options when switching project/group
    // These will be restored from project settings after presets are loaded
    setFilterOptions({});

    // Clear server filter options and active server filters
    setServerFilterOptions(null);
    setActiveServerFilters(null);

    // Clear preset state - will be loaded from project settings
    // Note: We don't clear lastUsedPresetId and filterDirty here
    // They will be set by the effect that watches getConfigIdentifier

    // Increment config version to signal that presets need to reload
    // This prevents the initial sync from running with stale preset data
    setConfigVersion(v => v + 1);

    const newProvider = new GitLabGraphQLProvider({
      gitlabUrl: config.gitlabUrl,
      token: config.token,
      projectId: config.projectId,
      groupId: config.groupId,
      type: config.type,
    });

    setProvider(newProvider);
  }, []);

  // Quick switch between projects
  const handleQuickSwitch = useCallback((configId) => {
    gitlabConfigManager.setActiveConfig(configId);
    const config = gitlabConfigManager.getConfig(configId);
    if (config) {
      handleConfigChange(config);
    }
  }, [handleConfigChange]);

  // Initialize with active config on mount
  useEffect(() => {
    const activeConfig =
      gitlabConfigManager.getConfig(initialConfigId) ||
      gitlabConfigManager.getActiveConfig();

    if (activeConfig) {
      handleConfigChange(activeConfig);
    }
  }, [initialConfigId, handleConfigChange]);

  // Use sync hook (no auto-sync on provider change - we control initial sync timing)
  const {
    tasks: allTasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    createMilestone,
    deleteTask,
    createLink,
    deleteLink,
  } = useGitLabSync(provider, autoSync, 60000, {
    onWarning: (message) => showToast(message, 'warning'),
  });

  // Get project path for holidays hook
  const projectPath = useMemo(() => {
    if (!currentConfig) return null;
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return String(currentConfig.projectId);
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return String(currentConfig.groupId);
    }
    return null;
  }, [currentConfig]);

  // Get proxy config for REST API calls (for holidays)
  // Memoize based on actual config values to prevent unnecessary re-renders
  const proxyConfig = useMemo(() => {
    if (!currentConfig) return null;
    return {
      gitlabUrl: currentConfig.gitlabUrl,
      token: currentConfig.token,
      isDev: import.meta.env.DEV,
    };
  }, [currentConfig?.gitlabUrl, currentConfig?.token]);

  // Check permissions when provider changes
  useEffect(() => {
    if (!provider) {
      setCanEditHolidays(false);
      return;
    }

    provider.checkCanEdit().then(canEdit => {
      setCanEditHolidays(canEdit);
    });
  }, [provider]);

  // Load server filter options when provider changes
  useEffect(() => {
    if (!provider) {
      setServerFilterOptions(null);
      return;
    }

    const loadFilterOptions = async () => {
      setServerFilterOptionsLoading(true);
      try {
        const options = await provider.getFilterOptions();
        setServerFilterOptions(options);
      } catch (error) {
        console.error('[GitLabGantt] Failed to load filter options:', error);
        setServerFilterOptions(null);
      } finally {
        setServerFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
  }, [provider]);

  // Use GitLab holidays hook (also includes colorRules)
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
  } = useGitLabHolidays(projectPath, proxyConfig, canEditHolidays, currentConfig?.type || 'project');

  // Highlight time hook for workdays calculation and weekend/holiday highlighting
  const {
    highlightTime: highlightTimeFn,
    countWorkdays,
    calculateEndDateByWorkdays,
  } = useHighlightTime({ holidays, workdays });

  // Filter presets hook
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
    canEditHolidays
  );

  // Blueprint hook
  const {
    blueprints,
    loading: blueprintsLoading,
    canUseSnippet: canUseBlueprintSnippet,
    addBlueprint,
    deleteBlueprint,
    renameBlueprint,
    reload: reloadBlueprints,
  } = useBlueprint({
    fullPath: projectPath,
    proxyConfig,
    configType: currentConfig?.type || 'project',
    id: currentConfig?.projectId || currentConfig?.groupId,
  });

  // ============================================================
  // Project Settings: Filter State Persistence
  // ============================================================

  // Get config identifier for project settings
  const getConfigIdentifier = useCallback(() => {
    if (!currentConfig) return null;
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return { type: 'project', id: currentConfig.projectId };
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return { type: 'group', id: currentConfig.groupId };
    }
    return null;
  }, [currentConfig]);

  // Current preset ID and dirty state
  const [lastUsedPresetId, setLastUsedPresetId] = useState(null);
  const [filterDirty, setFilterDirty] = useState(false);

  // Ref to track if we're in the middle of a preset switch
  // This prevents filter changes from marking dirty during preset application
  const isApplyingPresetRef = useRef(false);

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
  const saveFilterSettings = useCallback((presetId, dirty, filters) => {
    const identifier = getConfigIdentifier();
    if (!identifier) return;

    if (presetId) {
      // Preset mode
      const settings = {
        mode: 'preset',
        presetId,
        dirty: dirty || false,
        filters: dirty ? filters : undefined,
      };
      updateProjectFilterSettings(identifier.type, identifier.id, settings);
    } else if (filters && !isFilterEmpty(filters)) {
      // Custom mode (no preset selected, but has filters)
      const settings = {
        mode: 'custom',
        filters,
      };
      updateProjectFilterSettings(identifier.type, identifier.id, settings);
    } else {
      // Clear filter settings
      updateProjectFilterSettings(identifier.type, identifier.id, undefined);
    }
  }, [getConfigIdentifier]);

  // Handle preset selection
  const handlePresetSelect = useCallback((presetId) => {
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
  }, [saveFilterSettings]);

  // Handle filter change (from FilterPanel)
  // @param newFilters - The new filter state
  // @param isUserAction - true if this change was triggered by user interaction (should mark dirty)
  const handleFilterChange = useCallback((newFilters, isUserAction = true) => {
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

    // Only save client filters here - server filters are saved in handleServerFilterApplyWithSave
    const stored = createStoredFilters(newFilters, null);

    // If a preset is selected, mark as dirty
    if (lastUsedPresetId) {
      setFilterDirty(true);
      saveFilterSettings(lastUsedPresetId, true, stored);
    } else {
      // No preset - save as custom
      saveFilterSettings(null, false, stored);
    }
  }, [lastUsedPresetId, saveFilterSettings, getConfigIdentifier]);

  // Ref to store fold state before data updates
  const openStateRef = useRef(new Map());

  // Generate a unique key for localStorage based on project/group
  const getStorageKey = useCallback(() => {
    if (!currentConfig) return 'gitlab-gantt-foldstate-default';
    if (currentConfig.type === 'project' && currentConfig.projectId) {
      return `gitlab-gantt-foldstate-project-${currentConfig.projectId}`;
    } else if (currentConfig.type === 'group' && currentConfig.groupId) {
      return `gitlab-gantt-foldstate-group-${currentConfig.groupId}`;
    }
    return 'gitlab-gantt-foldstate-default';
  }, [currentConfig]);

  // Load fold state from localStorage when config changes
  useEffect(() => {
    if (!currentConfig) return;

    try {
      const storageKey = getStorageKey();
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        openStateRef.current = new Map(Object.entries(parsed));
      } else {
        openStateRef.current = new Map();
      }
    } catch (error) {
      console.error('[GitLabGantt] Failed to load fold state from localStorage:', error);
    }
  }, [currentConfig, getStorageKey]);

  // Save fold state to localStorage whenever it changes
  const saveFoldStateToStorage = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stateObj = Object.fromEntries(openStateRef.current);
      localStorage.setItem(storageKey, JSON.stringify(stateObj));
    } catch (error) {
      console.error('[GitLabGantt] Failed to save fold state to localStorage:', error);
    }
  }, [getStorageKey]);

  // Use ref to make saveFoldStateToStorage accessible in init callback
  const saveFoldStateRef = useRef(saveFoldStateToStorage);
  useEffect(() => {
    saveFoldStateRef.current = saveFoldStateToStorage;
  }, [saveFoldStateToStorage]);

  // Initial sync state tracking
  const initialSyncDoneRef = useRef(false);
  const [configVersion, setConfigVersion] = useState(0);
  const presetsLoadedForVersionRef = useRef(-1);
  const prevPresetsLoadingRef = useRef(true);

  // Flag to skip saving filter settings during initial load
  // This prevents FilterPanel's initial mount from clearing saved settings
  const skipFilterSaveRef = useRef(true);

  // Reset sync state when provider changes
  useEffect(() => {
    initialSyncDoneRef.current = false;
    prevPresetsLoadingRef.current = true;
    skipFilterSaveRef.current = true; // Re-enable skip on provider change
  }, [provider]);

  // Track presetsLoading: true -> false transition to detect when presets finish loading
  useEffect(() => {
    const transitionedToLoaded = prevPresetsLoadingRef.current && !presetsLoading;
    if (transitionedToLoaded && proxyConfig) {
      presetsLoadedForVersionRef.current = configVersion;
    }
    prevPresetsLoadingRef.current = presetsLoading;
  }, [presetsLoading, proxyConfig, configVersion]);

  // Wrapped sync function that preserves fold state
  // Automatically applies activeServerFilters if set
  // NOTE: Fold state is saved only via 'open-task' event listener (when user manually opens/closes)
  // We don't save before sync because Gantt store may have stale data that would overwrite localStorage
  const syncWithFoldState = useCallback(
    async (options) => {
      // Merge activeServerFilters with provided options
      // This ensures all syncs respect the current server filter settings
      const mergedOptions = {
        ...options,
        serverFilters: options?.serverFilters || activeServerFilters,
      };

      // Call original sync with merged options
      await sync(mergedOptions);
    },
    [sync, activeServerFilters]
  );

  // Handle server filter apply (from FilterPanel)
  // Wrapper around the original sync handler that also saves settings to localStorage
  // @param serverFilters - The server filter state
  // @param isUserAction - true if this change was triggered by user interaction (should mark dirty)
  const handleServerFilterApplyWithSave = useCallback(async (serverFilters, isUserAction = true) => {
    const gitlabFilters = toGitLabServerFilters(serverFilters);
    setActiveServerFilters(gitlabFilters);

    // Skip saving if this is not a user action (e.g., preset application)
    if (!isUserAction) {
      await syncWithFoldState({ serverFilters: gitlabFilters });
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

    await syncWithFoldState({ serverFilters: gitlabFilters });
  }, [lastUsedPresetId, saveFilterSettings, syncWithFoldState]);

  // Trigger initial sync after presets are loaded
  // This ensures server filters from saved preset or custom settings are applied on first sync
  useEffect(() => {
    // Skip if not ready or already synced
    if (!provider || presetsLoading || !proxyConfig || initialSyncDoneRef.current) {
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
      syncWithFoldState();
      return;
    }

    const settings = loadProjectSettings(identifier.type, identifier.id);

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
            syncWithFoldState({ serverFilters: gitlabFilters });
          } else {
            syncWithFoldState();
          }
        } else {
          // Preset is not dirty - load from preset itself
          const savedPreset = filterPresets.find(p => p.id === presetId);
          if (savedPreset?.filters) {
            const presetFilters = savedPreset.filters;
            const hasServer = presetFilters.serverFilters &&
              ((presetFilters.serverFilters.labelNames?.length ?? 0) > 0 ||
               (presetFilters.serverFilters.milestoneTitles?.length ?? 0) > 0 ||
               (presetFilters.serverFilters.assigneeUsernames?.length ?? 0) > 0 ||
               presetFilters.serverFilters.dateRange?.createdAfter ||
               presetFilters.serverFilters.dateRange?.createdBefore);
            const hasClient =
              (presetFilters.milestoneIds?.length ?? 0) > 0 ||
              (presetFilters.epicIds?.length ?? 0) > 0 ||
              (presetFilters.labels?.length ?? 0) > 0 ||
              (presetFilters.assignees?.length ?? 0) > 0 ||
              (presetFilters.states?.length ?? 0) > 0 ||
              !!presetFilters.search;

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(presetFilters.serverFilters);
              setActiveServerFilters(gitlabFilters);
            }
            if (hasClient) {
              setFilterOptions(presetFilters);
            }

            setLastUsedPresetId(presetId);

            if (hasServer) {
              const gitlabFilters = toGitLabServerFilters(presetFilters.serverFilters);
              syncWithFoldState({ serverFilters: gitlabFilters });
            } else {
              syncWithFoldState();
            }
          } else {
            // Preset not found - sync without filters
            syncWithFoldState();
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
          syncWithFoldState({ serverFilters: gitlabFilters });
        } else {
          syncWithFoldState();
        }
      } else {
        syncWithFoldState();
      }
    } else {
      // No saved filter settings - sync without filters
      syncWithFoldState();
    }
  }, [provider, presetsLoading, proxyConfig, filterPresets, syncWithFoldState, getConfigIdentifier, configVersion]);

  // Update ref when allTasks changes
  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  // Update ref when links changes (to avoid stale closure in event handlers)
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  // Restore fold state after tasks update - separate effect to avoid timing issues
  useEffect(() => {
    if (!api || allTasks.length === 0 || openStateRef.current.size === 0) {
      return;
    }

    // Use requestAnimationFrame to ensure Gantt has processed the new tasks
    // This runs after React has committed the DOM updates
    const restoreFoldState = () => {
      try {
        const state = api.getState();
        const currentTasks = getTasksFromState(state);

        // If Gantt store hasn't processed the tasks yet, schedule another frame
        if (currentTasks.length === 0) {
          requestAnimationFrame(restoreFoldState);
          return;
        }

        // Restore open state from saved map
        currentTasks.forEach((task) => {
          // Skip tasks that don't have children (data property)
          // Opening a task without children causes Gantt store error
          if (!task.data || task.data.length === 0) {
            return;
          }

          // Check both string and number versions of the ID
          // localStorage keys are always strings, but Gantt task IDs can be numbers
          const taskIdStr = String(task.id);
          const taskIdNum = Number(task.id);

          let savedOpen = null;
          if (openStateRef.current.has(taskIdStr)) {
            savedOpen = openStateRef.current.get(taskIdStr);
          } else if (openStateRef.current.has(taskIdNum)) {
            savedOpen = openStateRef.current.get(taskIdNum);
          } else if (openStateRef.current.has(task.id)) {
            savedOpen = openStateRef.current.get(task.id);
          }

          if (savedOpen !== null && task.open !== savedOpen) {
            api.exec('open-task', { id: task.id, mode: savedOpen });
          }
        });
      } catch (error) {
        console.error('[GitLabGantt] Failed to restore fold state:', error);
      }
    };

    requestAnimationFrame(restoreFoldState);
  }, [allTasks, api]);

  // Create label priority map for sorting (lower number = higher priority)
  const labelPriorityMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach(label => {
      if (label.priority != null) {
        map.set(label.title, label.priority);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Create label color map for LabelCell rendering
  const labelColorMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach(label => {
      if (label.color) {
        map.set(label.title, label.color);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Add workdays and labelPriority to tasks for sorting support
  const tasksWithWorkdays = useMemo(() => {
    return allTasks.map(task => {
      // Parse labels and find highest priority (lowest number)
      const taskLabels = task.labels ? task.labels.split(', ').filter(Boolean) : [];
      let labelPriority = Number.MAX_SAFE_INTEGER; // Default: unprioritized (sorts last)

      taskLabels.forEach(labelTitle => {
        const priority = labelPriorityMap.get(labelTitle);
        if (priority !== undefined && priority < labelPriority) {
          labelPriority = priority;
        }
      });

      return {
        ...task,
        workdays: task.start && task.end ? countWorkdays(task.start, task.end) : 0,
        labelPriority,
      };
    });
  }, [allTasks, countWorkdays, labelPriorityMap]);

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return GitLabFilters.applyFilters(tasksWithWorkdays, filterOptions);
  }, [tasksWithWorkdays, filterOptions]);

  // Calculate statistics
  const stats = useMemo(() => {
    return GitLabFilters.calculateStats(filteredTasks);
  }, [filteredTasks]);

  // Dynamic scales based on lengthUnit (lengthUnit = the smallest time unit to display)
  const scales = useMemo(() => {
    switch (lengthUnit) {
      case 'hour':
        return [
          { unit: 'day', step: 1, format: 'MMM d' },
          { unit: 'hour', step: 2, format: 'HH:mm' }, // Show every 2 hours to reduce cells
        ];
      case 'day':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMMM' },
          { unit: 'day', step: 1, format: 'd' },
        ];
      case 'week':
        return [
          { unit: 'month', step: 1, format: 'MMM' },
          { unit: 'week', step: 1, format: 'w' },
        ];
      case 'month':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMM' },
        ];
      case 'quarter':
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'quarter', step: 1, format: 'QQQ' },
        ];
      default:
        return [
          { unit: 'year', step: 1, format: 'yyyy' },
          { unit: 'month', step: 1, format: 'MMMM' },
          { unit: 'day', step: 1, format: 'd' },
        ];
    }
  }, [lengthUnit]);

  // Track pending editor changes (for Save button)
  const pendingEditorChangesRef = useRef(new Map());
  const isEditorOpenRef = useRef(false);
  const currentEditingTaskRef = useRef(null);

  // Track pending date changes for debounce
  const pendingDateChangesRef = useRef(new Map());
  const dateChangeTimersRef = useRef(new Map());

  // Custom editor bottom bar with Save and Close buttons
  const editorBottomBar = useMemo(
    () => ({
      items: [
        { comp: 'button', type: 'secondary', text: 'Close', id: 'close' },
        { comp: 'spacer' },
        { comp: 'button', type: 'primary', text: 'Save', id: 'save' },
      ],
    }),
    []
  );

  // Handler for adding a new milestone
  const handleAddMilestone = useCallback(async () => {
    const title = prompt('Enter Milestone title:', 'New Milestone');
    if (!title) return;

    const description = prompt('Enter description (optional):');

    const startDateStr = prompt('Enter start date (YYYY-MM-DD, optional):');
    const dueDateStr = prompt('Enter due date (YYYY-MM-DD, optional):');

    try {
      const milestone = {
        text: title,
        details: description || '',
        parent: 0,
        ...(startDateStr && { start: new Date(startDateStr) }),
        ...(dueDateStr && { end: new Date(dueDateStr) }),
      };

      await createMilestone(milestone);
    } catch (error) {
      console.error('[GitLabGantt] Failed to create milestone:', error);
      showToast(`Failed to create milestone: ${error.message}`, 'error');
    }
  }, [createMilestone]);

  // ============================================
  // Move In... Feature - Context Menu Integration
  // ============================================

  // Get selected tasks from Gantt API when modal opens
  // NOTE: We fetch this on-demand rather than using useStoreLater to avoid
  // infinite re-render loops caused by the reactive hook triggering cascading updates
  const getSelectedTasks = useCallback(() => {
    if (!api) return [];
    const state = api.getState();
    // state._selected contains the selected task objects
    return state._selected || [];
  }, [api]);

  // State to hold selected tasks when modal is opened
  const [selectedTasksForModal, setSelectedTasksForModal] = useState([]);

  // Custom context menu options with Move In... action and Blueprint actions
  const contextMenuOptions = useMemo(() => {
    const options = [...defaultMenuOptions];
    // Find the delete-task option index and insert Move In... before it
    const deleteIndex = options.findIndex((opt) => opt.id === 'delete-task');
    if (deleteIndex !== -1) {
      // Insert Move In... before delete (after the separator that precedes delete)
      options.splice(deleteIndex, 0, {
        id: 'move-in',
        text: 'Move In...',
        icon: 'wxi-folder',
        // Enable when any task is selected
        check: (task) => task != null,
      });
    } else {
      // Fallback: add at the end if delete not found
      options.push({ type: 'separator' });
      options.push({
        id: 'move-in',
        text: 'Move In...',
        icon: 'wxi-folder',
        check: (task) => task != null,
      });
    }

    // Add Blueprint options for Milestones
    options.push({ type: 'separator' });
    options.push({
      id: 'save-as-blueprint',
      text: 'Save as Blueprint...',
      icon: 'fas fa-copy',
      // Only show for Milestones
      check: (task) => task?._gitlab?.type === 'milestone',
    });
    options.push({
      id: 'create-from-blueprint',
      text: 'Create from Blueprint...',
      icon: 'fas fa-paste',
      // Show for any context (can also be accessed from toolbar)
      check: (task) => task != null,
    });

    return options;
  }, []);

  // Handle context menu click events
  const handleContextMenuClick = useCallback(({ action, context: ctx }) => {
    if (action?.id === 'move-in') {
      // Capture selected tasks at the moment the menu is clicked
      const tasks = getSelectedTasks();
      setSelectedTasksForModal(tasks);
      // Open the Move In modal
      setShowMoveInModal(true);
    } else if (action?.id === 'save-as-blueprint') {
      // Save milestone as Blueprint
      if (ctx?._gitlab?.type === 'milestone') {
        setSelectedMilestoneForBlueprint(ctx);
        setShowSaveBlueprintModal(true);
      }
    } else if (action?.id === 'create-from-blueprint') {
      // Open Apply Blueprint modal
      setShowApplyBlueprintModal(true);
    }
  }, [getSelectedTasks]);

  // Handle Move In action
  const handleMoveIn = useCallback(async (type, targetId, items) => {
    if (!provider || items.length === 0) return;

    setMoveInProcessing(true);

    try {
      const iids = items.map(item => Number(item.id));
      let result;

      switch (type) {
        case 'parent':
          // Move Tasks to an Issue (set parent)
          result = await provider.batchUpdateParent(iids, targetId);
          break;
        case 'milestone':
          // Move Issues/Tasks to a Milestone
          result = await provider.batchUpdateMilestone(iids, targetId);
          break;
        case 'epic':
          // Move Issues to an Epic
          result = await provider.batchUpdateEpic(iids, targetId);
          break;
        default:
          throw new Error(`Unknown move type: ${type}`);
      }

      // Show result notification
      if (result.success.length > 0 && result.failed.length === 0) {
        showToast(`Successfully moved ${result.success.length} item(s)`, 'success');
      } else if (result.success.length > 0 && result.failed.length > 0) {
        showToast(
          `Moved ${result.success.length} item(s), ${result.failed.length} failed`,
          'warning'
        );
      } else if (result.failed.length > 0) {
        // Show each failed item as a separate toast for better visibility
        result.failed.forEach(f => {
          showToast(`#${f.iid}: ${f.error}`, 'error');
        });
        throw new Error('Move operation failed');
      }

      // Trigger data refresh to reflect changes
      // NOTE: This is a simple approach - trigger a sync to refresh data from GitLab
      // In a more optimized implementation, we could update local state directly
      if (result.success.length > 0) {
        // Close modal first
        setShowMoveInModal(false);
        // Trigger re-sync to get updated data
        // The sync will update the tasks with new parent/milestone/epic relationships
        await syncWithFoldState();
      }
    } catch (error) {
      console.error('[GitLabGantt] Move In failed:', error);
      showToast(`Move failed: ${error.message}`, 'error');
      throw error; // Re-throw so modal knows operation failed
    } finally {
      setMoveInProcessing(false);
    }
  }, [provider, showToast, syncWithFoldState]);

  // Use refs to store latest workdays functions for use in intercept closure
  // This prevents stale closure issues when holidays/workdays change
  const countWorkdaysRef = useRef(countWorkdays);
  const calculateEndDateByWorkdaysRef = useRef(calculateEndDateByWorkdays);

  // Keep refs updated with latest functions
  useEffect(() => {
    countWorkdaysRef.current = countWorkdays;
    calculateEndDateByWorkdaysRef.current = calculateEndDateByWorkdays;
  }, [countWorkdays, calculateEndDateByWorkdays]);

  // Initialize Gantt API
  const init = useCallback(
    (ganttApi) => {
      try {
        setApi(ganttApi);
      } catch (error) {
        console.error('[init] ERROR in setApi:', error);
        console.error('[init] ERROR stack:', error.stack);
        throw error;
      }

      // Expose API to window for debugging
      window.ganttApi = ganttApi;

      // Helper function to inspect tasks (uses getTasksFromState to handle SVAR internal structure)
      window.debugTasks = () => {
        try {
          const state = ganttApi.getState();
          return getTasksFromState(state);
        } catch (error) {
          console.error('Error in debugTasks:', error);
          return ganttApi.getState();
        }
      };

      // Helper function to find a specific task
      window.findTask = (id) => {
        try {
          const state = ganttApi.getState();
          const tasks = getTasksFromState(state);
          return tasks.find(t => t.id == id) || null;
        } catch (error) {
          console.error('Error in findTask:', error);
          return null;
        }
      };

      // Auto-scroll to today after data loads
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Try multiple times with increasing delays to ensure chart is loaded
      const attemptScroll = (attempt = 1) => {
        try {
          const state = ganttApi.getState();
          const cellWidth = state.cellWidth || 40;
          const scales = state._scales || [];
          const start = state.start;


          if (start) {
            // Calculate days from timeline start to today
            const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const scrollLeft = Math.max(0, daysDiff * cellWidth);

            // Use scroll-chart command to set scroll position
            ganttApi.exec('scroll-chart', { left: scrollLeft });
            return true;
          }

          return false;
        } catch (error) {
          return false;
        }
      };

      // Try immediately, then retry if needed
      if (!attemptScroll(1)) {
        setTimeout(() => attemptScroll(2), 100);
      }

      // Listen to fold/unfold events to save state
      // This is the ONLY place where fold state is saved (user manually opens/closes)
      // We don't save during sync because Gantt store may have stale data
      ganttApi.on('open-task', (ev) => {
        // Update openStateRef with the new state
        if (ev.id && ev.mode !== undefined) {
          openStateRef.current.set(ev.id, ev.mode);
          // Save to localStorage using ref
          saveFoldStateRef.current();
        }
      });

      // Track editor open
      ganttApi.on('open-editor', (ev) => {
        isEditorOpenRef.current = true;
        currentEditingTaskRef.current = ev.id;
        pendingEditorChangesRef.current.clear(); // Clear previous changes

        // Disable browser extensions (like Grammarly) on editor inputs
        setTimeout(() => {
          const editorInputs = document.querySelectorAll('.wx-editor input, .wx-editor textarea');
          editorInputs.forEach(input => {
            input.setAttribute('data-gramm', 'false');
            input.setAttribute('data-gramm_editor', 'false');
            input.setAttribute('data-enable-grammarly', 'false');
            input.setAttribute('spellcheck', 'false');
          });
        }, 100);
      });

      // Handle editor button clicks
      ganttApi.on('action', async (ev) => {
        if (ev.action === 'save') {

          // Sync pending changes
          const taskId = currentEditingTaskRef.current;
          const changes = pendingEditorChangesRef.current.get(taskId);

          if (changes && Object.keys(changes).length > 0) {
            try {
              // Get _gitlab info from current task for proper ID resolution
              // This is especially important for milestones which need internalId
              const currentTask = ganttApi.getTask(taskId);
              if (currentTask?._gitlab) {
                changes._gitlab = currentTask._gitlab;
              }

              await syncTask(taskId, changes);
              pendingEditorChangesRef.current.clear();

              // Refresh from GitLab to update local state
              await syncWithFoldState();

              // Close editor after successful save
              ganttApi.exec('close-editor');
            } catch (error) {
              console.error('Failed to sync task:', error);
              showToast(`Failed to save changes: ${error.message}`, 'error');
            }
          } else {
            // No changes, just close
            ganttApi.exec('close-editor');
          }
        } else if (ev.action === 'close') {

          // Check if there are unsaved changes
          const taskId = currentEditingTaskRef.current;
          const changes = pendingEditorChangesRef.current.get(taskId);

          if (changes && Object.keys(changes).length > 0) {
            const confirmed = confirm(
              'You have unsaved changes. Do you want to discard them?'
            );

            if (confirmed) {
              // Discard changes and reload
              pendingEditorChangesRef.current.clear();
              ganttApi.exec('close-editor');
              syncWithFoldState(); // Reload to revert local changes
            }
            // If not confirmed, do nothing (stay in editor)
          } else {
            // No changes, just close
            ganttApi.exec('close-editor');
          }
        }
      });

      // Track editor close
      ganttApi.on('close-editor', () => {
        isEditorOpenRef.current = false;
        currentEditingTaskRef.current = null;
      });


      /**
       * Workdays Preservation on Drag
       *
       * When a task bar is dragged (move mode), we want to preserve the original
       * number of workdays. For example, if a 5-workday task is dragged to a new
       * position that includes a weekend, the end date should automatically extend
       * to maintain 5 workdays.
       *
       * Event flow:
       * 1. intercept('update-task') - Captures original workdays BEFORE Gantt updates
       * 2. First on('update-task') - Calculates and applies end date correction
       * 3. Second on('update-task') - Handles GitLab sync, skips stale events
       *
       * State tracking:
       * - workdaysState.originalWorkdays: Captured before drag completes
       * - workdaysState.correctionSynced: True after correction update is sent to GitLab
       *
       * Why two handlers?
       * - The intercept runs before Gantt's internal update
       * - The on handlers run after, giving us access to the new start date
       * - We need to skip syncing the intermediate (wrong) end date to GitLab
       */
      const workdaysState = new Map(); // taskId -> { originalWorkdays, correctionSynced }

      // Phase 1: Capture original workdays before Gantt updates the task
      ganttApi.intercept('update-task', (ev) => {
        // Skip our own correction updates (prevents infinite loop)
        if (ev.skipWorkdaysAdjust) {
          return true;
        }

        // Only process move mode drags (not resize)
        // GitLab milestones have start and end dates, so they also need workdays adjustment
        if (ev.mode === 'move' && ev.diff) {
          const task = ganttApi.getTask(ev.id);

          // ganttApi.getTask() returns the CURRENT state (before this update)
          const originalStart = task.start;
          const originalEnd = task.end;

          if (originalStart && originalEnd) {
            const originalWorkdays = countWorkdaysRef.current(originalStart, originalEnd);

            if (originalWorkdays > 0) {
              // Store for Phase 2
              workdaysState.set(ev.id, {
                originalWorkdays,
                correctionSynced: false,
              });
            }
          }
        }

        return true; // Allow the event to proceed
      });

      // Phase 2: After Gantt updates, calculate and apply end date correction
      ganttApi.on('update-task', (ev) => {
        // Skip correction updates - they already have the correct end date
        if (ev.skipWorkdaysAdjust) {
          return;
        }

        const state = workdaysState.get(ev.id);

        // Only process if we captured workdays in Phase 1 and haven't corrected yet
        if (state && state.originalWorkdays && !state.correctionSynced) {
          // Get the task with its NEW start date (after Gantt's update)
          const task = ganttApi.getTask(ev.id);
          if (!task || !task.start) return;

          // Calculate what end date should be to preserve workdays
          const adjustedEnd = calculateEndDateByWorkdaysRef.current(
            task.start,
            state.originalWorkdays
          );

          // Only correct if needed (end date changed due to weekends/holidays)
          if (task.end.getTime() !== adjustedEnd.getTime()) {
            // Issue correction update with skipWorkdaysAdjust flag
            // This triggers another update-task event, but Phase 1 will skip it
            ganttApi.exec('update-task', {
              id: ev.id,
              task: { end: adjustedEnd },
              skipWorkdaysAdjust: true,
            });
          } else {
            // No correction needed - clear state so sync proceeds
            workdaysState.delete(ev.id);
          }
        }
      });

      // Phase 3: GitLab sync handler - skip stale events, only sync correction
      ganttApi.on('update-task', (ev) => {
        const state = workdaysState.get(ev.id);

        if (state) {
          if (ev.skipWorkdaysAdjust) {
            // This is the correction update - mark synced and allow GitLab sync
            state.correctionSynced = true;
            // Clean up state after sync completes (use setTimeout to ensure sync runs first)
            setTimeout(() => workdaysState.delete(ev.id), 0);
          } else if (!state.correctionSynced) {
            // This is the original drag event with wrong end date - skip sync
            // The correction update (with correct end date) will sync instead
            return;
          } else {
            // Correction already synced - this is a late/duplicate event, skip
            return;
          }
        }

        // Handle temporary IDs
        const isTempId = typeof ev.id === 'string' && ev.id.startsWith('temp');

        // Check if this is an ID update (replacing temp ID with real ID)
        const isIdUpdate = ev.task.id !== undefined && ev.task.id !== ev.id;

        // Skip temporary IDs UNLESS:
        // 1. We're updating the ID (temp -> real)
        // 2. Or skipSync is true (internal update)
        if (isTempId && !isIdUpdate && !ev.skipSync) {
          return;
        }

        // If this is an ID update for temp task, allow it but don't sync to GitLab
        if (isTempId && isIdUpdate) {
          // Don't sync this to GitLab, and don't process parent baseline updates
          return;
        }


        // If this task has a parent and dates changed, update parent's baseline
        if (!ev.skipBaselineDrag && (ev.task.start !== undefined || ev.task.end !== undefined)) {
          const currentTask = ganttApi.getTask(ev.id);

          if (currentTask.parent && currentTask.parent !== 0) {
            // Get all siblings from ganttApi to ensure we have the latest data
            const allTasks = allTasksRef.current;
            const siblingIds = allTasks.filter(t => t && t.parent === currentTask.parent).map(t => t.id);


            if (siblingIds.length > 0) {
              // Get fresh data from ganttApi for each sibling
              const siblings = siblingIds.map(id => ganttApi.getTask(id)).filter(t => t);

              const childStarts = siblings.map(c => c.start).filter(s => s !== undefined);
              const childEnds = siblings.map(c => c.end).filter(e => e !== undefined);


              if (childStarts.length > 0 && childEnds.length > 0) {
                const spanStart = new Date(Math.min(...childStarts.map(d => d.getTime())));
                const spanEnd = new Date(Math.max(...childEnds.map(d => d.getTime())));


                // Update parent's baseline
                ganttApi.exec('update-task', {
                  id: currentTask.parent,
                  task: {
                    base_start: spanStart,
                    base_end: spanEnd,
                  },
                  skipBaselineDrag: true,
                  skipSync: true, // Don't sync to GitLab
                });
              }
            }
          }
        }

        // Skip sync if marked as skipSync (UI-only update)
        if (ev.skipSync) {
          return;
        }

        // Determine if this is a visual change (dates) or text change
        const hasDateChange =
          ev.task.start !== undefined ||
          ev.task.end !== undefined ||
          ev.task.duration !== undefined;

        const hasTextChange =
          ev.task.text !== undefined ||
          ev.task.details !== undefined;

        if (isEditorOpenRef.current && hasTextChange && !hasDateChange) {
          // Editor is open and ONLY text fields changed - save for later
          if (!pendingEditorChangesRef.current.has(ev.id)) {
            pendingEditorChangesRef.current.set(ev.id, {});
          }
          Object.assign(pendingEditorChangesRef.current.get(ev.id), ev.task);
        } else if (hasDateChange || !isEditorOpenRef.current) {
          // Date changes OR changes outside editor
          // Use ev.task directly - it contains the NEW values after drag event completes
          const currentTask = ganttApi.getTask(ev.id);
          const taskChanges = {};

          // Get _gitlab for global ID (cached, no extra query)
          if (currentTask._gitlab) {
            taskChanges._gitlab = currentTask._gitlab;
          }

          // Use values from ev.task if provided (NEW values from drag/edit)
          // Otherwise use currentTask values (unchanged fields like end date)

          // Text fields
          if (ev.task.text !== undefined) {
            taskChanges.text = ev.task.text;
          }
          if (ev.task.details !== undefined) {
            taskChanges.details = ev.task.details;
          }

          // Date fields
          if (ev.task.start !== undefined) {
            taskChanges.start = new Date(ev.task.start);
          } else if (currentTask.start) {
            taskChanges.start = new Date(currentTask.start);
          }

          if (ev.task.end !== undefined) {
            taskChanges.end = new Date(ev.task.end);
          } else if (currentTask.end) {
            taskChanges.end = new Date(currentTask.end);
          }

          if (ev.task.duration !== undefined) {
            taskChanges.duration = ev.task.duration;
          }

          // Sync to GitLab without updating React state (to avoid re-render conflicts)
          (async () => {
            try {
              await syncTask(ev.id, taskChanges);
            } catch (error) {
              console.error('Failed to sync task update:', error);
              showToast(`Failed to sync task: ${error.message}`, 'error');
              // Revert by reloading from GitLab
              syncWithFoldState();
            }
          })();
        }
      });

      // Prevent creating subtasks under subtasks (third-level hierarchy)
      // and show dialog for new task creation
      ganttApi.intercept('add-task', (ev) => {
        // Check if this is being added as a child (mode === 'child')
        // At intercept time, parent info is in ev.target and ev.mode, not ev.task.parent
        if (ev.mode === 'child' && ev.target && ev.target !== 0) {
          const parentTask = ganttApi.getTask(ev.target);

          // Check if parent is a milestone
          if (parentTask && parentTask.$isMilestone) {
            // Creating issue under milestone - this is allowed

            // Don't use ev.task.text as default if it's the generic "New Task" from Gantt
            const defaultTitle = (ev.task.text && ev.task.text !== 'New Task') ? ev.task.text : 'New GitLab Issue';
            const title = prompt(
              'Enter GitLab Issue title:',
              defaultTitle
            );

            if (!title) {
              return false; // User cancelled
            }

            // Update the task with user input
            ev.task.text = title;

            // Optionally ask for description
            const description = prompt('Enter description (optional):');
            if (description) {
              ev.task.details = description;
            }

            // Mark this task to be created with milestone assignment
            // Store the milestone's global ID for the mutation
            ev.task._assignToMilestone = parentTask._gitlab.globalId; // Store milestone global ID

            return true;
          }

          // Check if parent is a GitLab Task (subtask)
          // Only GitLab Tasks cannot have children (third level not allowed)
          // Issues under milestones CAN have children (Tasks)
          const isParentGitLabTask = parentTask && !parentTask.$isIssue && !parentTask.$isMilestone;

          if (isParentGitLabTask) {
            showToast('Cannot create subtasks under a GitLab Task. Only Issues can have Tasks as children.', 'warning');
            return false;
          }

          // Check if parent is a GitLab Issue
          const isParentGitLabIssue = parentTask && parentTask.$isIssue;

          if (isParentGitLabIssue) {
            // Creating task under issue
            // Don't use ev.task.text as default if it's the generic "New Task" from Gantt
            const defaultTitle = (ev.task.text && ev.task.text !== 'New Task') ? ev.task.text : 'New GitLab Task';
            const title = prompt(
              'Enter GitLab Task title:',
              defaultTitle
            );

            if (!title) {
              return false; // User cancelled
            }

            // Update the task with user input
            ev.task.text = title;

            // Optionally ask for description
            const description = prompt('Enter description (optional):');
            if (description) {
              ev.task.details = description;
            }

            return true;
          }
        }

        // Creating top-level issue (no parent)
        // Don't use ev.task.text as default if it's the generic "New Task" from Gantt
        const defaultTitle = (ev.task.text && ev.task.text !== 'New Task') ? ev.task.text : 'New GitLab Issue';
        const title = prompt(
          'Enter GitLab Issue title:',
          defaultTitle
        );

        if (!title) {
          return false; // User cancelled
        }

        // Update the task with user input
        ev.task.text = title;

        // Optionally ask for description
        const description = prompt('Enter description (optional):');
        if (description) {
          ev.task.details = description;
        }

        return true;
      });

      // Handle task creation
      ganttApi.on('add-task', async (ev) => {
        // Skip if this is a replacement task (not from user action)
        if (ev.skipHandler) {
          return;
        }

        try {
          // Save fold state BEFORE any operations that might change it
          // This is crucial because deleting the temporary task might close the parent
          const savedOpenState = new Map();
          if (api) {
            try {
              const state = api.getState();
              const currentTasks = getTasksFromState(state);
              currentTasks.forEach((task) => {
                if (task.open !== undefined) {
                  savedOpenState.set(task.id, task.open);
                }
              });
            } catch (error) {
              console.error('[GitLab] Failed to save fold state:', error);
            }
          }

          // Check if this is an issue being created under a milestone
          if (ev.task._assignToMilestone) {

            // Issues under milestones should not use hierarchy (parent=0)
            // The milestone relationship is managed via GitLab's milestone widget
            ev.task.parent = 0;

            // Add milestone info to task for provider to use
            ev.task._gitlab = {
              ...ev.task._gitlab,
              milestoneGlobalId: ev.task._assignToMilestone,
            };
          }

          await createTask(ev.task);

          // Sync with GitLab to ensure all data is up-to-date
          // This prevents stale data (e.g., edited titles) from being overwritten
          await syncWithFoldState();

          // Delete the temporary task (with baseline)
          ganttApi.exec('delete-task', {
            id: ev.id,
            skipHandler: true, // Don't trigger delete handler
          });

          // Restore fold state for parent tasks after adding new child
          // This ensures the parent is expanded to show the new child
          if (savedOpenState.size > 0) {
            // Small delay to ensure Gantt has processed the new task
            setTimeout(() => {
              savedOpenState.forEach((isOpen, taskId) => {
                if (isOpen) {
                  try {
                    const parentTask = ganttApi.getTask(taskId);
                    // Only open if the task has children now
                    if (parentTask?.data && parentTask.data.length > 0) {
                      ganttApi.exec('open-task', { id: taskId, mode: true });
                    }
                  } catch (e) {
                    // Ignore errors for tasks that may not exist
                  }
                }
              });
            }, 50);
          }

        } catch (error) {
          console.error('Failed to create task:', error);
          showToast(`Failed to create task: ${error.message}`, 'error');
          // Remove the temporary task
          ganttApi.exec('delete-task', { id: ev.id, skipHandler: true });
        }
      });

      // Intercept task deletion to ask for confirmation
      ganttApi.intercept('delete-task', (ev) => {
        // Skip if this is an internal deletion (e.g., removing temp task)
        if (ev.skipHandler) {
          return true;
        }

        // Get task info for confirmation message
        const task = ganttApi.getTask(ev.id);
        const taskTitle = task ? task.text : `Item ${ev.id}`;

        // Determine the type of item for proper messaging
        let itemType = 'issue';
        if (task?.$isMilestone || task?._gitlab?.type === 'milestone') {
          itemType = 'milestone';
        } else if (task?._gitlab?.workItemType === 'Task') {
          itemType = 'task';
        }

        // Ask for confirmation
        const confirmed = confirm(
          `Are you sure you want to delete "${taskTitle}"?\n\nThis will permanently delete the ${itemType} from GitLab.`
        );

        return confirmed;
      });

      // Track pending delete operations for proper ordering
      // When deleting Milestone + Issues together, Issues must be deleted first
      const pendingDeletes = new Map(); // id -> Promise

      // Handle task deletion after confirmation
      ganttApi.on('delete-task', async (ev) => {
        // Skip if this is an internal deletion (e.g., removing temp task)
        if (ev.skipHandler) {
          return;
        }

        try {
          // Get task data to pass to deleteTask for proper type detection
          // Try ganttApi first, then fall back to allTasksRef
          let task = ganttApi.getTask(ev.id);

          // If task from ganttApi doesn't have _gitlab info, try to find it in allTasksRef
          if (!task?._gitlab) {
            const taskFromRef = allTasksRef.current.find(t => t.id === ev.id);
            if (taskFromRef?._gitlab) {
              task = taskFromRef;
            }
          }

          // If this is a Milestone, wait for all its children to be deleted first
          // This prevents GitLab 500 error when Milestone still has Issues
          if (task?._gitlab?.type === 'milestone') {
            // Find all pending deletes that are children of this milestone
            const childDeletePromises = [];
            for (const [childId, promise] of pendingDeletes.entries()) {
              const childTask = allTasksRef.current.find(t => t.id === childId);
              if (childTask && childTask.parent === ev.id) {
                childDeletePromises.push(promise);
              }
            }

            // Wait for all children to be deleted first
            if (childDeletePromises.length > 0) {
              console.log(`[GitLabGantt] Waiting for ${childDeletePromises.length} child items to be deleted before milestone...`);
              await Promise.allSettled(childDeletePromises);
              // Small delay to ensure GitLab has processed the deletions
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Create and track the delete promise
          const deletePromise = deleteTask(ev.id, task);
          pendingDeletes.set(ev.id, deletePromise);

          try {
            await deletePromise;
          } finally {
            pendingDeletes.delete(ev.id);
          }
        } catch (error) {
          console.error('Failed to delete task:', error);
          showToast(`Failed to delete task: ${error.message}`, 'error');
          // Reload data to restore the task
          syncWithFoldState();
        }
      });

      // Handle task reordering (move-task event)
      ganttApi.on('move-task', async (ev) => {
        // Skip if event is still in progress (dragging)
        if (ev.inProgress) {
          return;
        }

        // Get the moved task and target task
        const movedTask = ganttApi.getTask(ev.id);
        const targetTask = ganttApi.getTask(ev.target);

        // Skip milestones - they can't be reordered (no way to save order)
        if (movedTask._gitlab?.type === 'milestone') {
          return;
        }

        // Extract type information once
        const movedType = movedTask._gitlab?.workItemType || movedTask._gitlab?.type || 'unknown';
        const targetType = targetTask._gitlab?.workItemType || targetTask._gitlab?.type || 'unknown';

        const parentId = movedTask.parent || 0;
        const allTasks = allTasksRef.current;
        let siblings = allTasks.filter(t => t && (t.parent || 0) === parentId);

        // Sort siblings by current displayOrder
        siblings.sort((a, b) => {
          const orderA = a.$custom?.displayOrder;
          const orderB = b.$custom?.displayOrder;
          if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
          if (orderA !== undefined) return -1;
          if (orderB !== undefined) return 1;
          return a.id - b.id;
        });

        // Special case: When dragging to first position, Gantt sets ev.id === ev.target
        if (ev.id === ev.target) {
          // Find the current first task (excluding the moved task)
          const currentFirstTask = siblings.find(s => s.id !== ev.id);

          if (currentFirstTask) {
            // Move before the current first task to become the new first
            ev.target = currentFirstTask.id;
            ev.mode = 'before';
          } else {
            // This is the only task, no reorder needed
            return;
          }
        }

        try {
          // Re-get target task if it was changed (for move to first position)
          const finalTargetTask = ev.target !== targetTask.id ? ganttApi.getTask(ev.target) : targetTask;

          // Get GitLab IIDs from the task objects
          const movedIid = movedTask._gitlab?.iid;
          const targetIid = finalTargetTask._gitlab?.iid;

          // Check if both tasks have valid GitLab IIDs
          if (!movedIid) {
            console.error(`[GitLab] Cannot reorder: moved task ${ev.id} has no GitLab IID`);
            return;
          }

          // Use the type information we already extracted at the beginning
          const finalTargetType = finalTargetTask._gitlab?.workItemType || finalTargetTask._gitlab?.type || 'unknown';

          // Milestones are special - they can't be used for reordering at all
          const targetIsMilestone = finalTargetTask.$isMilestone || finalTargetType === 'milestone';

          // Check if types are compatible for reordering
          // Issues can only reorder relative to other Issues
          // Tasks can only reorder relative to other Tasks (within same parent)
          const typesIncompatible = targetIsMilestone || (movedType !== finalTargetType);

          if (typesIncompatible) {

            // For milestones, we need special logic since they appear at the top visually
            // but might be at the end of the siblings array due to missing displayOrder
            const isMilestoneTarget = finalTargetTask.$isMilestone || finalTargetType === 'milestone';

            if (isMilestoneTarget) {
              // When dragging to a milestone, move before the first compatible Issue
              const firstCompatibleIssue = siblings.find(s => {
                if (s.id === ev.id) return false; // Skip self
                const siblingType = s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
                if (s.$isMilestone || siblingType === 'milestone') return false;
                return movedType === siblingType && s._gitlab?.iid;
              });

              if (firstCompatibleIssue) {
                await provider.reorderWorkItem(movedIid, firstCompatibleIssue._gitlab.iid, 'before');
              } else {
                console.error(`[GitLab] No compatible ${movedType} found to reorder relative to`);
              }
              return;
            }

            // Get the target's position in siblings array
            const targetIndex = siblings.findIndex(s => s.id === ev.target);

            // Find compatible siblings before and after the target
            let compatibleBefore = null;
            let compatibleAfter = null;

            // Search backwards from target for compatible sibling
            for (let i = targetIndex - 1; i >= 0; i--) {
              const s = siblings[i];
              if (s.id === ev.id) continue; // Skip self
              const siblingType = s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
              if (s.$isMilestone || siblingType === 'milestone') continue; // Skip milestones
              if (movedType === siblingType && s._gitlab?.iid) {
                compatibleBefore = s;
                break;
              }
            }

            // Search forwards from target for compatible sibling
            for (let i = targetIndex + 1; i < siblings.length; i++) {
              const s = siblings[i];
              if (s.id === ev.id) continue; // Skip self
              const siblingType = s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
              if (s.$isMilestone || siblingType === 'milestone') continue; // Skip milestones
              if (movedType === siblingType && s._gitlab?.iid) {
                compatibleAfter = s;
                break;
              }
            }

            // Determine the best compatible target and mode
            let useTarget = null;
            let useMode = ev.mode;

            if (targetIndex === 0 || !compatibleBefore) {
              // Target is first or no compatible before - use after with 'before' mode
              if (compatibleAfter) {
                useTarget = compatibleAfter;
                useMode = 'before';
              }
            } else if (targetIndex === siblings.length - 1 || !compatibleAfter) {
              // Target is last or no compatible after - use before with 'after' mode
              if (compatibleBefore) {
                useTarget = compatibleBefore;
                useMode = 'after';
              }
            } else {
              // Target is in middle - use the one in the direction we're moving
              if (ev.mode === 'after') {
                useTarget = compatibleAfter;
                useMode = 'before';
              } else {
                useTarget = compatibleBefore;
                useMode = 'after';
              }
            }

            if (useTarget) {
              await provider.reorderWorkItem(movedIid, useTarget._gitlab.iid, useMode);
            } else {
              console.error(`[GitLab] No compatible ${movedType} found to reorder relative to`);
            }
            return;
          }

          if (!targetIid) {
            console.error(`[GitLab] Cannot reorder: target task ${ev.target} has no GitLab IID`);
            return;
          }

          // Use GitLab native reorder API with actual GitLab IIDs
          await provider.reorderWorkItem(movedIid, targetIid, ev.mode);

          // Note: Automatic sync removed to prevent screen flickering
          // The Gantt chart maintains correct visual state after drag operation
          // Order has been saved to GitLab via reorderWorkItem() API
        } catch (error) {
          console.error(`[GitLab] Failed to reorder ${movedTask.text}: ${error.message}`);
        }
      });

      // Handle link creation
      ganttApi.on('add-link', async (ev) => {
        try {
          await createLink(ev.link);
        } catch (error) {
          console.error('Failed to create link:', error);
          showToast(`Failed to create link: ${error.message}`, 'error');
          ganttApi.exec('delete-link', { id: ev.id });
        }
      });

      // Handle link deletion
      // NOTE: Link IDs from Gantt store may not match React state IDs after sync.
      // Gantt assigns its own IDs, while our sync uses a counter.
      // We find the link by source/target instead of ID.
      ganttApi.on('delete-link', async (ev) => {
        try {
          // IMPORTANT: Use linksRef.current instead of links to get the latest value.
          // The closure captures `links` at registration time, so it would be stale.
          const currentLinks = linksRef.current;
          const sourceId = ev.link?.source;
          const targetId = ev.link?.target;

          // If source/target not in event, we can't proceed
          if (!sourceId || !targetId) {
            console.warn('[delete-link] No source/target in event, cannot find link');
            return;
          }

          // Find matching link by source/target (prefers link with _gitlab metadata)
          const link = findLinkBySourceTarget(currentLinks, sourceId, targetId);

          if (!link) {
            console.warn('[delete-link] Link not found in React state, skipping API call');
            return;
          }

          // Validate GitLab metadata for API call
          const validation = validateLinkGitLabMetadata(link);

          if (validation.valid) {
            await deleteLink(link.id, validation.apiSourceIid, validation.linkedWorkItemGlobalId);
          } else if (link._gitlab === undefined) {
            // Link exists but no _gitlab metadata - newly created and not yet synced
            showToast('Link was just created. Syncing to update...', 'info');
            await syncWithFoldState();
          } else {
            throw new Error(validation.error);
          }
        } catch (error) {
          console.error('Failed to delete link:', error);
          showToast(`Failed to delete link: ${error.message}`, 'error');
          syncWithFoldState();
        }
      });

      // Handle cascade move - move parent with all children while preserving workdays
      ganttApi.on('cascade-move-task', async (ev) => {
        const { id: parentId, diff } = ev;
        const parentTask = ganttApi.getTask(parentId);

        if (!parentTask) {
          console.error('Parent task not found:', parentId);
          return;
        }

        // Helper function to recursively get all descendants
        const getAllDescendants = (taskId) => {
          const result = [];
          const task = ganttApi.getTask(taskId);
          if (task?.data?.length) {
            for (const child of task.data) {
              result.push(child);
              result.push(...getAllDescendants(child.id));
            }
          }
          return result;
        };

        // Helper function to calculate start date from link
        const calculateStartFromLink = (link, sourceData) => {
          const { newStart, newEnd } = sourceData;
          switch (link.type) {
            case 'e2s': // End-to-Start: target starts day after source ends
              const next = new Date(newEnd);
              next.setDate(next.getDate() + 1);
              return next;
            case 's2s': // Start-to-Start: target starts same day as source
              return new Date(newStart);
            case 'e2e': // End-to-End: complex, need to reverse calculate
            case 's2e': // Start-to-End: complex, need to reverse calculate
            default:
              return new Date(newStart);
          }
        };

        // If no children, just do normal move
        if (!parentTask.data?.length) {
          ganttApi.exec('update-task', {
            id: parentId,
            task: { start: parentTask.start, end: parentTask.end },
            diff,
            mode: 'move',
          });
          return;
        }

        try {
          // 1. Calculate parent new dates
          const parentOriginalStart = new Date(parentTask.start);
          const parentWorkdays = countWorkdaysRef.current(parentTask.start, parentTask.end);
          const newParentStart = new Date(parentOriginalStart);
          newParentStart.setDate(newParentStart.getDate() + diff);
          const newParentEnd = calculateEndDateByWorkdaysRef.current(newParentStart, parentWorkdays);

          // 2. Collect all descendants and calculate original offset
          const descendants = getAllDescendants(parentId);
          const currentLinks = links || [];
          const descendantIds = new Set(descendants.map(d => d.id));
          descendantIds.add(parentId); // Include parent in the set for link calculation

          const childData = descendants.map(child => {
            const childTask = ganttApi.getTask(child.id);
            if (!childTask || !childTask.start) return null;

            const offsetMs = childTask.start.getTime() - parentOriginalStart.getTime();
            const offsetDays = Math.round(offsetMs / (1000 * 60 * 60 * 24));
            const workdays = countWorkdaysRef.current(childTask.start, childTask.end);

            // Find inbound links from other cascade members to this task
            const inboundLinks = currentLinks.filter(link =>
              link.target === child.id && descendantIds.has(link.source)
            );

            return {
              id: child.id,
              offsetDays,
              workdays,
              inboundLinks,
              _gitlab: childTask._gitlab,
            };
          }).filter(Boolean);

          // 3. Sort by start date (earliest first)
          childData.sort((a, b) => a.offsetDays - b.offsetDays);

          // 4. Process each child
          const processed = new Map(); // id -> { newStart, newEnd }
          processed.set(parentId, { newStart: newParentStart, newEnd: newParentEnd });

          const updates = [];
          for (const child of childData) {
            let newStart;

            // Check if there's a processed link source
            const linkedSource = child.inboundLinks.find(l => processed.has(l.source));
            if (linkedSource) {
              // Use link to calculate new start
              newStart = calculateStartFromLink(linkedSource, processed.get(linkedSource.source));
            } else {
              // Preserve original offset from parent
              newStart = new Date(newParentStart);
              newStart.setDate(newStart.getDate() + child.offsetDays);
            }

            const newEnd = calculateEndDateByWorkdaysRef.current(newStart, child.workdays);
            processed.set(child.id, { newStart, newEnd });
            updates.push({ id: child.id, start: newStart, end: newEnd, _gitlab: child._gitlab });
          }

          // 5. Batch update UI (skip workdays adjust since we calculated correctly)
          ganttApi.exec('update-task', {
            id: parentId,
            task: { start: newParentStart, end: newParentEnd },
            skipWorkdaysAdjust: true,
            skipSync: true,
          });

          for (const u of updates) {
            ganttApi.exec('update-task', {
              id: u.id,
              task: { start: u.start, end: u.end },
              skipWorkdaysAdjust: true,
              skipSync: true,
            });
          }

          // 6. Batch sync to GitLab
          await syncTask(parentId, { start: newParentStart, end: newParentEnd, _gitlab: parentTask._gitlab });

          for (const u of updates) {
            await syncTask(u.id, { start: u.start, end: u.end, _gitlab: u._gitlab });
          }

          showToast(`Moved ${updates.length + 1} items`, 'success');
        } catch (error) {
          console.error('Cascade move failed:', error);
          showToast(`Cascade move failed: ${error.message}`, 'error');
          syncWithFoldState(); // Reload to revert
        }
      });
    },
    // Note: countWorkdays/calculateEndDateByWorkdays not needed here as we use refs (countWorkdaysRef, calculateEndDateByWorkdaysRef)
    [syncTask, createTask, createMilestone, deleteTask, createLink, deleteLink, links, syncWithFoldState]
  );

  // Today marker - ensure correct date without timezone issues
  const markers = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [
      {
        start: today,  // IMarker uses 'start' not 'date'
        css: 'today-marker',
      },
    ];
  }, []);

  // highlightTime alias for Gantt component (extracted earlier as highlightTimeFn)
  const highlightTime = highlightTimeFn;

  // Date cell component for custom formatting
  const DateCell = useCallback(({ row, column }) => {
    const date = row[column.id];
    if (!date) return '';

    const d = date instanceof Date ? date : new Date(date);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  }, []);

  // Workdays cell - dynamically calculates workdays from row's current start/end
  // This ensures the display updates immediately when user drags to resize the bar
  const WorkdaysCell = useCallback(({ row }) => {
    if (!row.start || !row.end) return '';
    const days = countWorkdays(row.start, row.end);
    return days ? `${days}d` : '';
  }, [countWorkdays]);

  // Custom cell component for Task Title with icons
  const TaskTitleCell = useCallback(({ row }) => {
    const data = row;
    let icon;
    let iconColor;

    // Determine icon and color based on GitLab type
    if (data.$isMilestone || data._gitlab?.type === 'milestone') {
      // Milestone - purple
      icon = <i className="far fa-flag"></i>;
      iconColor = '#ad44ab';
    } else if (data._gitlab?.workItemType === 'Task') {
      // Task/Subtask (GitLab work item type is 'Task') - green
      icon = <i className="far fa-square-check"></i>;
      iconColor = '#00ba94';
    } else {
      // Issue (GitLab work item type is 'Issue' or other) - blue
      icon = <i className="far fa-clipboard"></i>;
      iconColor = '#3983eb';
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px', color: iconColor }}>{icon}</span>
        <span>{data.text}</span>
      </div>
    );
  }, []);

  // Columns configuration with visibility and order control
  const columns = useMemo(() => {
    // Build configurable columns from settings
    const configurableCols = buildColumnsFromSettings(columnSettings, {
      DateCell,
      WorkdaysCell,
      labelColorMap,
      labelPriorityMap,
    });

    return [
      // Task Title is always first and always visible
      {
        id: 'text',
        header: 'Task Title',
        width: 250,
        cell: TaskTitleCell,
      },
      // Configurable columns (ordered by user)
      ...configurableCols,
      // Add task button is always last
      {
        id: 'add-task',
        header: '',
        width: 50,
      },
    ];
  }, [DateCell, TaskTitleCell, WorkdaysCell, columnSettings, labelColorMap, labelPriorityMap]);

  // Editor items configuration - customized for GitLab
  const editorItems = useMemo(() => {
    return [
      { key: 'text', comp: 'text', label: 'Title' },
      { key: 'details', comp: 'textarea', label: 'Description' },
      { key: 'start', comp: 'date', label: 'Start Date' },
      { key: 'end', comp: 'date', label: 'Due Date' },
      { key: 'workdays', comp: 'workdays', label: 'Workdays' },
      { key: 'links', comp: 'links', label: 'Links' },
    ];
  }, []);

  // Show loading state
  if (syncState.isLoading && !currentConfig) {
    return (
      <div className="gitlab-gantt-loading">
        <div className="loading-spinner"></div>
        <p>Loading GitLab configuration...</p>
      </div>
    );
  }

  // Show config prompt if no config
  if (!currentConfig) {
    return (
      <div className="gitlab-gantt-empty">
        <ProjectSelector
          onProjectChange={handleConfigChange}
          currentConfigId={currentConfig?.id}
          onConfigsChange={reloadConfigs}
        />
        <div className="empty-message">
          <h3>No GitLab project configured</h3>
          <p>Please add a GitLab project or group configuration to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gitlab-gantt-container">
      {/* Toast notifications (supports multiple stacked) */}
      <ToastContainer
        toasts={toasts}
        onRemove={removeToast}
        duration={5000}
        position="top-right"
      />

      <div className="gitlab-gantt-header">
        <div className="project-switcher">
          <select
            value={currentConfig?.id || ''}
            onChange={(e) => handleQuickSwitch(e.target.value)}
            className="project-select-compact"
          >
            <option value="">Select Project...</option>
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-settings"
            title="Settings"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>

        <button
          onClick={() => setShowViewOptions(!showViewOptions)}
          className="btn-view-options"
        >
          <i className="fas fa-sliders-h"></i>
          <i className={`fas fa-chevron-${showViewOptions ? 'up' : 'down'} chevron-icon`}></i>
        </button>

        <SyncButton
          onSync={syncWithFoldState}
          syncState={syncState}
          filterOptions={filterOptions}
        />
        <div className="stats-panel">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed:</span>
            <span className="stat-value stat-completed">{stats.completed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">In Progress:</span>
            <span className="stat-value stat-progress">{stats.inProgress}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Not Started:</span>
            <span className="stat-value">{stats.notStarted}</span>
          </div>
          {stats.overdue > 0 && (
            <div className="stat-item">
              <span className="stat-label">Overdue:</span>
              <span className="stat-value stat-overdue">{stats.overdue}</span>
            </div>
          )}
        </div>
      </div>

      {showViewOptions && (
        <div className="view-controls">
          <label className="control-label">
            Range:
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value)}
              className="unit-select"
            >
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="2y">2 Years</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {dateRangePreset === 'custom' && (
            <>
              <label className="control-label">
                From:
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
              </label>
              <label className="control-label">
                To:
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
              </label>
            </>
          )}
          <label className="control-label">
            Width:
            <input
              type="range"
              min="20"
              max="100"
              value={cellWidthDisplay}
              onChange={(e) => handleCellWidthChange(Number(e.target.value))}
              className="slider"
              disabled={lengthUnit !== 'day'}
            />
            <span className="control-value">{lengthUnit === 'day' ? cellWidthDisplay : effectiveCellWidth}</span>
          </label>
          <label className="control-label">
            Height:
            <input
              type="range"
              min="20"
              max="60"
              value={cellHeightDisplay}
              onChange={(e) => handleCellHeightChange(Number(e.target.value))}
              className="slider"
            />
            <span className="control-value">{cellHeightDisplay}</span>
          </label>
          <label className="control-label">
            Unit:
            <select
              value={lengthUnit}
              onChange={(e) => setLengthUnit(e.target.value)}
              className="unit-select"
            >
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </label>
        </div>
      )}

      {showSettings && (
        <div
          className="settings-modal-overlay"
          onMouseDown={(e) => {
            // Only close if clicking directly on overlay (not dragging from content)
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)} className="btn-close-modal">
                &times;
              </button>
            </div>

            <div className="settings-modal-body">
            <div className="settings-section">
              <h4>GitLab Project</h4>
              <ProjectSelector
                onProjectChange={(config) => {
                  handleConfigChange(config);
                  setShowSettings(false);
                }}
                currentConfigId={currentConfig?.id}
                onConfigsChange={reloadConfigs}
              />
            </div>

            <div className="settings-section">
              <h4 className="settings-section-header">
                Holidays
                {!canEditHolidays && (
                  <span className="permission-warning">
                    <i className="fas fa-lock"></i>
                    {currentConfig?.type === 'group'
                      ? ' Not available for Groups (GitLab limitation)'
                      : ' Create Snippet permission required'}
                  </span>
                )}
                {holidaysSaving && (
                  <span className="saving-indicator">
                    <i className="fas fa-spinner fa-spin"></i> Saving...
                  </span>
                )}
              </h4>
              <p className="settings-hint">Add holiday dates (one per line, formats: YYYY-MM-DD or YYYY/M/D, optional name after space)</p>
              {holidaysError && (
                <div className="holidays-error">
                  <i className="fas fa-exclamation-triangle"></i> {holidaysError}
                </div>
              )}
              <textarea
                value={holidaysText}
                onChange={(e) => setHolidaysText(e.target.value)}
                placeholder="2025-01-01 New Year&#10;2025/2/28&#10;2025-12-25 Christmas"
                className={`holidays-textarea ${!canEditHolidays ? 'disabled' : ''}`}
                rows={6}
                disabled={!canEditHolidays || holidaysLoading}
              />
              {canEditHolidays && (
                <div className="holiday-presets">
                  <button
                    onClick={() => setHolidaysText('')}
                    className="preset-btn preset-btn-clear"
                    disabled={holidaysLoading}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4 className="settings-section-header">
                Extra Working Days
                {!canEditHolidays && (
                  <span className="permission-warning">
                    <i className="fas fa-lock"></i>
                    {currentConfig?.type === 'group'
                      ? ' Not available for Groups (GitLab limitation)'
                      : ' Create Snippet permission required'}
                  </span>
                )}
              </h4>
              <p className="settings-hint">Add extra working days on weekends (one per line, formats: YYYY-MM-DD or YYYY/M/D)</p>
              <textarea
                value={workdaysText}
                onChange={(e) => setWorkdaysText(e.target.value)}
                placeholder="2025/1/25&#10;2025-02-08"
                className={`holidays-textarea ${!canEditHolidays ? 'disabled' : ''}`}
                rows={6}
                disabled={!canEditHolidays || holidaysLoading}
              />
              {canEditHolidays && (
                <div className="holiday-presets">
                  <button
                    onClick={() => setWorkdaysText('')}
                    className="preset-btn preset-btn-clear"
                    disabled={holidaysLoading}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4 className="settings-section-header">
                Color Rules
                {!canEditHolidays && (
                  <span className="permission-warning">
                    <i className="fas fa-lock"></i>
                    {currentConfig?.type === 'group'
                      ? ' Not available for Groups (GitLab limitation)'
                      : ' Create Snippet permission required'}
                  </span>
                )}
                {holidaysSaving && (
                  <span className="saving-indicator">
                    <i className="fas fa-spinner fa-spin"></i> Saving...
                  </span>
                )}
              </h4>
              <p className="settings-hint">
                Highlight time bars with diagonal stripes based on issue title matching conditions
              </p>
              <ColorRulesEditor
                rules={colorRules}
                onRulesChange={setColorRules}
                canEdit={canEditHolidays}
                saving={holidaysSaving}
              />
            </div>
            </div>
          </div>
        </div>
      )}

      <FilterPanel
        key={currentConfig?.id || 'no-config'}
        milestones={milestones}
        epics={epics}
        tasks={allTasks}
        onFilterChange={handleFilterChange}
        initialFilters={filterOptions}
        presets={filterPresets}
        presetsLoading={presetsLoading}
        presetsSaving={presetsSaving}
        canEditPresets={canEditHolidays}
        onCreatePreset={createNewPreset}
        onUpdatePreset={updatePreset}
        onRenamePreset={renamePreset}
        onDeletePreset={deletePreset}
        onPresetSelect={handlePresetSelect}
        initialPresetId={lastUsedPresetId}
        isGroupMode={currentConfig?.type === 'group'}
        filterOptions={serverFilterOptions}
        filterOptionsLoading={serverFilterOptionsLoading}
        serverFilters={activeServerFilters}
        onServerFilterApply={handleServerFilterApplyWithSave}
        isDirty={filterDirty}
      />

      {syncState.error && (
        <div className="error-banner">
          <strong>Sync Error:</strong> {syncState.error}
          <button onClick={() => syncWithFoldState()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      <div className="gantt-wrapper">
        <div className="gantt-toolbar-row">
          <ColumnSettingsDropdown
            isOpen={showColumnSettings}
            onToggle={() => setShowColumnSettings(!showColumnSettings)}
            columnSettings={columnSettings}
            onToggleColumn={toggleColumn}
            onReorderColumns={reorderColumns}
          />
          <Toolbar api={api} onAddMilestone={handleAddMilestone} onOpenBlueprints={() => setShowBlueprintManager(true)} />
        </div>
        <div className="gantt-chart-container">
          {syncState.isLoading ? (
            <div className="loading-message">
              <p>Loading GitLab data...</p>
            </div>
          ) : (
            <ContextMenu api={api} options={contextMenuOptions} onClick={handleContextMenuClick}>
              {(() => {

                // Validate tasks structure before passing to Gantt
                const invalidTasks = filteredTasks.filter(task => {
                  return !task.id || !task.text || !task.start;
                });

                if (invalidTasks.length > 0) {
                  console.error('[GitLabGantt RENDER] Found invalid tasks:', invalidTasks);
                }

                // Log all tasks with their parent relationships to find the problematic structure

                // Check for orphaned children (parent doesn't exist in the list)
                const taskIds = new Set(filteredTasks.map(t => t.id));
                const orphanedTasks = filteredTasks.filter(task => {
                  return task.parent && task.parent !== 0 && !taskIds.has(task.parent);
                });

                if (orphanedTasks.length > 0) {
                  // Separate Issues with Epic parents from other orphaned tasks
                  const issuesWithEpicParent = orphanedTasks.filter(task => {
                    // Check if this Issue has Epic parent stored in metadata
                    return task._gitlab?.epicParentId;
                  });

                  const tasksWithMissingParent = orphanedTasks.filter(task => {
                    // Everything else: Tasks with missing parents, or Issues with missing milestones
                    return !task._gitlab?.epicParentId;
                  });

                  if (issuesWithEpicParent.length > 0) {
                    // Get unique Epic IDs
                    const epicIds = new Set(issuesWithEpicParent.map(t => t._gitlab?.epicParentId));

                    // These are Issues with Epic parents - Epics are not supported yet
                    console.info('[GitLabGantt] Some issues belong to Epics (not supported):', {
                      epicIds: Array.from(epicIds),
                      affectedIssues: issuesWithEpicParent.length,
                      note: 'Epic support is not implemented. These issues will appear at root level.'
                    });
                  }

                  if (tasksWithMissingParent.length > 0) {
                    // This is an actual error - Tasks with missing parents
                    // Collect unique missing parent IDs
                    const missingParentIds = new Set(tasksWithMissingParent.map(t => t.parent));
                    console.error('[GitLabGantt RENDER] Found orphaned tasks (parent does not exist):', {
                      count: tasksWithMissingParent.length,
                      orphanedTaskIds: tasksWithMissingParent.map(t => ({
                        id: t.id,
                        parent: t.parent,
                        text: t.text,
                        type: t.type,
                        _gitlab: t._gitlab?.type
                      })),
                      missingParentIds: Array.from(missingParentIds)
                    });
                  }
                }

                try {
                  return (
                    <Gantt
                    key={`gantt-${lengthUnit}-${effectiveCellWidth}`}
                    init={(api) => {
                      try {
                        const result = init(api);
                        return result;
                      } catch (error) {
                        console.error('[Gantt init] ERROR in init callback:', error);
                        console.error('[Gantt init] ERROR name:', error.name);
                        console.error('[Gantt init] ERROR message:', error.message);
                        console.error('[Gantt init] ERROR stack:', error.stack);
                        throw error;
                      }
                    }}
                    tasks={filteredTasks}
                    links={links}
              markers={markers}
              scales={scales}
              lengthUnit={lengthUnit}
              start={dateRange.start}
              end={dateRange.end}
              columns={columns}
              cellWidth={effectiveCellWidth}
              cellHeight={cellHeight}
              highlightTime={highlightTime}
              countWorkdays={countWorkdays}
              readonly={false}
              baselines={true}
              taskTemplate={SmartTaskContent}
              autoScale={false}
              colorRules={colorRules}
                  />
                );
              } catch (error) {
                console.error('[GitLabGantt RENDER] ERROR rendering Gantt:', error);
                console.error('[GitLabGantt RENDER] ERROR name:', error.name);
                console.error('[GitLabGantt RENDER] ERROR message:', error.message);
                console.error('[GitLabGantt RENDER] ERROR stack:', error.stack);
                throw error;
              }
            })()}
            </ContextMenu>
          )}
        </div>
        {api && (
          <Editor
            api={api}
            bottomBar={false}
            autoSave={false}
            items={editorItems}
            workdaysHelpers={{ countWorkdays, calculateEndDateByWorkdays }}
          />
        )}
      </div>

      {/* Move In Modal */}
      <MoveInModal
        isOpen={showMoveInModal}
        onClose={() => setShowMoveInModal(false)}
        selectedTasks={selectedTasksForModal}
        allTasks={allTasksRef.current}
        epics={epics || []}
        onMove={handleMoveIn}
        isProcessing={moveInProcessing}
      />

      {/* Blueprint Modals */}
      <SaveBlueprintModal
        isOpen={showSaveBlueprintModal}
        onClose={() => {
          setShowSaveBlueprintModal(false);
          setSelectedMilestoneForBlueprint(null);
        }}
        milestoneTask={selectedMilestoneForBlueprint}
        allTasks={allTasksRef.current}
        allLinks={links}
        holidays={holidays}
        workdays={workdays}
        onSave={async (blueprint) => {
          await addBlueprint(blueprint);
          showToast('Blueprint saved successfully', 'success');
        }}
        canUseSnippet={canUseBlueprintSnippet}
      />

      <ApplyBlueprintModal
        isOpen={showApplyBlueprintModal}
        onClose={() => setShowApplyBlueprintModal(false)}
        blueprints={blueprints}
        onApply={async (blueprint, options) => {
          try {
            const result = await applyBlueprintService(
              blueprint,
              options,
              provider,
              holidays || [],
              workdays || [],
            );

            if (result.success) {
              showToast('Blueprint applied successfully', 'success');
            } else {
              showToast('Blueprint applied with some issues', 'warning');
            }

            // Refresh data after applying blueprint
            await syncWithFoldState();

            return result;
          } catch (error) {
            console.error('[GitLabGantt] Apply blueprint error:', error);
            showToast(`Failed to apply blueprint: ${error.message}`, 'error');
            throw error;
          }
        }}
      />

      <BlueprintManager
        isOpen={showBlueprintManager}
        onClose={() => setShowBlueprintManager(false)}
        blueprints={blueprints}
        loading={blueprintsLoading}
        onDelete={deleteBlueprint}
        onRename={renameBlueprint}
        onApply={(blueprint) => {
          setShowBlueprintManager(false);
          setShowApplyBlueprintModal(true);
        }}
      />

      <style>{`
        .gitlab-gantt-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .gitlab-gantt-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: var(--wx-gitlab-header-background);
          border-bottom: 1px solid var(--wx-gitlab-header-border);
          flex-wrap: wrap;
        }

        .project-switcher {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .view-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 4px 12px;
          background: var(--wx-gitlab-control-background);
          border-bottom: 1px solid var(--wx-gitlab-control-border);
        }

        .control-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--wx-gitlab-control-text);
          white-space: nowrap;
        }

        .slider {
          width: 80px;
          height: 4px;
          cursor: pointer;
        }

        .slider:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .control-value {
          min-width: 30px;
          text-align: right;
          font-weight: 600;
          color: var(--wx-gitlab-control-value);
        }

        .unit-select {
          padding: 2px 6px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          font-size: 12px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
          cursor: pointer;
          min-width: 70px;
        }

        .unit-select:hover {
          border-color: var(--wx-gitlab-button-hover-text);
        }

        .unit-select:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .date-input {
          padding: 2px 6px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          font-size: 12px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
          width: 120px;
        }

        .date-input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .project-select-compact {
          height: 24px;
          padding: 0 6px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          font-size: 12px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
          cursor: pointer;
          min-width: 160px;
          box-sizing: border-box;
        }

        .btn-settings {
          height: 24px;
          width: 24px;
          padding: 0;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          background: var(--wx-gitlab-button-background);
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--wx-gitlab-button-text);
          font-size: 12px;
          box-sizing: border-box;
        }

        .btn-settings:hover {
          color: var(--wx-gitlab-button-hover-text);
          background: var(--wx-gitlab-button-hover-background);
        }

        .btn-view-options {
          height: 24px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0 6px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          background: var(--wx-gitlab-button-background);
          cursor: pointer;
          color: var(--wx-gitlab-button-text);
          font-size: 12px;
          transition: background 0.2s, color 0.2s;
          box-sizing: border-box;
        }

        .btn-view-options:hover {
          color: var(--wx-gitlab-button-hover-text);
          background: var(--wx-gitlab-button-hover-background);
        }

        .btn-view-options .chevron-icon {
          font-size: 10px;
          opacity: 0.7;
        }

        .column-settings-container {
          position: relative;
        }

        .btn-column-settings {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border: none;
          border-radius: 4px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s, color 0.2s;
        }

        .btn-column-settings:hover {
          color: var(--wx-gitlab-button-hover-text);
          background: var(--wx-gitlab-button-hover-background);
        }

        .column-settings-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: var(--wx-gitlab-dropdown-background, white);
          border: 1px solid var(--wx-gitlab-dropdown-border, #ddd);
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 180px;
        }

        .column-settings-header {
          padding: 8px 12px 4px;
          font-weight: 600;
          font-size: 13px;
          color: var(--wx-gitlab-dropdown-text, #333);
        }

        .column-settings-hint {
          padding: 0 12px 8px;
          font-size: 11px;
          color: var(--wx-gitlab-dropdown-hint, #888);
          border-bottom: 1px solid var(--wx-gitlab-dropdown-border, #eee);
        }

        .column-settings-list {
          padding: 8px 0;
        }

        .column-item {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: grab;
          transition: background 0.15s;
        }

        .column-item:hover {
          background: var(--wx-gitlab-dropdown-hover, #f5f5f5);
        }

        .column-item.dragging {
          opacity: 0.5;
          background: var(--wx-gitlab-dropdown-hover, #f0f0f0);
        }

        .column-item.drag-over {
          border-top: 2px solid var(--wx-gitlab-primary, #1f75cb);
        }

        .column-drop-zone-end {
          height: 8px;
          margin: 0 8px;
          border-radius: 2px;
          transition: all 0.15s;
        }

        .column-drop-zone-end.active {
          height: 12px;
          background: var(--wx-gitlab-primary, #1f75cb);
          opacity: 0.3;
        }

        .drag-handle {
          display: flex;
          align-items: center;
          padding: 4px;
          color: var(--wx-gitlab-dropdown-hint, #999);
          cursor: grab;
        }

        .drag-handle:active {
          cursor: grabbing;
        }

        .column-checkbox {
          display: flex;
          align-items: center;
          flex: 1;
          cursor: pointer;
          font-size: 13px;
          color: var(--wx-gitlab-dropdown-text, #333);
        }

        .column-checkbox input {
          margin-right: 8px;
        }

        .settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--wx-gitlab-modal-overlay);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .settings-modal-content {
          background: var(--wx-gitlab-modal-background);
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .settings-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--wx-gitlab-modal-border);
          background: var(--wx-gitlab-modal-header-background);
        }

        .settings-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--wx-gitlab-modal-text);
        }

        .settings-section {
          padding: 20px;
          border-bottom: 1px solid var(--wx-gitlab-modal-section-border);
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--wx-gitlab-modal-text);
        }

        .settings-hint {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: var(--wx-gitlab-modal-hint-text);
        }

        .holidays-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--wx-gitlab-filter-input-border);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background);
          color: var(--wx-gitlab-modal-text);
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
          resize: vertical;
          box-sizing: border-box;
        }

        .holidays-textarea:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .holidays-textarea.disabled {
          background: var(--wx-gitlab-disabled-background, #f5f5f5);
          color: var(--wx-gitlab-disabled-text, #999);
          cursor: not-allowed;
          opacity: 0.7;
        }

        .settings-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .permission-warning {
          font-size: 12px;
          font-weight: normal;
          color: #e67700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .permission-warning i {
          font-size: 11px;
        }

        .saving-indicator {
          font-size: 12px;
          font-weight: normal;
          color: #1f75cb;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .holidays-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .holiday-presets {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .preset-btn {
          padding: 6px 12px;
          border: 1px solid var(--wx-gitlab-button-border);
          border-radius: 4px;
          background: var(--wx-gitlab-button-background);
          color: var(--wx-gitlab-button-text);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .preset-btn:hover {
          background: var(--wx-gitlab-button-hover-background);
          border-color: var(--wx-gitlab-button-hover-text);
        }

        .preset-btn-clear {
          background: #f8d7da;
          border-color: #f5c6cb;
          color: #721c24;
        }

        .preset-btn-clear:hover {
          background: #f5c6cb;
        }

        .btn-close-modal {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: var(--wx-gitlab-button-text);
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
        }

        .btn-close-modal:hover {
          color: var(--wx-gitlab-button-hover-text);
        }

        /* Today marker styling - see shared/TodayMarker.css */

        .stats-panel {
          display: flex;
          gap: 12px;
          margin-left: auto;
          font-size: 12px;
        }

        .stat-item {
          display: flex;
          gap: 3px;
          align-items: center;
        }

        .stat-label {
          color: var(--wx-gitlab-control-text);
          font-weight: 500;
        }

        .stat-value {
          font-weight: 600;
          color: var(--wx-gitlab-control-value);
        }

        .stat-completed {
          color: #28a745;
        }

        .stat-progress {
          color: #1f75cb;
        }

        .stat-overdue {
          color: #dc3545;
        }

        .error-banner {
          background: #f8d7da;
          color: #721c24;
          padding: 12px 16px;
          border-left: 4px solid #dc3545;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .retry-btn {
          padding: 4px 12px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .retry-btn:hover {
          background: #c82333;
        }

        .gantt-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .gantt-toolbar-row {
          display: flex;
          align-items: center;
          /* Match wx-toolbar padding */
          padding: 4px;
        }

        .gantt-toolbar-row .column-settings-container {
          /* Match wx-tb-element padding for consistent spacing */
          padding: 4px;
          flex-shrink: 0;
        }

        /* Remove wx-toolbar's left padding since gantt-toolbar-row provides it */
        .gantt-toolbar-row .wx-toolbar {
          padding-left: 0;
        }

        .gantt-chart-container {
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Make task bars semi-transparent to see grid and holidays */
        .wx-task {
          opacity: 0.7;
        }

        .wx-summary {
          opacity: 0.7;
        }

        .wx-task:hover,
        .wx-summary:hover {
          opacity: 0.85;
        }

        .wx-task.wx-selected,
        .wx-summary.wx-selected {
          opacity: 0.9;
        }

        /* Milestone styling - use class-based selector for GitLab milestones */
        /* Exclude milestones with color rules (they use striped backgrounds) */
        .wx-bar.wx-gitlab-milestone:not(.wx-color-rule-single):not(.wx-color-rule-double):not(.wx-color-rule-triple) {
          background-color: var(--wx-gantt-milestone-color) !important;
          border-color: var(--wx-gantt-milestone-color) !important;
        }

        .wx-bar.wx-gitlab-milestone:not(.wx-color-rule-single):not(.wx-color-rule-double):not(.wx-color-rule-triple) .wx-content {
          background-color: var(--wx-gantt-milestone-color) !important;
        }

        .gitlab-gantt-loading,
        .gitlab-gantt-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 20px;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #1f75cb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-message {
          text-align: center;
          color: #666;
        }

        .empty-message h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .empty-message p {
          margin: 0;
        }

        /* Weekend and holiday highlighting */
        .wx-gantt-holidays .wx-weekend {
          background-color: var(--wx-gantt-holiday-background) !important;
          position: absolute !important;
          height: 100% !important;
          z-index: 0 !important;
        }

        /* Baseline bar styling - keep default height with padding */
        .wx-baseline {
          pointer-events: none !important;
          background-color: #00ba94 !important; /* Green - represents GitLab Task original range */
          z-index: 1 !important;
          opacity: 0.7 !important;
        }

        /* Milestone baseline should be blue (contains issues) */
        .wx-baseline.wx-milestone {
          background-color: #37a9ef !important; /* Blue - represents GitLab Issue original range */
        }

        /* Parent task bracket baseline */
        .wx-baseline-bracket {
          color: #00ba94 !important;
          opacity: 0.5 !important;
        }

        .wx-baseline-bracket.wx-milestone {
          color: #37a9ef !important;
        }

        /* Parent task bar z-index (color is controlled by theme CSS via .wx-summary) */
        .wx-bar.wx-parent-task {
          z-index: 2 !important;
        }
      `}</style>
    </div>
  );
}
