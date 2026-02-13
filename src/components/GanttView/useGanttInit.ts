// @ts-nocheck
/**
 * useGanttInit Hook
 * Extracts the entire init() callback from GanttView.
 * Registers all Gantt API event handlers: editor, drag, workdays preservation,
 * add/delete/move task, link handlers, cascade move, and split task.
 */

import { useCallback } from 'react';
import {
  formatDateToLocalString,
  createStartDate,
  createEndDate,
} from '../../utils/dateUtils.js';
import {
  findLinkBySourceTarget,
  validateLinkMetadata,
} from '../../utils/LinkUtils';
import { getTasksFromState, getChildrenForTask } from './ganttTaskUtils.ts';

/**
 * @param {Object} deps - All dependencies needed by the init callback
 * @returns {Function} init callback to pass to <Gantt init={...} />
 */
export function useGanttInit({
  // State setters
  setApi,
  setDiscardChangesDialogOpen,
  setCreateItemDialogType,
  setCreateItemDialogContext,
  setCreateItemDialogOpen,
  setDeleteDialogItems,
  setDeleteDialogOpen,
  // Refs
  allTasksRef,
  linksRef,
  pendingEditorChangesRef,
  isEditorOpenRef,
  currentEditingTaskRef,
  pendingAddTaskContextRef,
  pendingDeleteTaskIdsRef,
  ganttContainerRef,
  countWorkdaysRef,
  calculateEndDateByWorkdaysRef,
  // Data operations
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
  // Fold state
  registerFoldHandlers,
}) {
  const init = useCallback(
    (ganttApi) => {
      try {
        setApi(ganttApi);
      } catch (error) {
        console.error('[init] ERROR in setApi:', error);
        console.error('[init] ERROR stack:', error.stack);
        throw error;
      }

      // === Auto-scroll to today ===
      setupAutoScroll(ganttApi);

      // === Fold handlers (open-task listener) ===
      registerFoldHandlers(ganttApi);

      // === Editor handlers ===
      registerEditorHandlers(ganttApi, {
        isEditorOpenRef,
        currentEditingTaskRef,
        pendingEditorChangesRef,
        ganttContainerRef,
        setDiscardChangesDialogOpen,
        syncTask,
        sync,
        showToast,
      });

      // === Split task handler ===
      registerSplitTask(ganttApi, { showToast });

      // === Workdays preservation on drag ===
      const workdaysState = new Map();
      registerWorkdaysPreservation(ganttApi, {
        workdaysState,
        countWorkdaysRef,
        calculateEndDateByWorkdaysRef,
      });

      // === Update task sync ===
      registerUpdateTaskSync(ganttApi, {
        workdaysState,
        allTasksRef,
        isEditorOpenRef,
        pendingEditorChangesRef,
        syncTask,
        sync,
        showToast,
      });

      // === Add task intercept + handler ===
      registerAddTask(ganttApi, {
        pendingAddTaskContextRef,
        setCreateItemDialogType,
        setCreateItemDialogContext,
        setCreateItemDialogOpen,
        createTask,
        sync,
        showToast,
      });

      // === Delete task intercept + handler ===
      const pendingDeletes = new Map();
      registerDeleteTask(ganttApi, {
        allTasksRef,
        pendingDeleteTaskIdsRef,
        pendingDeletes,
        setDeleteDialogItems,
        setDeleteDialogOpen,
        deleteTask,
        sync,
        showToast,
      });

      // === Move task handler ===
      registerMoveTask(ganttApi, {
        allTasksRef,
        provider,
        showToast,
      });

      // === Link handlers ===
      registerLinkHandlers(ganttApi, {
        linksRef,
        createLink,
        deleteLink,
        sync,
        showToast,
      });

      // === Cascade move handler ===
      registerCascadeMove(ganttApi, {
        links,
        countWorkdaysRef,
        calculateEndDateByWorkdaysRef,
        syncTask,
        sync,
        showToast,
      });
    },
    // Note: countWorkdays/calculateEndDateByWorkdays not needed here as we use refs
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
      registerFoldHandlers,
    ],
  );

  return init;
}

