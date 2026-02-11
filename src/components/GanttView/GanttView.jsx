/**
 * GanttView Component
 *
 * Gantt chart view that uses shared GitLabDataContext for data.
 * Extracted from GitLabGantt.jsx - this component handles all Gantt-specific UI logic
 * while the data layer is managed by GitLabDataProvider.
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import '../LabelCell.css';
import './GanttView.css';
import '../shared/modal-close-button.css';
import '../shared/SettingsModal.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Gantt from '../Gantt.jsx';
import Editor from '../Editor.jsx';
import Toolbar from '../Toolbar.jsx';
import ContextMenu from '../ContextMenu.jsx';
import SmartTaskContent from '../SmartTaskContent.jsx';
import Tooltip from '../../widgets/Tooltip.jsx';
import TaskTooltipContent from '../TaskTooltipContent.jsx';
import { useGitLabData } from '../../contexts/GitLabDataContext';
import { useDateRangePreset } from '../../hooks/useDateRangePreset.ts';
import { DataFilters } from '../../utils/DataFilters';
import {
  formatDateToLocalString,
  createStartDate,
  createEndDate,
} from '../../utils/dateUtils.js';
import { ProjectSelector } from '../ProjectSelector.jsx';
import { SyncButton } from '../SyncButton.jsx';
import { FilterPanel } from '../FilterPanel.jsx';
import {
  ColumnSettingsDropdown,
  useColumnSettings,
  buildColumnsFromSettings,
} from '../ColumnSettingsDropdown.jsx';
import DateEditCell from '../grid/DateEditCell.jsx';
import { ColorRulesEditor } from '../ColorRulesEditor.jsx';
import { MoveInModal } from '../MoveInModal.jsx';
import { SaveBlueprintModal } from '../SaveBlueprintModal.jsx';
import { ApplyBlueprintModal } from '../ApplyBlueprintModal.jsx';
import { BlueprintManager } from '../BlueprintManager.jsx';
import { useBlueprint } from '../../hooks/useBlueprint.ts';
import { applyBlueprint as applyBlueprintService } from '../../providers/BlueprintService.ts';
import { defaultMenuOptions } from '@svar-ui/gantt-store';
import { ConfirmDialog } from '../shared/dialogs/ConfirmDialog';
import { CreateItemDialog } from '../shared/dialogs/CreateItemDialog';
import { DeleteDialog } from '../shared/dialogs/DeleteDialog';
import {
  isLegacyMilestoneId,
  migrateLegacyMilestoneId,
} from '../../utils/MilestoneIdUtils.ts';
import {
  findLinkBySourceTarget,
  validateLinkGitLabMetadata,
} from '../../utils/LinkUtils';
import { useUndoRedoActions } from '../../hooks/useUndoRedoActions';
import { BulkOperationsBar } from '../BulkOperationsBar';
import { useStore } from '@svar-ui/lib-react';

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
  return tasks.filter((task) => task != null);
}

/**
 * Get all children (direct and nested) of a task recursively
 * Used for recursive delete feature
 *
 * @param {string|number} taskId - The parent task ID
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Array of child task objects (all descendants)
 */
function getChildrenForTask(taskId, allTasks) {
  const children = [];

  const findChildren = (parentId) => {
    const directChildren = allTasks.filter((t) => t.parent === parentId);
    for (const child of directChildren) {
      children.push(child);
      // Recursively find grandchildren
      findChildren(child.id);
    }
  };

  findChildren(taskId);
  return children;
}

/**
 * Sort task IDs by deletion order (children first, then parents)
 * GitLab requires children to be deleted before parents
 *
 * @param {Array} taskIds - Array of task IDs to sort
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Sorted array of task IDs
 */
function sortByDeletionOrder(taskIds, allTasks) {
  // Build depth map (distance from root)
  const depthMap = new Map();

  for (const id of taskIds) {
    const task = allTasks.find((t) => t.id === id);
    if (!task) continue;

    let depth = 0;
    let current = task;
    while (current.parent && current.parent !== 0) {
      depth++;
      current = allTasks.find((t) => t.id === current.parent);
      if (!current) break;
    }
    depthMap.set(id, depth);
  }

  // Sort by depth descending (deepest/children first)
  return [...taskIds].sort(
    (a, b) => (depthMap.get(b) || 0) - (depthMap.get(a) || 0),
  );
}

/**
 * GanttView Props
 * @param {boolean} hideSharedToolbar - Hide shared toolbar elements (project selector, sync button)
 *                                      when embedded in GitLabWorkspace which provides these.
 *                                      FilterPanel is always shown regardless of this prop.
 * @param {boolean} showSettings - Control settings modal visibility from parent
 * @param {function} onSettingsClose - Callback when settings modal is closed
 */
