/**
 * GitLab Gantt Component
 * Main component that integrates GitLab data with react-gantt
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Gantt from './Gantt.jsx';
import Editor from './Editor.jsx';
import Toolbar from './Toolbar.jsx';
import ContextMenu from './ContextMenu.jsx';
import { GitLabGraphQLProvider } from '../providers/GitLabGraphQLProvider.ts';
import { gitlabConfigManager } from '../config/GitLabConfigManager.ts';
import { useGitLabSync } from '../hooks/useGitLabSync.ts';
import { GitLabFilters } from '../utils/GitLabFilters.ts';
import { ProjectSelector } from './ProjectSelector.jsx';
import { SyncButton } from './SyncButton.jsx';
import { FilterPanel } from './FilterPanel.jsx';

export function GitLabGantt({ initialConfigId, autoSync = false }) {
  const [api, setApi] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [provider, setProvider] = useState(null);
  const [filterOptions, setFilterOptions] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [configs, setConfigs] = useState([]);

  // Store reference to all tasks for event handlers
  const allTasksRef = useRef([]);

  // Load settings from localStorage with defaults
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-width');
    return saved ? Number(saved) : 40;
  });

  const [cellHeight, setCellHeight] = useState(() => {
    const saved = localStorage.getItem('gantt-cell-height');
    return saved ? Number(saved) : 38;
  });

  const [holidays, setHolidays] = useState(() => {
    const saved = localStorage.getItem('gantt-holidays');
    return saved ? JSON.parse(saved) : [];
  });

  const [workdays, setWorkdays] = useState(() => {
    const saved = localStorage.getItem('gantt-workdays');
    return saved ? JSON.parse(saved) : [];
  });

  // Save cell width to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-width', cellWidth.toString());
  }, [cellWidth]);

  // Save cell height to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-cell-height', cellHeight.toString());
  }, [cellHeight]);

  // Save holidays to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-holidays', JSON.stringify(holidays));
  }, [holidays]);

  // Save workdays to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-workdays', JSON.stringify(workdays));
  }, [workdays]);

  // Load all configs for project switcher
  useEffect(() => {
    const allConfigs = gitlabConfigManager.getAllConfigs();
    setConfigs(allConfigs);
  }, []);

  // Initialize provider when config changes
  const handleConfigChange = useCallback((config) => {
    setCurrentConfig(config);

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

  // Use sync hook
  const {
    tasks: allTasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    deleteTask,
    createLink,
    deleteLink,
  } = useGitLabSync(provider, autoSync);

  // Ref to store fold state before data updates
  const openStateRef = useRef(new Map());

  // Wrapped sync function that preserves fold state
  const syncWithFoldState = useCallback(
    async (options) => {
      // Save fold state before sync
      if (api) {
        try {
          const state = api.getState();
          const currentTasks = state.tasks || [];
          const newOpenState = new Map();

          currentTasks.forEach((task) => {
            if (task.open !== undefined) {
              newOpenState.set(task.id, task.open);
            }
          });

          openStateRef.current = newOpenState;
          console.log('[GitLabGantt] Saved fold state before sync:', {
            count: newOpenState.size,
            states: Array.from(newOpenState.entries()),
          });
        } catch (error) {
          console.error('[GitLabGantt] Failed to save fold state:', error);
        }
      }

      // Call original sync
      await sync(options);
    },
    [api, sync]
  );

  // Update ref when allTasks changes
  useEffect(() => {
    allTasksRef.current = allTasks;

    // Restore fold state after tasks update
    if (api && allTasks.length > 0) {
      // Small delay to ensure Gantt has processed the new tasks
      setTimeout(() => {
        try {
          const state = api.getState();
          const currentTasks = state.tasks || [];

          console.log('[GitLabGantt] Restoring fold state:', {
            savedStates: openStateRef.current.size,
            currentTasks: currentTasks.length,
          });

          // Restore open state from saved map
          currentTasks.forEach((task) => {
            if (openStateRef.current.has(task.id)) {
              const savedOpen = openStateRef.current.get(task.id);
              if (task.open !== savedOpen) {
                console.log(
                  `[GitLabGantt] Restoring fold state for task ${task.id}:`,
                  savedOpen
                );
                api.exec('open-task', { id: task.id, mode: savedOpen });
              }
            }
          });
        } catch (error) {
          console.error('[GitLabGantt] Failed to restore fold state:', error);
        }
      }, 100);
    }
  }, [allTasks, api]);

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return GitLabFilters.applyFilters(allTasks, filterOptions);
  }, [allTasks, filterOptions]);

  // Calculate statistics
  const stats = useMemo(() => {
    return GitLabFilters.calculateStats(filteredTasks);
  }, [filteredTasks]);

  // Fixed date range for timeline: 1 month before today, 1 year after today
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear() + 1, now.getMonth(), 0);

    console.log('[GitLab] Timeline range:', start, 'to', end);

    return { start, end };
  }, []); // Empty deps - only calculate once on mount

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

  // Initialize Gantt API
  const init = useCallback(
    (ganttApi) => {
      setApi(ganttApi);
      // Expose API to window for debugging
      window.ganttApi = ganttApi;

      // Helper function to inspect tasks
      window.debugTasks = () => {
        try {
          const state = ganttApi.getState();
          const allTasks = state.tasks || [];
          console.log('=== All Tasks in Gantt ===');
          console.log('Total tasks:', allTasks.length);
          console.log('State structure:', Object.keys(state));

          allTasks.forEach(t => {
            console.log(`Task ${t.id}: "${t.text}"`, {
              start: t.start,
              end: t.end,
              base_start: t.base_start,
              base_end: t.base_end,
              parent: t.parent,
              hasBaseline: !!(t.base_start && t.base_end)
            });
          });

          return allTasks;
        } catch (error) {
          console.error('Error in debugTasks:', error);
          console.log('Trying alternative method...');

          // Try alternative method
          const state = ganttApi.getState();
          console.log('Full state:', state);
          return state;
        }
      };

      // Helper function to find a specific task
      window.findTask = (id) => {
        try {
          const state = ganttApi.getState();
          const allTasks = state.tasks || [];
          const task = allTasks.find(t => t.id == id);

          if (task) {
            console.log(`Found task ${id}:`, task);
          } else {
            console.log(`Task ${id} not found. Available IDs:`, allTasks.map(t => t.id));
          }

          return task;
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

          console.log('[GitLab] Auto-scroll attempt', attempt, {
            today: today.toISOString(),
            start: start ? start.toISOString() : 'undefined',
            cellWidth,
            hasScales: scales.length > 0
          });

          if (start) {
            // Calculate days from timeline start to today
            const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const scrollLeft = Math.max(0, daysDiff * cellWidth);

            console.log('[GitLab] Scrolling to:', { daysDiff, scrollLeft });

            // Use scroll-chart command to set scroll position
            ganttApi.exec('scroll-chart', { left: scrollLeft });
            console.log('[GitLab] Scroll command executed successfully');
            return true;
          }

          return false;
        } catch (error) {
          console.warn('[GitLab] Scroll attempt', attempt, 'failed:', error);
          return false;
        }
      };

      // Try immediately, then retry if needed
      if (!attemptScroll(1)) {
        setTimeout(() => attemptScroll(2), 100);
      }

      // Track editor open
      ganttApi.on('open-editor', (ev) => {
        isEditorOpenRef.current = true;
        currentEditingTaskRef.current = ev.id;
        pendingEditorChangesRef.current.clear(); // Clear previous changes
        console.log('[GitLab] Editor opened for task:', ev.id);

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
          console.log('[GitLab] Save button clicked');

          // Sync pending changes
          const taskId = currentEditingTaskRef.current;
          const changes = pendingEditorChangesRef.current.get(taskId);

          if (changes && Object.keys(changes).length > 0) {
            try {
              await syncTask(taskId, changes);
              pendingEditorChangesRef.current.clear();
              console.log('[GitLab] Changes saved successfully');

              // Refresh from GitLab to update local state
              await syncWithFoldState();

              // Close editor after successful save
              ganttApi.exec('close-editor');
            } catch (error) {
              console.error('Failed to sync task:', error);
              alert(`Failed to save changes: ${error.message}`);
            }
          } else {
            // No changes, just close
            ganttApi.exec('close-editor');
          }
        } else if (ev.action === 'close') {
          console.log('[GitLab] Close button clicked');

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
        console.log('[GitLab] Editor closed');
      });


      // Listen to update-task AFTER the update completes
      // Using 'on' instead of 'intercept' to get final values after drag
      ganttApi.on('update-task', (ev) => {
        // Skip milestone summary tasks
        if (ev.task._gitlab?.type === 'milestone') {
          return;
        }

        // Handle temporary IDs
        const isTempId = typeof ev.id === 'string' && ev.id.startsWith('temp');

        // Check if this is an ID update (replacing temp ID with real ID)
        const isIdUpdate = ev.task.id !== undefined && ev.task.id !== ev.id;

        // Skip temporary IDs UNLESS:
        // 1. We're updating the ID (temp -> real)
        // 2. Or skipSync is true (internal update)
        if (isTempId && !isIdUpdate && !ev.skipSync) {
          console.log('Skipping update for temporary task:', ev.id);
          return;
        }

        // If this is an ID update for temp task, allow it but don't sync to GitLab
        if (isTempId && isIdUpdate) {
          console.log('[GitLab] Replacing temporary task ID:', ev.id, '→', ev.task.id);
          // Don't sync this to GitLab, and don't process parent baseline updates
          return;
        }

        console.log('[GitLab] update-task event (after):', {
          id: ev.id,
          task: ev.task,
          taskText: ev.task.text,
          taskDetails: ev.task.details,
          taskStart: ev.task.start,
          taskEnd: ev.task.end,
          isEditorOpen: isEditorOpenRef.current,
        });

        // If this task has a parent and dates changed, update parent's baseline
        if (!ev.skipBaselineDrag && (ev.task.start !== undefined || ev.task.end !== undefined)) {
          const currentTask = ganttApi.getTask(ev.id);
          console.log('[GitLab] Checking if should update parent baseline:', {
            skipBaselineDrag: ev.skipBaselineDrag,
            hasParent: currentTask.parent && currentTask.parent !== 0,
            parent: currentTask.parent,
          });

          if (currentTask.parent && currentTask.parent !== 0) {
            // Get all siblings from ganttApi to ensure we have the latest data
            const allTasks = allTasksRef.current;
            const siblingIds = allTasks.filter(t => t && t.parent === currentTask.parent).map(t => t.id);

            console.log('[GitLab] Found sibling IDs for parent:', currentTask.parent, 'count:', siblingIds.length, 'IDs:', siblingIds);

            if (siblingIds.length > 0) {
              // Get fresh data from ganttApi for each sibling
              const siblings = siblingIds.map(id => ganttApi.getTask(id)).filter(t => t);

              const childStarts = siblings.map(c => c.start).filter(s => s !== undefined);
              const childEnds = siblings.map(c => c.end).filter(e => e !== undefined);

              console.log('[GitLab] Child dates from ganttApi:', {
                childStarts: childStarts.map(d => d.toISOString()),
                childEnds: childEnds.map(d => d.toISOString())
              });

              if (childStarts.length > 0 && childEnds.length > 0) {
                const spanStart = new Date(Math.min(...childStarts.map(d => d.getTime())));
                const spanEnd = new Date(Math.max(...childEnds.map(d => d.getTime())));

                console.log('[GitLab] Updating parent baseline:', {
                  parentId: currentTask.parent,
                  spanStart: spanStart.toISOString(),
                  spanEnd: spanEnd.toISOString(),
                });

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

        // Determine if this is a visual change (dates, progress) or text change
        const hasDateOrProgressChange =
          ev.task.start !== undefined ||
          ev.task.end !== undefined ||
          ev.task.duration !== undefined ||
          ev.task.progress !== undefined;

        const hasTextChange =
          ev.task.text !== undefined ||
          ev.task.details !== undefined;

        if (isEditorOpenRef.current && hasTextChange && !hasDateOrProgressChange) {
          // Editor is open and ONLY text fields changed - save for later
          if (!pendingEditorChangesRef.current.has(ev.id)) {
            pendingEditorChangesRef.current.set(ev.id, {});
          }
          Object.assign(pendingEditorChangesRef.current.get(ev.id), ev.task);
          console.log('[GitLab] Buffering editor changes for task:', ev.id, ev.task);
        } else if (hasDateOrProgressChange || !isEditorOpenRef.current) {
          // Date/progress changes OR changes outside editor
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
          if (ev.task.progress !== undefined) {
            taskChanges.progress = ev.task.progress;
          }

          // Sync to GitLab without updating React state (to avoid re-render conflicts)
          (async () => {
            try {
              await syncTask(ev.id, taskChanges);
            } catch (error) {
              console.error('Failed to sync task update:', error);
              alert(`Failed to sync task: ${error.message}`);
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
          if (parentTask && parentTask.parent && parentTask.parent !== 0) {
            alert('Cannot create subtasks under a subtask. Only two levels are allowed.');
            return false;
          }
        }

        // Show dialog to input task details before creating
        const title = prompt('Enter task title:', ev.task.text || 'New Task');
        if (!title) {
          return false; // User cancelled
        }

        // Update the task with user input
        ev.task.text = title;

        // Optionally ask for description
        const description = prompt('Enter task description (optional):');
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
          // Create task in GitLab
          // This will also add it to React state (in useGitLabSync)
          const newTask = await createTask(ev.task);

          console.log('[GitLab] Task created from GitLab:', {
            tempId: ev.id,
            newId: newTask.id,
            newTask,
          });

          // Strategy: Delete temp task, let React state drive the update
          // The new task was already added to state by createTask()
          // Gantt will receive it via the tasks prop and display it

          // Delete the temporary task (with baseline)
          ganttApi.exec('delete-task', {
            id: ev.id,
            skipHandler: true, // Don't trigger delete handler
          });

          console.log('[GitLab] Temporary task deleted, waiting for React state to update Gantt with real task');
        } catch (error) {
          console.error('Failed to create task:', error);
          alert(`Failed to create task: ${error.message}`);
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
        const taskTitle = task ? task.text : `Task ${ev.id}`;

        // Ask for confirmation
        const confirmed = confirm(
          `Are you sure you want to delete "${taskTitle}"?\n\nThis will permanently delete the task from GitLab.`
        );

        return confirmed;
      });

      // Handle task deletion after confirmation
      ganttApi.on('delete-task', async (ev) => {
        // Skip if this is an internal deletion (e.g., removing temp task)
        if (ev.skipHandler) {
          return;
        }

        try {
          await deleteTask(ev.id);
        } catch (error) {
          console.error('Failed to delete task:', error);
          alert(`Failed to delete task: ${error.message}`);
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

        const movedTask = ganttApi.getTask(ev.id);
        const parentId = movedTask.parent || 0;

        // Get all tasks with the same parent, sorted by current display order
        const allTasks = allTasksRef.current;
        let siblings = allTasks.filter(t => t && (t.parent || 0) === parentId);

        // Sort by existing order (if available), otherwise by ID
        siblings.sort((a, b) => {
          const orderA = a.$custom?.displayOrder;
          const orderB = b.$custom?.displayOrder;
          if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
          if (orderA !== undefined) return -1;
          if (orderB !== undefined) return 1;
          return a.id - b.id;
        });

        // Find target position
        const targetTask = siblings.find(t => t.id === ev.target);
        if (!targetTask) {
          console.error('[GitLab] Target task not found:', ev.target);
          return;
        }

        const targetOrder = targetTask.$custom?.displayOrder;
        const targetIndex = siblings.findIndex(t => t.id === ev.target);

        // Calculate new order for moved task
        let newOrder;
        let needsReindex = false;
        const ORDER_GAP = 10; // Default gap between orders

        if (ev.mode === 'before') {
          // Insert before target
          const prevTask = targetIndex > 0 ? siblings[targetIndex - 1] : null;
          const prevOrder = prevTask?.$custom?.displayOrder;

          if (prevOrder !== undefined && targetOrder !== undefined) {
            // Try to insert between prevOrder and targetOrder
            if (targetOrder - prevOrder > 1) {
              newOrder = Math.floor((prevOrder + targetOrder) / 2);
            } else {
              // Not enough space, need to reindex
              needsReindex = true;
            }
          } else if (targetOrder !== undefined) {
            // No previous task, insert before target
            newOrder = Math.max(0, targetOrder - ORDER_GAP);
          } else {
            // No order info, need to reindex
            needsReindex = true;
          }
        } else if (ev.mode === 'after') {
          // Insert after target
          const nextTask = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : null;
          const nextOrder = nextTask?.$custom?.displayOrder;

          if (targetOrder !== undefined && nextOrder !== undefined) {
            // Try to insert between targetOrder and nextOrder
            if (nextOrder - targetOrder > 1) {
              newOrder = Math.floor((targetOrder + nextOrder) / 2);
            } else {
              // Not enough space, need to reindex
              needsReindex = true;
            }
          } else if (targetOrder !== undefined) {
            // No next task, insert after target
            newOrder = targetOrder + ORDER_GAP;
          } else {
            // No order info, need to reindex
            needsReindex = true;
          }
        }

        try {
          if (needsReindex) {
            // Reindex all siblings with ORDER_GAP spacing
            console.log('[GitLab] Need to reindex all siblings');

            // Remove moved task and insert at new position
            siblings = siblings.filter(t => t.id !== ev.id);
            if (ev.mode === 'before') {
              siblings.splice(targetIndex, 0, movedTask);
            } else {
              siblings.splice(targetIndex + 1, 0, movedTask);
            }

            const tasksToUpdate = siblings.map((sibling, i) => ({
              id: sibling.id,
              order: i * ORDER_GAP
            }));

            await provider.updateTasksOrder(tasksToUpdate);
            console.log('[GitLab] Reindexed all tasks:', Object.fromEntries(tasksToUpdate.map(t => [t.id, t.order])));
          } else {
            // Only update the moved task
            console.log(`[GitLab] Inserting task ${ev.id} with order ${newOrder}`);
            await provider.updateTasksOrder([{ id: ev.id, order: newOrder }]);
            console.log('[GitLab] Order saved:', {[ev.id]: newOrder});
          }
        } catch (error) {
          console.error('Failed to update task order:', error);
        }
      });

      // Handle link creation
      ganttApi.on('add-link', async (ev) => {
        try {
          await createLink(ev.link);
        } catch (error) {
          console.error('Failed to create link:', error);
          alert(`Failed to create link: ${error.message}`);
          ganttApi.exec('delete-link', { id: ev.id });
        }
      });

      // Handle link deletion
      ganttApi.on('delete-link', async (ev) => {
        try {
          const link = links.find((l) => l.id === ev.id);
          if (link) {
            await deleteLink(ev.id, link.source);
          }
        } catch (error) {
          console.error('Failed to delete link:', error);
          alert(`Failed to delete link: ${error.message}`);
          syncWithFoldState();
        }
      });
    },
    [syncTask, createTask, deleteTask, createLink, deleteLink, links, syncWithFoldState]
  );

  // Today marker - ensure correct date without timezone issues
  const markers = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log('[GitLab] Today marker date:', today, 'Month:', today.getMonth() + 1, 'Date:', today.getDate());
    return [
      {
        start: today,  // IMarker uses 'start' not 'date'
        css: 'today-marker',
      },
    ];
  }, []);

  // Helper function to normalize date string to YYYY-MM-DD format
  const normalizeDateString = useCallback((dateStr) => {
    // Trim whitespace
    dateStr = dateStr.trim();

    // Support both YYYY-MM-DD and YYYY/M/D formats
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return dateStr; // Already in YYYY-MM-DD format
  }, []);

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = useCallback((date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Working days and holidays calculation
  const isWeekend = useCallback((date) => {
    const day = date.getDay();
    const dateStr = formatLocalDate(date);

    // Check if this weekend day is marked as a workday
    const isMarkedWorkday = workdays.some(wd => normalizeDateString(wd) === dateStr);
    if (isMarkedWorkday) {
      return false; // It's a workday despite being weekend
    }

    return day === 0 || day === 6; // Sunday or Saturday
  }, [workdays, normalizeDateString, formatLocalDate]);

  const isHoliday = useCallback((date) => {
    const dateStr = formatLocalDate(date);
    return holidays.some(holiday => normalizeDateString(holiday) === dateStr);
  }, [holidays, normalizeDateString, formatLocalDate]);

  const highlightTime = useCallback((date, unit) => {
    if (unit === 'day' && (isWeekend(date) || isHoliday(date))) {
      return 'wx-weekend';
    }
    return '';
  }, [isWeekend, isHoliday]);

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

  // Simplified columns configuration - just the essentials
  const columns = useMemo(() => {
    return [
      {
        id: 'text',
        header: 'Task Title',
        width: 250,
      },
      {
        id: 'start',
        header: 'Start',
        width: 110,
        cell: DateCell,
      },
      {
        id: 'end',
        header: 'Due',
        width: 110,
        cell: DateCell,
      },
      {
        id: 'progress',
        header: 'Progress',
        width: 80,
      },
      {
        id: 'add-task',
        header: '',
        width: 50,
      },
    ];
  }, [DateCell]);

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
            ⚙️
          </button>
        </div>

        <div className="view-controls">
          <label className="control-label">
            Width:
            <input
              type="range"
              min="20"
              max="100"
              value={cellWidth}
              onChange={(e) => setCellWidth(Number(e.target.value))}
              className="slider"
            />
            <span className="control-value">{cellWidth}</span>
          </label>
          <label className="control-label">
            Height:
            <input
              type="range"
              min="20"
              max="60"
              value={cellHeight}
              onChange={(e) => setCellHeight(Number(e.target.value))}
              className="slider"
            />
            <span className="control-value">{cellHeight}</span>
          </label>
        </div>

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

      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)} className="btn-close-modal">
                &times;
              </button>
            </div>

            <div className="settings-section">
              <h4>GitLab Project</h4>
              <ProjectSelector
                onProjectChange={(config) => {
                  handleConfigChange(config);
                  setShowSettings(false);
                }}
                currentConfigId={currentConfig?.id}
              />
            </div>

            <div className="settings-section">
              <h4>Holidays</h4>
              <p className="settings-hint">Add holiday dates (one per line, formats: YYYY-MM-DD or YYYY/M/D)</p>
              <textarea
                value={holidays.join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n');
                  setHolidays(lines);
                }}
                onBlur={(e) => {
                  // Clean up empty lines when user finishes editing
                  const lines = e.target.value.split('\n').filter(line => line.trim());
                  setHolidays(lines);
                }}
                placeholder="2025-01-01&#10;2025/2/28&#10;2025-12-25"
                className="holidays-textarea"
                rows={6}
              />
              <div className="holiday-presets">
                <button
                  onClick={() => setHolidays([])}
                  className="preset-btn preset-btn-clear"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h4>Extra Working Days</h4>
              <p className="settings-hint">Add extra working days on weekends (one per line, formats: YYYY-MM-DD or YYYY/M/D)</p>
              <textarea
                value={workdays.join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n');
                  setWorkdays(lines);
                }}
                onBlur={(e) => {
                  // Clean up empty lines when user finishes editing
                  const lines = e.target.value.split('\n').filter(line => line.trim());
                  setWorkdays(lines);
                }}
                placeholder="2025/1/25&#10;2025-02-08"
                className="holidays-textarea"
                rows={6}
              />
              <div className="holiday-presets">
                <button
                  onClick={() => setWorkdays([])}
                  className="preset-btn preset-btn-clear"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FilterPanel
        milestones={milestones}
        epics={epics}
        tasks={allTasks}
        onFilterChange={setFilterOptions}
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
        <Toolbar api={api} />
        <div className="gantt-chart-container">
          <ContextMenu api={api}>
            <Gantt
              init={init}
              tasks={filteredTasks}
              links={links}
              markers={markers}
              scales={[
                { unit: 'year', step: 1, format: 'yyyy' },
                { unit: 'month', step: 1, format: 'MMMM' },
                { unit: 'day', step: 1, format: 'd' },
              ]}
              start={dateRange.start}
              end={dateRange.end}
              columns={columns}
              cellWidth={cellWidth}
              cellHeight={cellHeight}
              highlightTime={highlightTime}
              readonly={false}
              baselines={true}
            />
          </ContextMenu>
        </div>
        {api && <Editor api={api} bottomBar={false} autoSave={false} />}
      </div>

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
          gap: 16px;
          padding: 12px 16px;
          background: #fff;
          border-bottom: 1px solid #ddd;
          flex-wrap: wrap;
        }

        .project-switcher {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .view-controls {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 4px 12px;
          background: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .control-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #666;
          white-space: nowrap;
        }

        .slider {
          width: 80px;
          height: 4px;
          cursor: pointer;
        }

        .control-value {
          min-width: 30px;
          text-align: right;
          font-weight: 600;
          color: #333;
        }

        .project-select-compact {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          min-width: 200px;
        }

        .btn-settings {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }

        .btn-settings:hover {
          background: #f5f5f5;
        }

        .settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .settings-modal-content {
          background: white;
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
          border-bottom: 1px solid #ddd;
          background: #f8f9fa;
        }

        .settings-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .settings-section {
          padding: 20px;
          border-bottom: 1px solid #eee;
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .settings-hint {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #666;
        }

        .holidays-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
          resize: vertical;
          box-sizing: border-box;
        }

        .holidays-textarea:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .holiday-presets {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .preset-btn {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .preset-btn:hover {
          background: #f5f5f5;
          border-color: #999;
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
          color: #666;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
        }

        .btn-close-modal:hover {
          color: #333;
        }

        /* Today marker styling - MUCH more prominent */
        .today-marker {
          position: relative;
          border-left: 4px solid #FF0000 !important;
          background: transparent !important;
          z-index: 100 !important;
          box-shadow: none !important;
          min-height: 100% !important;
        }

        .today-marker .wx-marker-label {
          display: none !important;
        }

        .stats-panel {
          display: flex;
          gap: 16px;
          margin-left: auto;
          font-size: 13px;
        }

        .stat-item {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .stat-label {
          color: #666;
          font-weight: 500;
        }

        .stat-value {
          font-weight: 600;
          color: #333;
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

        /* Parent task bar z-index (color is controlled by theme CSS via .wx-summary) */
        .wx-bar.wx-parent-task {
          z-index: 2 !important;
        }
      `}</style>
    </div>
  );
}