// ============================================================================
// Sub-functions (named for readability, called only from init)
// ============================================================================

function setupAutoScroll(ganttApi) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const attemptScroll = (_attempt = 1) => {
    try {
      const state = ganttApi.getState();
      const cellWidth = state.cellWidth || 40;
      const start = state.start;

      if (start) {
        const daysDiff = Math.floor(
          (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
        const scrollLeft = Math.max(0, daysDiff * cellWidth);
        ganttApi.exec('scroll-chart', { left: scrollLeft });
        return true;
      }
      return false;
    } catch (_scrollError) {
      return false;
    }
  };

  if (!attemptScroll(1)) {
    setTimeout(() => attemptScroll(2), 100);
  }
}

function registerEditorHandlers(ganttApi, deps) {
  const {
    isEditorOpenRef,
    currentEditingTaskRef,
    pendingEditorChangesRef,
    ganttContainerRef,
    setDiscardChangesDialogOpen,
    syncTask,
    sync,
    showToast,
  } = deps;

  // Track editor open
  ganttApi.on('open-editor', (ev) => {
    isEditorOpenRef.current = true;
    currentEditingTaskRef.current = ev.id;
    pendingEditorChangesRef.current.clear();

    // Disable browser extensions (like Grammarly) on editor inputs
    setTimeout(() => {
      const container = ganttContainerRef.current;
      if (!container) return;
      const editorInputs = container.querySelectorAll(
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
      const taskId = currentEditingTaskRef.current;
      const changes = pendingEditorChangesRef.current.get(taskId);

      if (changes && Object.keys(changes).length > 0) {
        try {
          const currentTask = ganttApi.getTask(taskId);
          if (currentTask?._source) {
            changes._source = currentTask._source;
          }

          await syncTask(taskId, changes);
          pendingEditorChangesRef.current.clear();
          await sync();
          ganttApi.exec('close-editor');
        } catch (error) {
          console.error('Failed to sync task:', error);
          showToast(`Failed to save changes: ${error.message}`, 'error');
        }
      } else {
        ganttApi.exec('close-editor');
      }
    } else if (ev.action === 'close') {
      const taskId = currentEditingTaskRef.current;
      const changes = pendingEditorChangesRef.current.get(taskId);

      if (changes && Object.keys(changes).length > 0) {
        setDiscardChangesDialogOpen(true);
      } else {
        ganttApi.exec('close-editor');
      }
    }
  });

  // Track editor close
  ganttApi.on('close-editor', () => {
    isEditorOpenRef.current = false;
    currentEditingTaskRef.current = null;
  });
}

function registerSplitTask(ganttApi, deps) {
  const { showToast } = deps;

  ganttApi.on('split-task', (ev) => {
    const { id, splitDate } = ev;
    if (!id) return;

    const task = ganttApi.getTask(id);
    if (!task || !task.start || !task.end) return;

    const actualSplitDate =
      splitDate ||
      new Date(
        task.start.getTime() +
          (task.end.getTime() - task.start.getTime()) / 2,
      );

    if (actualSplitDate <= task.start || actualSplitDate >= task.end) {
      showToast('Split date must be within task duration', 'error');
      return;
    }

    const splitParts = [
      { start: task.start, end: actualSplitDate },
      { start: actualSplitDate, end: task.end },
    ];

    ganttApi.exec('update-task', {
      id,
      task: { splitParts },
      skipSync: true,
    });
  });
}

function registerWorkdaysPreservation(ganttApi, deps) {
  const { workdaysState, countWorkdaysRef, calculateEndDateByWorkdaysRef } =
    deps;

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
   *
   * State tracking:
   * - workdaysState.originalWorkdays: Captured before drag completes
   * - workdaysState.correctionSynced: True after correction update is sent to provider
   */

  // Phase 1: Capture original workdays before Gantt updates the task
  ganttApi.intercept('update-task', (ev) => {
    if (ev.skipWorkdaysAdjust) {
      return true;
    }

    if (ev.mode === 'move' && ev.diff) {
      const task = ganttApi.getTask(ev.id);
      const originalStart = task.start;
      const originalEnd = task.end;

      if (originalStart && originalEnd) {
        const originalWorkdays = countWorkdaysRef.current(
          originalStart,
          originalEnd,
        );

        if (originalWorkdays > 0) {
          workdaysState.set(ev.id, {
            originalWorkdays,
            correctionSynced: false,
          });
        }
      }
    }

    return true;
  });

  // Phase 2: After Gantt updates, calculate and apply end date correction
  ganttApi.on('update-task', (ev) => {
    if (ev.skipWorkdaysAdjust) {
      return;
    }

    const state = workdaysState.get(ev.id);

    if (state && state.originalWorkdays && !state.correctionSynced) {
      const task = ganttApi.getTask(ev.id);
      if (!task || !task.start) return;

      const adjustedEnd = calculateEndDateByWorkdaysRef.current(
        task.start,
        state.originalWorkdays,
      );

      if (task.end.getTime() !== adjustedEnd.getTime()) {
        ganttApi.exec('update-task', {
          id: ev.id,
          task: { end: adjustedEnd },
          skipWorkdaysAdjust: true,
        });
      } else {
        workdaysState.delete(ev.id);
      }
    }
  });
}

function registerUpdateTaskSync(ganttApi, deps) {
  const {
    workdaysState,
    allTasksRef,
    isEditorOpenRef,
    pendingEditorChangesRef,
    syncTask,
    sync,
    showToast,
  } = deps;

  // Phase 3: provider sync handler - skip stale events, only sync correction
  ganttApi.on('update-task', (ev) => {
    const state = workdaysState.get(ev.id);

    if (state) {
      if (ev.skipWorkdaysAdjust) {
        state.correctionSynced = true;
        setTimeout(() => workdaysState.delete(ev.id), 0);
      } else if (!state.correctionSynced) {
        return;
      } else {
        return;
      }
    }

    // Handle temporary IDs
    const isTempId = typeof ev.id === 'string' && ev.id.startsWith('temp');
    const isIdUpdate = ev.task.id !== undefined && ev.task.id !== ev.id;

    if (isTempId && !isIdUpdate && !ev.skipSync) {
      return;
    }

    if (isTempId && isIdUpdate) {
      return;
    }

    // If this task has a parent and dates changed, update parent's baseline
    if (
      !ev.skipBaselineDrag &&
      (ev.task.start !== undefined || ev.task.end !== undefined)
    ) {
      const currentTask = ganttApi.getTask(ev.id);

      if (currentTask.parent && currentTask.parent !== 0) {
        const allTasks = allTasksRef.current;
        const siblingIds = allTasks
          .filter((t) => t && t.parent === currentTask.parent)
          .map((t) => t.id);

        if (siblingIds.length > 0) {
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

            ganttApi.exec('update-task', {
              id: currentTask.parent,
              task: {
                base_start: spanStart,
                base_end: spanEnd,
              },
              skipBaselineDrag: true,
              skipSync: true,
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
      ev.task.text !== undefined || ev.task.details !== undefined;

    if (isEditorOpenRef.current && hasTextChange && !hasDateChange) {
      // Editor is open and ONLY text fields changed - save for later
      if (!pendingEditorChangesRef.current.has(ev.id)) {
        pendingEditorChangesRef.current.set(ev.id, {});
      }
      Object.assign(pendingEditorChangesRef.current.get(ev.id), ev.task);
    } else if (hasDateChange || !isEditorOpenRef.current) {
      // Date changes OR changes outside editor
      const currentTask = ganttApi.getTask(ev.id);
      const taskChanges = {};

      if (currentTask._source) {
        taskChanges._source = currentTask._source;
      }

      // Text fields
      if (ev.task.text !== undefined) {
        taskChanges.text = ev.task.text;
      }
      if (ev.task.details !== undefined) {
        taskChanges.details = ev.task.details;
      }

      // Date fields - support null values for clearing dates
      // Sources of date changes:
      // 1. Editor: ev._originalDateValues contains user-set values (Date or null)
      // 2. Grid: ev._originalDateChange contains the single changed field
      // 3. Timeline drag: ev.task contains the new values directly

      const isFromEditor =
        ev._originalDateValues &&
        Object.keys(ev._originalDateValues).length > 0;
      const isFromGrid = !!ev._originalDateChange;

      let startValue, endValue;
      let hasStartChange = false,
        hasEndChange = false;

      if (isFromEditor) {
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
          Object.prototype.hasOwnProperty.call(ev._originalDateValues, 'end')
        ) {
          endValue = ev._originalDateValues.end;
          hasEndChange = true;
        }
      } else if (isFromGrid) {
        if (ev._originalDateChange.column === 'start') {
          startValue = ev._originalDateChange.value;
          hasStartChange = true;
        } else if (ev._originalDateChange.column === 'end') {
          endValue = ev._originalDateChange.value;
          hasEndChange = true;
        }
      } else {
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
        taskChanges.start = normalizedStart;
        ev.task.start = normalizedStart;
        if (!taskChanges._source)
          taskChanges._source = { ...currentTask._source };
        taskChanges._source.startDate = formatDateToLocalString(startValue);
      }

      // Process end date - normalize to 23:59:59 local time
      if (hasEndChange) {
        const normalizedEnd = createEndDate(endValue);
        taskChanges.end = normalizedEnd;
        ev.task.end = normalizedEnd;
        if (!taskChanges._source)
          taskChanges._source = { ...currentTask._source };
        taskChanges._source.dueDate = formatDateToLocalString(endValue);
      }

      if (ev.task.duration !== undefined) {
        taskChanges.duration = ev.task.duration;
      }

      // Update ev.task._source so Grid cells (DateEditCell) show updated values
      if (taskChanges._source) {
        ev.task._source = taskChanges._source;
      }

      // Check if any date was cleared (set to null)
      const hasDateCleared =
        (hasStartChange && startValue === null) ||
        (hasEndChange && endValue === null);

      (async () => {
        try {
          await syncTask(ev.id, taskChanges);

          // If a date was cleared, refresh from provider because svar Gantt
          // doesn't properly handle null dates (auto-fills via normalizeDates)
          if (hasDateCleared) {
            sync();
          }
        } catch (error) {
          console.error('Failed to sync task update:', error);
          showToast(`Failed to sync task: ${error.message}`, 'error');
          sync();
        }
      })();
    }
  });
}

function registerAddTask(ganttApi, deps) {
  const {
    pendingAddTaskContextRef,
    setCreateItemDialogType,
    setCreateItemDialogContext,
    setCreateItemDialogOpen,
    createTask,
    sync,
    showToast,
  } = deps;

  // Prevent creating subtasks under subtasks (third-level hierarchy)
  // and show dialog for new task creation
  ganttApi.intercept('add-task', (ev) => {
    if (ev.mode === 'child' && ev.target && ev.target !== 0) {
      const parentTask = ganttApi.getTask(ev.target);

      // Check if parent is a milestone
      if (parentTask && parentTask.$isMilestone) {
        const defaultTitle =
          ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

        pendingAddTaskContextRef.current = {
          baseTask: { ...ev.task, text: defaultTitle },
          parentTask,
          itemType: 'issue',
        };

        setCreateItemDialogType('issue');
        setCreateItemDialogContext({ parentMilestone: parentTask });
        setCreateItemDialogOpen(true);
        return false;
      }

      // Check if parent is a provider Task (subtask)
      const isParentTask =
        parentTask && !parentTask.$isIssue && !parentTask.$isMilestone;

      if (isParentTask) {
        showToast(
          'Cannot create subtasks under a provider Task. Only Issues can have Tasks as children.',
          'warning',
        );
        return false;
      }

      // Check if parent is an Issue
      const isParentIssue = parentTask && parentTask.$isIssue;

      if (isParentIssue) {
        const defaultTitle =
          ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

        pendingAddTaskContextRef.current = {
          baseTask: { ...ev.task, text: defaultTitle },
          parentTask,
          itemType: 'task',
        };

        setCreateItemDialogType('task');
        setCreateItemDialogContext({ parentTask });
        setCreateItemDialogOpen(true);
        return false;
      }
    }

    // Creating top-level issue (no parent) - show CreateItemDialog
    const defaultTitle =
      ev.task.text && ev.task.text !== 'New Task' ? ev.task.text : '';

    pendingAddTaskContextRef.current = {
      baseTask: { ...ev.task, text: defaultTitle },
      parentTask: null,
      itemType: 'issue',
    };

    setCreateItemDialogType('issue');
    setCreateItemDialogContext(null);
    setCreateItemDialogOpen(true);
    return false;
  });

  // Handle task creation
  ganttApi.on('add-task', async (ev) => {
    if (ev.skipHandler) {
      return;
    }

    try {
      // Save fold state BEFORE any operations that might change it
      const savedOpenState = new Map();
      try {
        const state = ganttApi.getState();
        const currentTasks = getTasksFromState(state);
        currentTasks.forEach((task) => {
          if (task.open !== undefined) {
            savedOpenState.set(task.id, task.open);
          }
        });
      } catch (error) {
        console.error('[GanttView] Failed to save fold state:', error);
      }

      // Check if this is an issue being created under a milestone
      if (ev.task._assignToMilestone) {
        ev.task.parent = 0;
        ev.task._source = {
          ...ev.task._source,
          milestoneGlobalId: ev.task._assignToMilestone,
        };
      }

      await createTask(ev.task);
      await sync();

      // Delete the temporary task (with baseline)
      ganttApi.exec('delete-task', {
        id: ev.id,
        skipHandler: true,
        skipProviderDelete: true,
      });

      // Restore fold state for parent tasks after adding new child
      if (savedOpenState.size > 0) {
        setTimeout(() => {
          savedOpenState.forEach((isOpen, taskId) => {
            if (isOpen) {
              try {
                const parentTask = ganttApi.getTask(taskId);
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
      ganttApi.exec('delete-task', {
        id: ev.id,
        skipHandler: true,
        skipProviderDelete: true,
      });
    }
  });
}

function registerDeleteTask(ganttApi, deps) {
  const {
    allTasksRef,
    pendingDeleteTaskIdsRef,
    pendingDeletes,
    setDeleteDialogItems,
    setDeleteDialogOpen,
    deleteTask,
    sync,
    showToast,
  } = deps;

  // Intercept task deletion to show delete dialog
  ganttApi.intercept('delete-task', (ev) => {
    if (ev.skipHandler) {
      return true;
    }

    const task = ganttApi.getTask(ev.id);
    const taskTitle = task ? task.text : `Item ${ev.id}`;

    let itemType = 'Issue';
    if (task?.$isMilestone || task?._source?.type === 'milestone') {
      itemType = 'Milestone';
    } else if (task?._source?.workItemType === 'Task') {
      itemType = 'Task';
    }

    // Get children for recursive delete option
    const children = getChildrenForTask(ev.id, allTasksRef.current);

    pendingDeleteTaskIdsRef.current = [
      ...pendingDeleteTaskIdsRef.current,
      ev.id,
    ];

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
            : child._source?.workItemType === 'Task'
              ? 'Task'
              : 'Issue',
        })),
      },
    ]);
    setDeleteDialogOpen(true);
    return false;
  });

  // Handle task deletion after confirmation
  ganttApi.on('delete-task', async (ev) => {
    if (ev.skipProviderDelete) {
      return;
    }

    try {
      let task = ganttApi.getTask(ev.id);

      if (!task?._source) {
        const taskFromRef = allTasksRef.current.find((t) => t.id === ev.id);
        if (taskFromRef?._source) {
          task = taskFromRef;
        }
      }

      // If this is a Milestone, wait for all its children to be deleted first
      if (task?._source?.type === 'milestone') {
        const childDeletePromises = [];
        for (const [childId, promise] of pendingDeletes.entries()) {
          const childTask = allTasksRef.current.find(
            (t) => t.id === childId,
          );
          if (childTask && childTask.parent === ev.id) {
            childDeletePromises.push(promise);
          }
        }

        if (childDeletePromises.length > 0) {
          console.log(
            `[GanttView] Waiting for ${childDeletePromises.length} child items to be deleted before milestone...`,
          );
          await Promise.allSettled(childDeletePromises);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

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
      sync();
    }
  });
}

function registerMoveTask(ganttApi, deps) {
  const { allTasksRef, provider, showToast } = deps;

  ganttApi.on('move-task', async (ev) => {
    if (ev.inProgress) {
      return;
    }

    const movedTask = ganttApi.getTask(ev.id);
    const targetTask = ganttApi.getTask(ev.target);

    if (movedTask._source?.type === 'milestone') {
      return;
    }

    const movedType =
      movedTask._source?.workItemType ||
      movedTask._source?.type ||
      'unknown';

    const parentId = movedTask.parent || 0;
    const allTasks = allTasksRef.current;
    let siblings = allTasks.filter(
      (t) => t && (t.parent || 0) === parentId,
    );

    siblings.sort((a, b) => {
      const orderA = a.$custom?.displayOrder;
      const orderB = b.$custom?.displayOrder;
      if (orderA !== undefined && orderB !== undefined)
        return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return String(a.id).localeCompare(String(b.id));
    });

    // Special case: When dragging to first position
    if (ev.id === ev.target) {
      const currentFirstTask = siblings.find((s) => s.id !== ev.id);

      if (currentFirstTask) {
        ev.target = currentFirstTask.id;
        ev.mode = 'before';
      } else {
        return;
      }
    }

    try {
      const finalTargetTask =
        ev.target !== targetTask.id
          ? ganttApi.getTask(ev.target)
          : targetTask;

      const movedIid = movedTask._source?.iid;
      const targetIid = finalTargetTask._source?.iid;

      if (!movedIid) {
        console.error(
          `[GanttView] Cannot reorder: moved task ${ev.id} has no source IID`,
        );
        return;
      }

      const finalTargetType =
        finalTargetTask._source?.workItemType ||
        finalTargetTask._source?.type ||
        'unknown';

      const targetIsMilestone =
        finalTargetTask.$isMilestone || finalTargetType === 'milestone';

      const typesIncompatible =
        targetIsMilestone || movedType !== finalTargetType;

      if (typesIncompatible) {
        const isMilestoneTarget =
          finalTargetTask.$isMilestone || finalTargetType === 'milestone';

        if (isMilestoneTarget) {
          const firstCompatibleIssue = siblings.find((s) => {
            if (s.id === ev.id) return false;
            const siblingType =
              s._source?.workItemType || s._source?.type || 'unknown';
            if (s.$isMilestone || siblingType === 'milestone') return false;
            return movedType === siblingType && s._source?.iid;
          });

          if (firstCompatibleIssue) {
            await provider.reorderWorkItem(
              movedIid,
              firstCompatibleIssue._source.iid,
              'before',
            );
          } else {
            console.error(
              `[GanttView] No compatible ${movedType} found to reorder relative to`,
            );
          }
          return;
        }

        const targetIndex = siblings.findIndex((s) => s.id === ev.target);

        let compatibleBefore = null;
        let compatibleAfter = null;

        for (let i = targetIndex - 1; i >= 0; i--) {
          const s = siblings[i];
          if (s.id === ev.id) continue;
          const siblingType =
            s._source?.workItemType || s._source?.type || 'unknown';
          if (s.$isMilestone || siblingType === 'milestone') continue;
          if (movedType === siblingType && s._source?.iid) {
            compatibleBefore = s;
            break;
          }
        }

        for (let i = targetIndex + 1; i < siblings.length; i++) {
          const s = siblings[i];
          if (s.id === ev.id) continue;
          const siblingType =
            s._source?.workItemType || s._source?.type || 'unknown';
          if (s.$isMilestone || siblingType === 'milestone') continue;
          if (movedType === siblingType && s._source?.iid) {
            compatibleAfter = s;
            break;
          }
        }

        let useTarget = null;
        let useMode = ev.mode;

        if (targetIndex === 0 || !compatibleBefore) {
          if (compatibleAfter) {
            useTarget = compatibleAfter;
            useMode = 'before';
          }
        } else if (
          targetIndex === siblings.length - 1 ||
          !compatibleAfter
        ) {
          if (compatibleBefore) {
            useTarget = compatibleBefore;
            useMode = 'after';
          }
        } else {
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
            useTarget._source.iid,
            useMode,
          );
        } else {
          console.error(
            `[GanttView] No compatible ${movedType} found to reorder relative to`,
          );
        }
        return;
      }

      if (!targetIid) {
        console.error(
          `[GanttView] Cannot reorder: target task ${ev.target} has no source IID`,
        );
        return;
      }

      await provider.reorderWorkItem(movedIid, targetIid, ev.mode);
    } catch (error) {
      console.error(
        `[GanttView] Failed to reorder ${movedTask.text}: ${error.message}`,
      );
    }
  });
}

function registerLinkHandlers(ganttApi, deps) {
  const { linksRef, createLink, deleteLink, sync, showToast } = deps;

  ganttApi.on('add-link', async (ev) => {
    try {
      await createLink(ev.link);
    } catch (error) {
      console.error('Failed to create link:', error);
      showToast(`Failed to create link: ${error.message}`, 'error');
      ganttApi.exec('delete-link', { id: ev.id });
    }
  });

  ganttApi.on('delete-link', async (ev) => {
    try {
      const currentLinks = linksRef.current;
      const sourceId = ev.link?.source;
      const targetId = ev.link?.target;

      if (!sourceId || !targetId) {
        console.warn(
          '[delete-link] No source/target in event, cannot find link',
        );
        return;
      }

      const link = findLinkBySourceTarget(currentLinks, sourceId, targetId);

      if (!link) {
        console.warn(
          '[delete-link] Link not found in React state, skipping API call',
        );
        return;
      }

      const validation = validateLinkMetadata(link);

      if (validation.valid) {
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
      } else if (link._source === undefined) {
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
}

function registerCascadeMove(ganttApi, deps) {
  const {
    links,
    countWorkdaysRef,
    calculateEndDateByWorkdaysRef,
    syncTask,
    sync,
    showToast,
  } = deps;

  ganttApi.on('cascade-move-task', async (ev) => {
    const { id: parentId, diff } = ev;
    const parentTask = ganttApi.getTask(parentId);

    if (!parentTask) {
      console.error('Parent task not found:', parentId);
      return;
    }

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

    const calculateStartFromLink = (link, sourceData) => {
      const { newStart, newEnd } = sourceData;
      switch (link.type) {
        case 'e2s': {
          const next = new Date(newEnd);
          next.setDate(next.getDate() + 1);
          return next;
        }
        case 's2s':
          return new Date(newStart);
        case 'e2e':
        case 's2e':
        default:
          return new Date(newStart);
      }
    };

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

      const descendants = getAllDescendants(parentId);
      const currentLinks = links || [];
      const descendantIds = new Set(descendants.map((d) => d.id));
      descendantIds.add(parentId);

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

          const inboundLinks = currentLinks.filter(
            (link) =>
              link.target === child.id && descendantIds.has(link.source),
          );

          return {
            id: child.id,
            offsetDays,
            workdays,
            inboundLinks,
            _source: childTask._source,
          };
        })
        .filter(Boolean);

      childData.sort((a, b) => a.offsetDays - b.offsetDays);

      const processed = new Map();
      processed.set(parentId, {
        newStart: newParentStart,
        newEnd: newParentEnd,
      });

      const updates = [];
      for (const child of childData) {
        let newStart;

        const linkedSource = child.inboundLinks.find((l) =>
          processed.has(l.source),
        );
        if (linkedSource) {
          newStart = calculateStartFromLink(
            linkedSource,
            processed.get(linkedSource.source),
          );
        } else {
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
          _source: child._source,
        });
      }

      // Batch update UI
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

      // Batch sync to provider
      await syncTask(parentId, {
        start: newParentStart,
        end: newParentEnd,
        _source: parentTask._source,
      });

      for (const u of updates) {
        await syncTask(u.id, {
          start: u.start,
          end: u.end,
          _source: u._source,
        });
      }

      showToast(`Moved ${updates.length + 1} items`, 'success');
    } catch (error) {
      console.error('Cascade move failed:', error);
      showToast(`Cascade move failed: ${error.message}`, 'error');
      sync();
    }
  });
}