export function GanttView({
  hideSharedToolbar = false,
  showSettings: externalShowSettings,
  onSettingsClose,
  externalShowViewOptions,
}) {
  // === Get data from GitLabDataContext ===
  const {
    // Core Data
    tasks: allTasks,
    links,
    milestones,
    epics,
    sprints,
    // Sync State & Actions
    syncState,
    sync,
    syncTask,
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
    // Filter State
    filterOptions,
    serverFilterOptions,
    serverFilterOptionsLoading,
    activeServerFilters,
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
    // Utilities
    showToast,
    countWorkdays,
    calculateEndDateByWorkdays,
    highlightTime,
  } = useGitLabData();

  // === GanttView-specific State ===
  const [api, setApi] = useState(null);

  // Undo/Redo feature
  const undoRedo = useUndoRedoActions({
    enabled: true,
    maxHistory: 50,
    api,
  });

  // Refs for undo/redo recording functions (to access in init callback)
  const recordTaskActionRef = useRef(undoRedo.recordTaskAction);
  const recordLinkActionRef = useRef(undoRedo.recordLinkAction);

  // Keep refs updated
  useEffect(() => {
    recordTaskActionRef.current = undoRedo.recordTaskAction;
    recordLinkActionRef.current = undoRedo.recordLinkAction;
  }, [undoRedo.recordTaskAction, undoRedo.recordLinkAction]);
  // Settings modal can be controlled externally (from GitLabWorkspace) or internally
  const [internalShowSettings, setInternalShowSettings] = useState(false);
  const showSettings =
    externalShowSettings !== undefined
      ? externalShowSettings
      : internalShowSettings;
  const setShowSettings = onSettingsClose
    ? (value) => {
        if (!value) onSettingsClose();
        else setInternalShowSettings(true);
      }
    : setInternalShowSettings;
  // View Options can be controlled externally (from GitLabWorkspace) or internally
  const [internalShowViewOptions, setInternalShowViewOptions] = useState(false);
  const showViewOptions =
    externalShowViewOptions !== undefined
      ? externalShowViewOptions
      : internalShowViewOptions;
  const setShowViewOptions = setInternalShowViewOptions;

  // MoveInModal state
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [moveInProcessing, setMoveInProcessing] = useState(false);

  // Blueprint state
  const [showSaveBlueprintModal, setShowSaveBlueprintModal] = useState(false);
  const [showApplyBlueprintModal, setShowApplyBlueprintModal] = useState(false);
  const [showBlueprintManager, setShowBlueprintManager] = useState(false);
  const [selectedMilestoneForBlueprint, setSelectedMilestoneForBlueprint] =
    useState(null);

  // Dialog states for replacing native browser dialogs
  const [createItemDialogOpen, setCreateItemDialogOpen] = useState(false);
  const [createItemDialogType, setCreateItemDialogType] = useState('milestone');
  const [createItemDialogContext, setCreateItemDialogContext] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogItems, setDeleteDialogItems] = useState([]);
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] =
    useState(false);

  // Track selected tasks for bulk operations
  const selectedIds = useStore(api, 'selected');
  const selectedTasksForBulk = useMemo(() => {
    if (!api || !selectedIds || selectedIds.length === 0) return [];
    return selectedIds
      .map((id) => api.getTask(id))
      .filter((task) => task != null);
  }, [api, selectedIds]);

  // Handler to deselect all
  const handleDeselectAll = useCallback(() => {
    if (api) {
      api.exec('clear-selection');
    }
  }, [api]);

  // Escape key handler to deselect all
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedTasksForBulk.length > 0) {
        handleDeselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTasksForBulk.length, handleDeselectAll]);

  // Date editing mode state (true = dates can be edited in grid cells)
  // NOTE: setDateEditable is not used yet but kept for future feature to toggle date editing
  // eslint-disable-next-line no-unused-vars
  const [dateEditable, setDateEditable] = useState(true);

  // Store reference to all tasks for event handlers
  const allTasksRef = useRef([]);
  // Store reference to links for event handlers (to avoid stale closure)
  const linksRef = useRef([]);
  // Store pending delete task IDs for delete dialog confirmation (supports batch)
  const pendingDeleteTaskIdsRef = useRef([]);
  // Store pending add-task context for create dialog confirmation
  const pendingAddTaskContextRef = useRef(null);

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
  // Includes migration from legacy milestone IDs (10000+) to new format (m-{iid})
  useEffect(() => {
    if (!currentConfig) return;

    try {
      const storageKey = getStorageKey();
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Migrate legacy milestone IDs (10000+) to new format (m-{iid})
        let needsMigration = false;
        const migratedEntries = Object.entries(parsed).map(([key, value]) => {
          if (isLegacyMilestoneId(key)) {
            needsMigration = true;
            return [migrateLegacyMilestoneId(key), value];
          }
          return [key, value];
        });

        openStateRef.current = new Map(migratedEntries);

        // Save migrated state back to localStorage if migration occurred
        if (needsMigration) {
          const migratedState = Object.fromEntries(migratedEntries);
          localStorage.setItem(storageKey, JSON.stringify(migratedState));
        }
      } else {
        openStateRef.current = new Map();
      }
    } catch (error) {
      console.error(
        '[GanttView] Failed to load fold state from localStorage:',
        error,
      );
    }
  }, [currentConfig, getStorageKey]);

  // Save fold state to localStorage whenever it changes
  const saveFoldStateToStorage = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stateObj = Object.fromEntries(openStateRef.current);
      localStorage.setItem(storageKey, JSON.stringify(stateObj));
    } catch (error) {
      console.error(
        '[GanttView] Failed to save fold state to localStorage:',
        error,
      );
    }
  }, [getStorageKey]);

  // Use ref to make saveFoldStateToStorage accessible in init callback
  const saveFoldStateRef = useRef(saveFoldStateToStorage);
  useEffect(() => {
    saveFoldStateRef.current = saveFoldStateToStorage;
  }, [saveFoldStateToStorage]);

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
          // localStorage keys are always strings, but Gantt task IDs can be numbers or strings (e.g., "m-1")
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
        console.error('[GanttView] Failed to restore fold state:', error);
      }
    };

    requestAnimationFrame(restoreFoldState);
  }, [allTasks, api]);

  // Create label priority map for sorting (lower number = higher priority)
  const labelPriorityMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.priority != null) {
        map.set(label.title, label.priority);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Create label color map for LabelCell rendering
  const labelColorMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.color) {
        map.set(label.title, label.color);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Build assignee options for CreateItemDialog (from server members)
  const assigneeOptions = useMemo(() => {
    const members = serverFilterOptions?.members || [];
    return members
      .map((member) => ({
        value: member.name, // Use display name as value (matches task.assigned)
        label: member.name,
        subtitle: `@${member.username}`,
        username: member.username,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [serverFilterOptions?.members]);

  // Add workdays and labelPriority to tasks for sorting support
  const tasksWithWorkdays = useMemo(() => {
    return allTasks.map((task) => {
      // Parse labels and find highest priority (lowest number)
      const taskLabels = task.labels
        ? task.labels.split(', ').filter(Boolean)
        : [];
      let labelPriority = Number.MAX_SAFE_INTEGER; // Default: unprioritized (sorts last)

      taskLabels.forEach((labelTitle) => {
        const priority = labelPriorityMap.get(labelTitle);
        if (priority !== undefined && priority < labelPriority) {
          labelPriority = priority;
        }
      });

      return {
        ...task,
        workdays:
          task.start && task.end ? countWorkdays(task.start, task.end) : 0,
        labelPriority,
      };
    });
  }, [allTasks, countWorkdays, labelPriorityMap]);

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return DataFilters.applyFilters(tasksWithWorkdays, filterOptions);
  }, [tasksWithWorkdays, filterOptions]);

  // Calculate statistics
  const stats = useMemo(() => {
    return DataFilters.calculateStats(filteredTasks);
  }, [filteredTasks]);

  // Apply native SVAR filter-rows for better performance and animation
  // This replaces React-based filtering for the visual display
  useEffect(() => {
    if (!api || tasksWithWorkdays.length === 0) return;

    const tableAPI = api.getTable();
    if (!tableAPI) return;

    const hasFilters = DataFilters.hasActiveFilters(filterOptions);

    if (hasFilters) {
      const filterFn = DataFilters.createSvarFilterFunction(
        tasksWithWorkdays,
        filterOptions,
      );
      tableAPI.exec('filter-rows', { filter: filterFn });
    } else {
      tableAPI.exec('filter-rows', { filter: null });
    }
  }, [api, tasksWithWorkdays, filterOptions]);

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
  // NOTE: These refs are reserved for future debounced date change feature
  // eslint-disable-next-line no-unused-vars
  const pendingDateChangesRef = useRef(new Map());
  // eslint-disable-next-line no-unused-vars
  const dateChangeTimersRef = useRef(new Map());

  // Custom editor bottom bar with Save and Close buttons
  // NOTE: editorBottomBar is defined but not currently used (Editor uses bottomBar={false})
  // Kept for potential future use when custom editor bottom bar is needed
  // eslint-disable-next-line no-unused-vars
  const editorBottomBar = useMemo(
    () => ({
      items: [
        { comp: 'button', type: 'secondary', text: 'Close', id: 'close' },
        { comp: 'spacer' },
        { comp: 'button', type: 'primary', text: 'Save', id: 'save' },
      ],
    }),
    [],
  );

  // Blueprint hook
  const {
    blueprints,
    loading: blueprintsLoading,
    canUseSnippet: canUseBlueprintSnippet,
    addBlueprint,
    deleteBlueprint,
    renameBlueprint,
    // NOTE: reloadBlueprints is available but not currently used
    // eslint-disable-next-line no-unused-vars
    reload: reloadBlueprints,
  } = useBlueprint({
    fullPath: projectPath,
    proxyConfig,
    configType: currentConfig?.type || 'project',
    id: currentConfig?.projectId || currentConfig?.groupId,
  });

  // Handler for adding a new milestone - opens CreateItemDialog
  const handleAddMilestone = useCallback(() => {
    setCreateItemDialogType('milestone');
    setCreateItemDialogContext(null);
    setCreateItemDialogOpen(true);
  }, []);

  // Handler for CreateItemDialog confirmation
  const handleCreateItemConfirm = useCallback(
    async (items) => {
      if (createItemDialogType === 'milestone') {
        // Milestone creation (single mode only)
        const { title, description } = items[0];

        try {
          const milestone = {
            text: title,
            details: description || '',
            parent: 0,
          };

          await createMilestone(milestone);
          setCreateItemDialogOpen(false);
        } catch (error) {
          console.error('[GanttView] Failed to create milestone:', error);
          showToast(`Failed to create milestone: ${error.message}`, 'error');
          throw error;
        }
      } else {
        // Issue/Task creation - use the stored context from intercept
        const context = pendingAddTaskContextRef.current;
        if (!context) {
          setCreateItemDialogOpen(false);
          return;
        }

        const { baseTask, parentTask, itemType } = context;

        try {
          // Create items directly via createTask (supports batch)
          for (const item of items) {
            const newTask = {
              ...baseTask,
              text: item.title,
              details: item.description || '',
              // Add assignees (display names, GraphQL provider will resolve)
              assigned: item.assignees?.join(', ') || '',
            };

            // If creating under a milestone, add milestone info
            if (itemType === 'issue' && parentTask?.$isMilestone) {
              newTask._gitlab = {
                ...newTask._gitlab,
                milestoneGlobalId: parentTask._gitlab.globalId,
              };
            }

            // If creating task under an issue, set parent
            if (itemType === 'task' && parentTask?.$isIssue) {
              newTask.parent = parentTask.id;
            }

            await createTask(newTask);
          }

          // Sync to get the newly created items
          await sync();

          pendingAddTaskContextRef.current = null;
          setCreateItemDialogOpen(false);
        } catch (error) {
          console.error(`[GanttView] Failed to create ${itemType}:`, error);
          showToast(`Failed to create ${itemType}: ${error.message}`, 'error');
          throw error;
        }
      }
    },
    [createItemDialogType, createMilestone, createTask, showToast, sync],
  );

  // Handler for discard changes dialog confirmation
  const handleDiscardChangesConfirm = useCallback(() => {
    pendingEditorChangesRef.current.clear();
    if (api) {
      api.exec('close-editor');
      sync(); // Reload to revert local changes
    }
    setDiscardChangesDialogOpen(false);
  }, [api, sync]);

  // Handler for delete dialog confirmation
  const handleDeleteConfirm = useCallback(
    async (action, options = {}) => {
      const { recursive = false } = options;
      let taskIds = [...pendingDeleteTaskIdsRef.current];

      if (!taskIds || taskIds.length === 0 || !api) {
        setDeleteDialogOpen(false);
        return;
      }

      try {
        // If recursive, expand to include all descendants
        if (recursive) {
          const allItems = new Set(taskIds);
          for (const taskId of taskIds) {
            const children = getChildrenForTask(taskId, allTasksRef.current);
            children.forEach((child) => allItems.add(child.id));
          }
          taskIds = Array.from(allItems);
        }

        // Sort by deletion order: children first, then parents (GitLab requirement)
        taskIds = sortByDeletionOrder(taskIds, allTasksRef.current);

        // Track already processed items to avoid duplicates
        const processedSet = new Set();

        if (action === 'delete') {
          // Execute the delete for all items with skipHandler to avoid re-triggering the intercept
          for (const taskId of taskIds) {
            if (processedSet.has(taskId)) continue;
            processedSet.add(taskId);
            api.exec('delete-task', { id: taskId, skipHandler: true });
          }
        } else if (action === 'close') {
          // Close issues/tasks by updating their state
          for (const taskId of taskIds) {
            if (processedSet.has(taskId)) continue;

            // Skip milestones for close action (milestones cannot be closed)
            const task = allTasksRef.current.find((t) => t.id === taskId);
            if (task?.$isMilestone || task?._gitlab?.type === 'milestone') {
              console.log(
                `[GanttView] Skipping close for milestone: ${taskId}`,
              );
              continue;
            }

            processedSet.add(taskId);
            await syncTask(taskId, { state: 'closed' });
          }
          // Refresh to reflect the closed state
          await sync();
          const closedCount = processedSet.size;
          showToast(
            `${closedCount > 1 ? `${closedCount} items` : 'Item'} closed successfully`,
            'success',
          );
        }
      } catch (error) {
        console.error('[GanttView] Delete/close failed:', error);
        showToast(`Failed to ${action} items: ${error.message}`, 'error');
      }

      pendingDeleteTaskIdsRef.current = [];
      setDeleteDialogItems([]);
      setDeleteDialogOpen(false);
    },
    [api, syncTask, sync, showToast],
  );

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

    // Add Split Task option - only for regular tasks (not milestones or summaries)
    const splitIndex = options.findIndex((opt) => opt.id === 'delete-task');
    if (splitIndex !== -1) {
      options.splice(splitIndex, 0, {
        id: 'split-task',
        text: 'Split Task',
        icon: 'wxi-split',
        // Only show for regular tasks with dates (not milestones, summaries, or split tasks)
        check: (task) => {
          if (!task) return false;
          if (task.type === 'milestone' || task.type === 'summary')
            return false;
          if (task.splitParts && task.splitParts.length > 1) return false;
          return task.start != null && task.end != null;
        },
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
  const handleContextMenuClick = useCallback(
    ({ action, context: ctx }) => {
      if (action?.id === 'move-in') {
        // Capture selected tasks at the moment the menu is clicked
        const tasks = getSelectedTasks();
        setSelectedTasksForModal(tasks);
        // Open the Move In modal
        setShowMoveInModal(true);
      } else if (action?.id === 'split-task') {
        // Split task at midpoint - default split behavior
        if (ctx && api) {
          const task = api.getTask(ctx.id);
          if (task?.start && task?.end) {
            const midTime =
              task.start.getTime() +
              (task.end.getTime() - task.start.getTime()) / 2;
            const splitDate = new Date(midTime);
            api.exec('split-task', { id: ctx.id, splitDate });
            showToast(
              `Task "${task.text}" split at ${splitDate.toLocaleDateString()}`,
              'success',
            );
          }
        }
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
    },
    [getSelectedTasks, api, showToast],
  );

  // Handle Move In action
  const handleMoveIn = useCallback(
    async (type, targetId, items) => {
      if (!provider || items.length === 0) return;

      setMoveInProcessing(true);

      try {
        const iids = items.map((item) => Number(item.id));
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
          showToast(
            `Successfully moved ${result.success.length} item(s)`,
            'success',
          );
        } else if (result.success.length > 0 && result.failed.length > 0) {
          showToast(
            `Moved ${result.success.length} item(s), ${result.failed.length} failed`,
            'warning',
          );
        } else if (result.failed.length > 0) {
          // Show each failed item as a separate toast for better visibility
          result.failed.forEach((f) => {
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
          await sync();
        }
      } catch (error) {
        console.error('[GanttView] Move In failed:', error);
        showToast(`Move failed: ${error.message}`, 'error');
        throw error; // Re-throw so modal knows operation failed
      } finally {
        setMoveInProcessing(false);
      }
    },
    [provider, showToast, sync],
  );

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

      // Auto-scroll to today after data loads
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Try multiple times with increasing delays to ensure chart is loaded
      // eslint-disable-next-line no-unused-vars
      const attemptScroll = (_attempt = 1) => {
        try {
          const state = ganttApi.getState();
          const cellWidth = state.cellWidth || 40;
          // eslint-disable-next-line no-unused-vars
          const _scales = state._scales || [];
          const start = state.start;

          if (start) {
            // Calculate days from timeline start to today
            const daysDiff = Math.floor(
              (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            const scrollLeft = Math.max(0, daysDiff * cellWidth);

            // Use scroll-chart command to set scroll position
            ganttApi.exec('scroll-chart', { left: scrollLeft });
            return true;
          }

          return false;
          // eslint-disable-next-line no-unused-vars
        } catch (scrollError) {
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
          // Always use string keys to match localStorage (which serializes keys as strings)
          // This ensures consistency between numeric IDs (issues) and string IDs (milestones like "m-1")
          const idKey = String(ev.id);
          openStateRef.current.set(idKey, ev.mode);
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
          const editorInputs = document.querySelectorAll(
            '.wx-editor input, .wx-editor textarea',
          );
          editorInputs.forEach((input) => {
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
              await sync();

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
            // Show discard changes dialog instead of native confirm
            setDiscardChangesDialogOpen(true);
            // Dialog will handle the actual close via handleDiscardChangesConfirm
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

      // Handle split-task action
      ganttApi.on('split-task', (ev) => {
        const { id, splitDate } = ev;
        if (!id) return;

        const task = ganttApi.getTask(id);
        if (!task || !task.start || !task.end) return;

        // Use provided split date or default to midpoint
        const actualSplitDate =
          splitDate ||
          new Date(
            task.start.getTime() +
              (task.end.getTime() - task.start.getTime()) / 2,
          );

        // Validate split date is within task range
        if (actualSplitDate <= task.start || actualSplitDate >= task.end) {
          showToast('Split date must be within task duration', 'error');
          return;
        }

        // Create split parts
        const splitParts = [
          { start: task.start, end: actualSplitDate },
          { start: actualSplitDate, end: task.end },
        ];

        // Update task with split parts
        ganttApi.exec('update-task', {
          id,
          task: {
            splitParts,
          },
          skipSync: true, // Don't sync to GitLab - split is visual only
        });
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

        // Record undo: capture before state before update
        if (!ev.skipUndo) {
          const task = ganttApi.getTask(ev.id);
          if (task && !ev.skipSync) {
            // Store before state for later recording
            ev._undoBefore = { ...task };
          }
        }

        // Only process move mode drags (not resize)
        // GitLab milestones have start and end dates, so they also need workdays adjustment
        if (ev.mode === 'move' && ev.diff) {
          const task = ganttApi.getTask(ev.id);

          // ganttApi.getTask() returns the CURRENT state (before this update)
          const originalStart = task.start;
          const originalEnd = task.end;

          if (originalStart && originalEnd) {
            const originalWorkdays = countWorkdaysRef.current(
              originalStart,
              originalEnd,
            );

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
            state.originalWorkdays,
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
        if (
          !ev.skipBaselineDrag &&
          (ev.task.start !== undefined || ev.task.end !== undefined)
        ) {
          const currentTask = ganttApi.getTask(ev.id);

          if (currentTask.parent && currentTask.parent !== 0) {
            // Get all siblings from ganttApi to ensure we have the latest data
            const allTasks = allTasksRef.current;
            const siblingIds = allTasks
              .filter((t) => t && t.parent === currentTask.parent)
              .map((t) => t.id);

            if (siblingIds.length > 0) {
              // Get fresh data from ganttApi for each sibling
              const siblings = siblingIds
                .map((id) => ganttApi.getTask(id))
                .filter((t) => t);

              const childStarts = siblings
                .map((c) => c.start)
                .filter((s) => s !== undefined);
              const childEnds = siblings
                .map((c) => c.end)
                .filter((e) => e !== undefined);

              if (childStarts.length > 0 && childEnds.length > 0) {
                const spanStart = new Date(
                  Math.min(...childStarts.map((d) => d.getTime())),
                );
                const spanEnd = new Date(
                  Math.max(...childEnds.map((d) => d.getTime())),
                );

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

        // Record undo for update-task (if we captured before state)
        if (ev._undoBefore && !ev.skipUndo) {
          const afterTask = ganttApi.getTask(ev.id);
          if (afterTask) {
            recordTaskActionRef.current('update', ev._undoBefore, {
              ...afterTask,
            });
          }
        }

        // Determine if this is a visual change (dates) or text change
        const hasDateChange =
          ev.task.start !== undefined ||
          ev.task.end !== undefined ||
          ev.task.duration !== undefined;

        const hasTextChange =
          ev.task.text !== undefined ||
          ev.task.details !== undefined ||
          ev.task.acceptanceCriteria !== undefined;

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
          if (ev.task.acceptanceCriteria !== undefined) {
            taskChanges.acceptanceCriteria = ev.task.acceptanceCriteria;
          }

          // Date fields - support null values for clearing dates
          // Sources of date changes:
          // 1. Editor: ev._originalDateValues contains user-set values (Date or null)
          // 2. Grid: ev._originalDateChange contains the single changed field
          // 3. Timeline drag: ev.task contains the new values directly
          //
          // For Editor/Grid, we use the _original* fields to preserve null values
          // (svar merges ev.task with store, overwriting nulls with existing values)

          const isFromEditor =
            ev._originalDateValues &&
            Object.keys(ev._originalDateValues).length > 0;
          const isFromGrid = !!ev._originalDateChange;

          // Determine actual values - prefer _original* sources for null preservation
          let startValue, endValue;
          let hasStartChange = false,
            hasEndChange = false;

          if (isFromEditor) {
            // Editor provides explicit list of changed fields
            if (
              Object.prototype.hasOwnProperty.call(
                ev._originalDateValues,
                'start',
              )
            ) {
              startValue = ev._originalDateValues.start;
              hasStartChange = true;
            }
            if (
              Object.prototype.hasOwnProperty.call(
                ev._originalDateValues,
                'end',
              )
            ) {
              endValue = ev._originalDateValues.end;
              hasEndChange = true;
            }
          } else if (isFromGrid) {
            // Grid changes one field at a time
            if (ev._originalDateChange.column === 'start') {
              startValue = ev._originalDateChange.value;
              hasStartChange = true;
            } else if (ev._originalDateChange.column === 'end') {
              endValue = ev._originalDateChange.value;
              hasEndChange = true;
            }
          } else {
            // Timeline drag - use ev.task values directly (original behavior)
            if (ev.task.start !== undefined) {
              startValue = ev.task.start;
              hasStartChange = true;
            }
            if (ev.task.end !== undefined) {
              endValue = ev.task.end;
              hasEndChange = true;
            }
          }

          // Process start date - normalize to 00:00:00 local time
          if (hasStartChange) {
            const normalizedStart = createStartDate(startValue);
            taskChanges.start = normalizedStart; // can be null
            ev.task.start = normalizedStart;
            if (!taskChanges._gitlab)
              taskChanges._gitlab = { ...currentTask._gitlab };
            taskChanges._gitlab.startDate = formatDateToLocalString(startValue);
          }

          // Process end date - normalize to 23:59:59 local time
          if (hasEndChange) {
            const normalizedEnd = createEndDate(endValue);
            taskChanges.end = normalizedEnd; // can be null
            ev.task.end = normalizedEnd;
            if (!taskChanges._gitlab)
              taskChanges._gitlab = { ...currentTask._gitlab };
            taskChanges._gitlab.dueDate = formatDateToLocalString(endValue);
          }

          if (ev.task.duration !== undefined) {
            taskChanges.duration = ev.task.duration;
          }

          // Update ev.task._gitlab so Grid cells (DateEditCell) show updated values
          if (taskChanges._gitlab) {
            ev.task._gitlab = taskChanges._gitlab;
          }

          // Check if any date was cleared (set to null)
          const hasDateCleared =
            (hasStartChange && startValue === null) ||
            (hasEndChange && endValue === null);

          (async () => {
            try {
              await syncTask(ev.id, taskChanges);

              // If a date was cleared, refresh from GitLab because svar Gantt
              // doesn't properly handle null dates (auto-fills via normalizeDates)
              if (hasDateCleared) {
                sync();
              }
            } catch (error) {
              console.error('Failed to sync task update:', error);
              showToast(`Failed to sync task: ${error.message}`, 'error');
              // Revert by reloading from GitLab
              sync();
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
            // Creating issue under milestone - show CreateItemDialog
            const defaultTitle =
              ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

            // Store context for dialog confirmation
            pendingAddTaskContextRef.current = {
              baseTask: { ...ev.task, text: defaultTitle },
              parentTask,
              itemType: 'issue',
            };

            setCreateItemDialogType('issue');
            setCreateItemDialogContext({ parentMilestone: parentTask });
            setCreateItemDialogOpen(true);

            // Block the add-task - dialog will handle creation directly
            return false;
          }

          // Check if parent is a GitLab Task (subtask)
          // Only GitLab Tasks cannot have children (third level not allowed)
          // Issues under milestones CAN have children (Tasks)
          const isParentGitLabTask =
            parentTask && !parentTask.$isIssue && !parentTask.$isMilestone;

          if (isParentGitLabTask) {
            showToast(
              'Cannot create subtasks under a GitLab Task. Only Issues can have Tasks as children.',
              'warning',
            );
            return false;
          }

          // Check if parent is a GitLab Issue
          const isParentGitLabIssue = parentTask && parentTask.$isIssue;

          if (isParentGitLabIssue) {
            // Creating task under issue - show CreateItemDialog
            const defaultTitle =
              ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

            // Store context for dialog confirmation
            pendingAddTaskContextRef.current = {
              baseTask: { ...ev.task, text: defaultTitle },
              parentTask,
              itemType: 'task',
            };

            setCreateItemDialogType('task');
            setCreateItemDialogContext({ parentTask });
            setCreateItemDialogOpen(true);

            // Block the add-task - dialog will handle creation directly
            return false;
          }
        }

        // Creating top-level issue (no parent) - show CreateItemDialog
        const defaultTitle =
          ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

        // Store context for dialog confirmation
        pendingAddTaskContextRef.current = {
          baseTask: { ...ev.task, text: defaultTitle },
          parentTask: null,
          itemType: 'issue',
        };

        setCreateItemDialogType('issue');
        setCreateItemDialogContext(null);
        setCreateItemDialogOpen(true);

        // Block the add-task - dialog will handle creation directly
        return false;
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
          await sync();

          // Delete the temporary task (with baseline)
          ganttApi.exec('delete-task', {
            id: ev.id,
            skipHandler: true, // Skip intercept
            skipGitLabDelete: true, // Don't trigger GitLab delete
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
                  } catch {
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
          ganttApi.exec('delete-task', {
            id: ev.id,
            skipHandler: true,
            skipGitLabDelete: true,
          });
        }
      });

      // Intercept task deletion to show delete dialog
      ganttApi.intercept('delete-task', (ev) => {
        // Skip if this is an internal deletion (e.g., removing temp task)
        if (ev.skipHandler) {
          return true;
        }

        // Get task info for dialog
        const task = ganttApi.getTask(ev.id);
        const taskTitle = task ? task.text : `Item ${ev.id}`;

        // Determine the type of item
        let itemType = 'Issue';
        if (task?.$isMilestone || task?._gitlab?.type === 'milestone') {
          itemType = 'Milestone';
        } else if (task?._gitlab?.workItemType === 'Task') {
          itemType = 'Task';
        }

        // Get children for recursive delete option
        const children = getChildrenForTask(ev.id, allTasksRef.current);

        // Accumulate task IDs for batch deletion
        pendingDeleteTaskIdsRef.current = [
          ...pendingDeleteTaskIdsRef.current,
          ev.id,
        ];

        // Accumulate items for dialog display
        setDeleteDialogItems((prev) => [
          ...prev,
          {
            id: ev.id,
            title: taskTitle,
            type: itemType,
            children: children.map((child) => ({
              id: child.id,
              title: child.text,
              type: child.$isMilestone
                ? 'Milestone'
                : child._gitlab?.workItemType === 'Task'
                  ? 'Task'
                  : 'Issue',
            })),
          },
        ]);
        setDeleteDialogOpen(true);

        // Block the delete - dialog will handle it
        return false;
      });

      // Track pending delete operations for proper ordering
      // When deleting Milestone + Issues together, Issues must be deleted first
      const pendingDeletes = new Map(); // id -> Promise

      // Handle task deletion after confirmation
      ganttApi.on('delete-task', async (ev) => {
        // Skip if this is an internal deletion (e.g., removing temp task after create)
        // Note: skipHandler=true from dialog confirmation should NOT skip this handler
        // We use a separate flag (skipGitLabDelete) for internal deletions
        if (ev.skipGitLabDelete) {
          return;
        }

        try {
          // Get task data to pass to deleteTask for proper type detection
          // Try ganttApi first, then fall back to allTasksRef
          let task = ganttApi.getTask(ev.id);

          // If task from ganttApi doesn't have _gitlab info, try to find it in allTasksRef
          if (!task?._gitlab) {
            const taskFromRef = allTasksRef.current.find((t) => t.id === ev.id);
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
              const childTask = allTasksRef.current.find(
                (t) => t.id === childId,
              );
              if (childTask && childTask.parent === ev.id) {
                childDeletePromises.push(promise);
              }
            }

            // Wait for all children to be deleted first
            if (childDeletePromises.length > 0) {
              console.log(
                `[GanttView] Waiting for ${childDeletePromises.length} child items to be deleted before milestone...`,
              );
              await Promise.allSettled(childDeletePromises);
              // Small delay to ensure GitLab has processed the deletions
              await new Promise((resolve) => setTimeout(resolve, 500));
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
          sync();
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
        const movedType =
          movedTask._gitlab?.workItemType ||
          movedTask._gitlab?.type ||
          'unknown';
        // NOTE: targetType is used for debugging purposes
        // eslint-disable-next-line no-unused-vars
        const _targetType =
          targetTask._gitlab?.workItemType ||
          targetTask._gitlab?.type ||
          'unknown';

        const parentId = movedTask.parent || 0;
        const allTasks = allTasksRef.current;
        let siblings = allTasks.filter(
          (t) => t && (t.parent || 0) === parentId,
        );

        // Sort siblings by current displayOrder
        siblings.sort((a, b) => {
          const orderA = a.$custom?.displayOrder;
          const orderB = b.$custom?.displayOrder;
          if (orderA !== undefined && orderB !== undefined)
            return orderA - orderB;
          if (orderA !== undefined) return -1;
          if (orderB !== undefined) return 1;
          // Fallback: compare IDs as strings to handle both numeric and string IDs (e.g., "m-1")
          return String(a.id).localeCompare(String(b.id));
        });

        // Special case: When dragging to first position, Gantt sets ev.id === ev.target
        if (ev.id === ev.target) {
          // Find the current first task (excluding the moved task)
          const currentFirstTask = siblings.find((s) => s.id !== ev.id);

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
          const finalTargetTask =
            ev.target !== targetTask.id
              ? ganttApi.getTask(ev.target)
              : targetTask;

          // Get GitLab IIDs from the task objects
          const movedIid = movedTask._gitlab?.iid;
          const targetIid = finalTargetTask._gitlab?.iid;

          // Check if both tasks have valid GitLab IIDs
          if (!movedIid) {
            console.error(
              `[GitLab] Cannot reorder: moved task ${ev.id} has no GitLab IID`,
            );
            return;
          }

          // Use the type information we already extracted at the beginning
          const finalTargetType =
            finalTargetTask._gitlab?.workItemType ||
            finalTargetTask._gitlab?.type ||
            'unknown';

          // Milestones are special - they can't be used for reordering at all
          const targetIsMilestone =
            finalTargetTask.$isMilestone || finalTargetType === 'milestone';

          // Check if types are compatible for reordering
          // Issues can only reorder relative to other Issues
          // Tasks can only reorder relative to other Tasks (within same parent)
          const typesIncompatible =
            targetIsMilestone || movedType !== finalTargetType;

          if (typesIncompatible) {
            // For milestones, we need special logic since they appear at the top visually
            // but might be at the end of the siblings array due to missing displayOrder
            const isMilestoneTarget =
              finalTargetTask.$isMilestone || finalTargetType === 'milestone';

            if (isMilestoneTarget) {
              // When dragging to a milestone, move before the first compatible Issue
              const firstCompatibleIssue = siblings.find((s) => {
                if (s.id === ev.id) return false; // Skip self
                const siblingType =
                  s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
                if (s.$isMilestone || siblingType === 'milestone') return false;
                return movedType === siblingType && s._gitlab?.iid;
              });

              if (firstCompatibleIssue) {
                await provider.reorderWorkItem(
                  movedIid,
                  firstCompatibleIssue._gitlab.iid,
                  'before',
                );
              } else {
                console.error(
                  `[GitLab] No compatible ${movedType} found to reorder relative to`,
                );
              }
              return;
            }

            // Get the target's position in siblings array
            const targetIndex = siblings.findIndex((s) => s.id === ev.target);

            // Find compatible siblings before and after the target
            let compatibleBefore = null;
            let compatibleAfter = null;

            // Search backwards from target for compatible sibling
            for (let i = targetIndex - 1; i >= 0; i--) {
              const s = siblings[i];
              if (s.id === ev.id) continue; // Skip self
              const siblingType =
                s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
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
              const siblingType =
                s._gitlab?.workItemType || s._gitlab?.type || 'unknown';
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
            } else if (
              targetIndex === siblings.length - 1 ||
              !compatibleAfter
            ) {
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
              await provider.reorderWorkItem(
                movedIid,
                useTarget._gitlab.iid,
                useMode,
              );
            } else {
              console.error(
                `[GitLab] No compatible ${movedType} found to reorder relative to`,
              );
            }
            return;
          }

          if (!targetIid) {
            console.error(
              `[GitLab] Cannot reorder: target task ${ev.target} has no GitLab IID`,
            );
            return;
          }

          // Use GitLab native reorder API with actual GitLab IIDs
          await provider.reorderWorkItem(movedIid, targetIid, ev.mode);

          // Note: Automatic sync removed to prevent screen flickering
          // The Gantt chart maintains correct visual state after drag operation
          // Order has been saved to GitLab via reorderWorkItem() API
        } catch (error) {
          console.error(
            `[GitLab] Failed to reorder ${movedTask.text}: ${error.message}`,
          );
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
            console.warn(
              '[delete-link] No source/target in event, cannot find link',
            );
            return;
          }

          // Find matching link by source/target (prefers link with _gitlab metadata)
          const link = findLinkBySourceTarget(currentLinks, sourceId, targetId);

          if (!link) {
            console.warn(
              '[delete-link] Link not found in React state, skipping API call',
            );
            return;
          }

          // Validate GitLab metadata for API call
          const validation = validateLinkGitLabMetadata(link);

          if (validation.valid) {
            // Pass appropriate options based on link type
            const options = validation.isNativeLink
              ? { isNativeLink: true }
              : {
                  isNativeLink: false,
                  metadataRelation: validation.metadataRelation,
                  metadataTargetIid: validation.metadataTargetIid,
                };
            await deleteLink(
              link.id,
              validation.apiSourceIid,
              validation.linkedWorkItemGlobalId,
              options,
            );
          } else if (link._gitlab === undefined) {
            // Link exists but no _gitlab metadata - newly created and not yet synced
            showToast('Link was just created. Syncing to update...', 'info');
            await sync();
          } else {
            throw new Error(validation.error);
          }
        } catch (error) {
          console.error('Failed to delete link:', error);
          showToast(`Failed to delete link: ${error.message}`, 'error');
          sync();
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
            case 'e2s': {
              // End-to-Start: target starts day after source ends
              const next = new Date(newEnd);
              next.setDate(next.getDate() + 1);
              return next;
            }
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
          const parentWorkdays = countWorkdaysRef.current(
            parentTask.start,
            parentTask.end,
          );
          const newParentStart = new Date(parentOriginalStart);
          newParentStart.setDate(newParentStart.getDate() + diff);
          const newParentEnd = calculateEndDateByWorkdaysRef.current(
            newParentStart,
            parentWorkdays,
          );

          // 2. Collect all descendants and calculate original offset
          const descendants = getAllDescendants(parentId);
          const currentLinks = links || [];
          const descendantIds = new Set(descendants.map((d) => d.id));
          descendantIds.add(parentId); // Include parent in the set for link calculation

          const childData = descendants
            .map((child) => {
              const childTask = ganttApi.getTask(child.id);
              if (!childTask || !childTask.start) return null;

              const offsetMs =
                childTask.start.getTime() - parentOriginalStart.getTime();
              const offsetDays = Math.round(offsetMs / (1000 * 60 * 60 * 24));
              const workdays = countWorkdaysRef.current(
                childTask.start,
                childTask.end,
              );

              // Find inbound links from other cascade members to this task
              const inboundLinks = currentLinks.filter(
                (link) =>
                  link.target === child.id && descendantIds.has(link.source),
              );

              return {
                id: child.id,
                offsetDays,
                workdays,
                inboundLinks,
                _gitlab: childTask._gitlab,
              };
            })
            .filter(Boolean);

          // 3. Sort by start date (earliest first)
          childData.sort((a, b) => a.offsetDays - b.offsetDays);

          // 4. Process each child
          const processed = new Map(); // id -> { newStart, newEnd }
          processed.set(parentId, {
            newStart: newParentStart,
            newEnd: newParentEnd,
          });

          const updates = [];
          for (const child of childData) {
            let newStart;

            // Check if there's a processed link source
            const linkedSource = child.inboundLinks.find((l) =>
              processed.has(l.source),
            );
            if (linkedSource) {
              // Use link to calculate new start
              newStart = calculateStartFromLink(
                linkedSource,
                processed.get(linkedSource.source),
              );
            } else {
              // Preserve original offset from parent
              newStart = new Date(newParentStart);
              newStart.setDate(newStart.getDate() + child.offsetDays);
            }

            const newEnd = calculateEndDateByWorkdaysRef.current(
              newStart,
              child.workdays,
            );
            processed.set(child.id, { newStart, newEnd });
            updates.push({
              id: child.id,
              start: newStart,
              end: newEnd,
              _gitlab: child._gitlab,
            });
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
          await syncTask(parentId, {
            start: newParentStart,
            end: newParentEnd,
            _gitlab: parentTask._gitlab,
          });

          for (const u of updates) {
            await syncTask(u.id, {
              start: u.start,
              end: u.end,
              _gitlab: u._gitlab,
            });
          }

          showToast(`Moved ${updates.length + 1} items`, 'success');
        } catch (error) {
          console.error('Cascade move failed:', error);
          showToast(`Cascade move failed: ${error.message}`, 'error');
          sync(); // Reload to revert
        }
      });
    },
    // Note: countWorkdays/calculateEndDateByWorkdays not needed here as we use refs (countWorkdaysRef, calculateEndDateByWorkdaysRef)
    [
      syncTask,
      createTask,
      createMilestone,
      deleteTask,
      createLink,
      deleteLink,
      links,
      sync,
      provider,
      showToast,
    ],
  );

  // Today marker - ensure correct date without timezone issues
  const markers = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [
      {
        start: today, // IMarker uses 'start' not 'date'
        css: 'today-marker',
      },
    ];
  }, []);

  // Date cell component for custom formatting
  // For regular tasks: Check _gitlab.startDate / _gitlab.dueDate to determine if GitLab actually has the date
  // (row.start may be auto-filled with createdAt when GitLab has no startDate)
  // For milestones: Always show the date (milestones always have dates in GitLab)
  const DateCell = useCallback(({ row, column }) => {
    const isMilestone = row.$isMilestone || row._gitlab?.type === 'milestone';

    // Unscheduled tasks show '-' in date columns
    if (row.unscheduled === true) {
      return (
        <span style={{ color: 'var(--wx-color-font-alt, #9fa1ae)' }}>-</span>
      );
    }

    // Milestones always have dates, so skip the _gitlab check for them
    if (!isMilestone) {
      // For regular tasks, check if GitLab actually has the date
      const gitlabFieldName = column.id === 'start' ? 'startDate' : 'dueDate';
      const hasGitLabDate = row._gitlab?.[gitlabFieldName];

      if (!hasGitLabDate) {
        return (
          <span style={{ color: 'var(--wx-color-secondary, #6e6e73)' }}>
            None
          </span>
        );
      }
    }

    const date = row[column.id];
    if (!date)
      return (
        <span style={{ color: 'var(--wx-color-secondary, #6e6e73)' }}>
          None
        </span>
      );

    const d = date instanceof Date ? date : new Date(date);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  }, []);

  // Workdays cell - dynamically calculates workdays from row's current start/end
  // This ensures the display updates immediately when user drags to resize the bar
  const WorkdaysCell = useCallback(
    ({ row }) => {
      if (row.unscheduled === true) return '-';
      if (!row.start || !row.end) return '';
      const days = countWorkdays(row.start, row.end);
      return days ? `${days}d` : '';
    },
    [countWorkdays],
  );

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

  // Handler for date changes from Grid DateEditCell
  const handleGridDateChange = useCallback(
    (rowId, columnId, value) => {
      if (!api) return;

      // Trigger update-task event which will be handled by the existing sync logic
      // IMPORTANT: Pass _originalDateChange to preserve null values, because svar merges
      // ev.task with the gantt store, overwriting our null with the existing date
      api.exec('update-task', {
        id: rowId,
        task: {
          [columnId]: value, // value can be Date or null (cleared)
        },
        _originalDateChange: { column: columnId, value }, // Preserve original value
      });
    },
    [api],
  );

  // Columns configuration with visibility and order control
  const columns = useMemo(() => {
    // Build configurable columns from settings
    const configurableCols = buildColumnsFromSettings(columnSettings, {
      DateCell,
      DateEditCell,
      WorkdaysCell,
      labelColorMap,
      labelPriorityMap,
      dateEditable, // Enable/disable date editing in grid cells
      onDateChange: handleGridDateChange,
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
  }, [
    DateCell,
    TaskTitleCell,
    WorkdaysCell,
    columnSettings,
    labelColorMap,
    labelPriorityMap,
    dateEditable,
    handleGridDateChange,
  ]);

  // Editor items configuration - customized for GitLab
  // Use 'nullable-date' comp type for date fields to support clearing dates to null
  // (svar's default 'date' type always requires a value and doesn't support null)
  const editorItems = useMemo(() => {
    return [
      { key: 'text', comp: 'text', label: 'Title' },
      { key: 'start', comp: 'nullable-date', label: 'Start Date' },
      { key: 'end', comp: 'nullable-date', label: 'Due Date' },
      { key: 'workdays', comp: 'workdays', label: 'Workdays' },
      {
        key: 'details',
        comp: 'textarea',
        label: 'Description',
        config: { placeholder: 'No description' },
      },
      {
        key: 'acceptanceCriteria',
        comp: 'textarea',
        label: 'Acceptance Criteria',
        config: { placeholder: 'No acceptance criteria' },
      },
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
          <p>
            Please add a GitLab project or group configuration to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gitlab-gantt-container">
      {/* Toast notifications are now handled by GitLabDataProvider */}

      {/* Header section - hidden when hideSharedToolbar is true (e.g., embedded in unified toolbar) */}
      {!hideSharedToolbar && (
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
            <i
              className={`fas fa-chevron-${showViewOptions ? 'up' : 'down'} chevron-icon`}
            ></i>
          </button>

          <SyncButton
            onSync={sync}
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
              <span className="stat-value stat-completed">
                {stats.completed}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">In Progress:</span>
              <span className="stat-value stat-progress">
                {stats.inProgress}
              </span>
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
      )}

      {/* View Controls - render via portal when in workspace mode, otherwise inline */}
      {showViewOptions &&
        (() => {
          const viewControlsContent = (
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
                  onChange={(e) =>
                    handleCellWidthChange(Number(e.target.value))
                  }
                  className="slider"
                  disabled={lengthUnit !== 'day'}
                />
                <span className="control-value">
                  {lengthUnit === 'day' ? cellWidthDisplay : effectiveCellWidth}
                </span>
              </label>
              <label className="control-label">
                Height:
                <input
                  type="range"
                  min="20"
                  max="60"
                  value={cellHeightDisplay}
                  onChange={(e) =>
                    handleCellHeightChange(Number(e.target.value))
                  }
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
          );

          // If embedded in workspace, render via portal to the container above FilterPanel
          const portalContainer = document.getElementById(
            'view-options-container',
          );
          if (hideSharedToolbar && portalContainer) {
            return createPortal(viewControlsContent, portalContainer);
          }
          // Otherwise render inline
          return viewControlsContent;
        })()}

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
          <div
            className="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="modal-close-btn"
              >
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
                <p className="settings-hint">
                  Add holiday dates (one per line, formats: YYYY-MM-DD or
                  YYYY/M/D, optional name after space)
                </p>
                {holidaysError && (
                  <div className="holidays-error">
                    <i className="fas fa-exclamation-triangle"></i>{' '}
                    {holidaysError}
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
                <p className="settings-hint">
                  Add extra working days on weekends (one per line, formats:
                  YYYY-MM-DD or YYYY/M/D)
                </p>
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
                  Highlight time bars with diagonal stripes based on issue title
                  matching conditions
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

      {/* FilterPanel - only shown when not embedded in GitLabWorkspace */}
      {!hideSharedToolbar && (
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
          onServerFilterApply={handleServerFilterApply}
          isDirty={filterDirty}
        />
      )}

      {syncState.error && (
        <div className="error-banner">
          <strong>Sync Error:</strong> {syncState.error}
          <button onClick={() => sync()} className="retry-btn">
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
          <Toolbar
            api={api}
            onAddMilestone={handleAddMilestone}
            onOpenBlueprints={() => setShowBlueprintManager(true)}
            undoRedo={undoRedo}
          />
        </div>
        <div className="gantt-chart-container">
          {syncState.isLoading ? (
            <div className="loading-message">
              <p>Loading GitLab data...</p>
            </div>
          ) : (
            <ContextMenu
              api={api}
              options={contextMenuOptions}
              onClick={handleContextMenuClick}
            >
              {(() => {
                // Validate tasks structure before passing to Gantt
                const invalidTasks = tasksWithWorkdays.filter((task) => {
                  return !task.id || !task.text || !task.start;
                });

                if (invalidTasks.length > 0) {
                  console.error(
                    '[GanttView RENDER] Found invalid tasks:',
                    invalidTasks,
                  );
                }

                // Log all tasks with their parent relationships to find the problematic structure

                // Check for orphaned children (parent doesn't exist in the list)
                const taskIds = new Set(tasksWithWorkdays.map((t) => t.id));
                const orphanedTasks = tasksWithWorkdays.filter((task) => {
                  return (
                    task.parent &&
                    task.parent !== 0 &&
                    !taskIds.has(task.parent)
                  );
                });

                if (orphanedTasks.length > 0) {
                  // Separate Issues with Epic parents from other orphaned tasks
                  const issuesWithEpicParent = orphanedTasks.filter((task) => {
                    // Check if this Issue has Epic parent stored in metadata
                    return task._gitlab?.epicParentId;
                  });

                  const tasksWithMissingParent = orphanedTasks.filter(
                    (task) => {
                      // Everything else: Tasks with missing parents, or Issues with missing milestones
                      return !task._gitlab?.epicParentId;
                    },
                  );

                  if (issuesWithEpicParent.length > 0) {
                    // Get unique Epic IDs
                    const epicIds = new Set(
                      issuesWithEpicParent.map((t) => t._gitlab?.epicParentId),
                    );

                    // These are Issues with Epic parents - Epics are not supported yet
                    console.info(
                      '[GanttView] Some issues belong to Epics (not supported):',
                      {
                        epicIds: Array.from(epicIds),
                        affectedIssues: issuesWithEpicParent.length,
                        note: 'Epic support is not implemented. These issues will appear at root level.',
                      },
                    );
                  }

                  if (tasksWithMissingParent.length > 0) {
                    // This is an actual error - Tasks with missing parents
                    // Collect unique missing parent IDs
                    const missingParentIds = new Set(
                      tasksWithMissingParent.map((t) => t.parent),
                    );
                    console.error(
                      '[GanttView RENDER] Found orphaned tasks (parent does not exist):',
                      {
                        count: tasksWithMissingParent.length,
                        orphanedTaskIds: tasksWithMissingParent.map((t) => ({
                          id: t.id,
                          parent: t.parent,
                          text: t.text,
                          type: t.type,
                          _gitlab: t._gitlab?.type,
                        })),
                        missingParentIds: Array.from(missingParentIds),
                      },
                    );
                  }
                }

                try {
                  return (
                    <Tooltip api={api} content={TaskTooltipContent}>
                      <Gantt
                        key={`gantt-${lengthUnit}-${effectiveCellWidth}`}
                        init={(api) => {
                          try {
                            const result = init(api);
                            return result;
                          } catch (error) {
                            console.error(
                              '[Gantt init] ERROR in init callback:',
                              error,
                            );
                            console.error(
                              '[Gantt init] ERROR name:',
                              error.name,
                            );
                            console.error(
                              '[Gantt init] ERROR message:',
                              error.message,
                            );
                            console.error(
                              '[Gantt init] ERROR stack:',
                              error.stack,
                            );
                            throw error;
                          }
                        }}
                        tasks={tasksWithWorkdays}
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
                        sprints={sprints}
                      />
                    </Tooltip>
                  );
                } catch (error) {
                  console.error(
                    '[GanttView RENDER] ERROR rendering Gantt:',
                    error,
                  );
                  console.error('[GanttView RENDER] ERROR name:', error.name);
                  console.error(
                    '[GanttView RENDER] ERROR message:',
                    error.message,
                  );
                  console.error('[GanttView RENDER] ERROR stack:', error.stack);
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
            await sync();

            return result;
          } catch (error) {
            console.error('[GanttView] Apply blueprint error:', error);
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
        onApply={() => {
          setShowBlueprintManager(false);
          setShowApplyBlueprintModal(true);
        }}
      />

      {/* Create Item Dialog - for milestone/issue/task creation */}
      <CreateItemDialog
        isOpen={createItemDialogOpen}
        onClose={() => {
          setCreateItemDialogOpen(false);
          pendingAddTaskContextRef.current = null;
        }}
        onConfirm={handleCreateItemConfirm}
        itemType={createItemDialogType}
        parentTask={createItemDialogContext?.parentTask}
        assigneeOptions={assigneeOptions}
      />

      {/* Delete Dialog - for deleting items with close/delete options */}
      <DeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteDialogItems([]);
          pendingDeleteTaskIdsRef.current = [];
        }}
        onConfirm={handleDeleteConfirm}
        items={deleteDialogItems}
      />

      {/* Discard Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        onConfirm={handleDiscardChangesConfirm}
        title="Discard Changes"
        message="You have unsaved changes. Do you want to discard them?"
        severity="warning"
        confirmLabel="Discard"
      />

      {/* Bulk Operations Bar - shows when multiple items are selected */}
      <BulkOperationsBar
        selectedTasks={selectedTasksForBulk}
        api={api}
        provider={provider}
        assigneeOptions={assigneeOptions}
        onSync={sync}
        showToast={showToast}
        onDeselectAll={handleDeselectAll}
      />
    </div>
  );
}
