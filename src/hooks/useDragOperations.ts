/**
 * useDragOperations Hook
 *
 * React hook for managing drag-and-drop operations in the Kanban board.
 * Handles same-list reorder, cross-list drag (label changes), and close/reopen for Closed list.
 * Provides snapshot capture for potential rollback on API failures.
 */

import { useCallback, useRef } from 'react';
import type { ITask, TID } from '@svar-ui/gantt-store';

/** Snapshot of task state before drag operation for potential rollback */
interface DragSnapshot {
  /** Copy of task data before drag */
  task: ITask;
  /** Source list ID where drag started */
  sourceListId: string;
}

/** Parameters for useDragOperations hook */
export interface UseDragOperationsParams {
  /** Current tasks array */
  tasks: ITask[];
  /**
   * Function to sync task updates to GitLab
   * @param taskId - The task ID to update
   * @param updates - The updates to apply (labels, state, etc.)
   */
  syncTask: (taskId: TID, updates: Record<string, unknown>) => Promise<void>;
  /**
   * Function to reorder a task relative to another task
   * @param taskId - The task ID to reorder
   * @param targetId - The target task ID to position relative to
   * @param position - Position relative to target ('before' or 'after')
   */
  reorderTask: (
    taskId: TID,
    targetId: TID,
    position: 'before' | 'after',
  ) => Promise<void>;
  /**
   * Function to show toast notifications
   * @param message - The message to display
   * @param type - Toast type (success, error, info)
   */
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Function to refresh tasks from GitLab after error */
  refreshTasks: () => void;
}

/** Return type of useDragOperations hook */
export interface UseDragOperationsReturn {
  /**
   * Capture a snapshot of task state before drag for potential rollback
   * @param taskId - The task ID being dragged
   * @param sourceListId - The source list ID
   */
  captureSnapshot: (taskId: TID, sourceListId: string) => void;
  /**
   * Handle same-list reorder operation
   * @param taskId - The task ID to reorder
   * @param targetTaskId - The target task ID to position relative to
   * @param position - Position relative to target
   * @returns true if successful, false if failed
   */
  handleSameListReorder: (
    taskId: TID,
    targetTaskId: TID,
    position: 'before' | 'after',
  ) => Promise<boolean>;
  /**
   * Handle cross-list drag operation (label changes, close/reopen)
   * @param taskId - The task ID to move
   * @param sourceLabels - Labels of the source list
   * @param targetLabels - Labels of the target list
   * @param targetType - Type of target list (regular, others, closed)
   * @returns true if successful, false if failed
   */
  handleCrossListDrag: (
    taskId: TID,
    sourceLabels: string[],
    targetLabels: string[],
    targetType: 'regular' | 'others' | 'closed',
  ) => Promise<boolean>;
  /** Clear the saved snapshot after successful operation */
  clearSnapshot: () => void;
}

/**
 * Custom hook for managing Kanban drag-and-drop operations
 *
 * This hook encapsulates the API operations for:
 * - Same-list reorder: Updates task position via reorderTask
 * - Cross-list drag: Updates labels via syncTask
 * - Close/reopen: Updates state for Closed list interactions
 *
 * Provides error handling with toast notifications and automatic refresh on failure.
 *
 * NOTE: syncTask handles optimistic updates (updates local state immediately,
 * then syncs to GitLab, rolls back on failure). This hook triggers the operations
 * and handles error display.
 */
export function useDragOperations({
  tasks,
  syncTask,
  reorderTask,
  showToast,
  refreshTasks,
}: UseDragOperationsParams): UseDragOperationsReturn {
  // Snapshot reference for potential rollback
  const snapshotRef = useRef<DragSnapshot | null>(null);

  /**
   * Capture snapshot before drag for potential rollback
   */
  const captureSnapshot = useCallback(
    (taskId: TID, sourceListId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        snapshotRef.current = {
          task: { ...task },
          sourceListId,
        };
      }
    },
    [tasks],
  );

  /**
   * Same-list reorder: update relative position
   *
   * Calls the reorderTask function to update the task's position
   * relative to the target task.
   */
  const handleSameListReorder = useCallback(
    async (
      taskId: TID,
      targetTaskId: TID,
      position: 'before' | 'after',
    ): Promise<boolean> => {
      try {
        await reorderTask(taskId, targetTaskId, position);
        return true;
      } catch (error) {
        showToast(
          `Failed to reorder: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [reorderTask, showToast, refreshTasks],
  );

  /**
   * Cross-list drag: handle label changes and state changes
   *
   * Different behaviors based on target list type:
   * - closed: Close the issue
   * - others: Remove source labels only (and reopen if was closed)
   * - regular: Swap labels (remove source, add target) (and reopen if was closed)
   */
  const handleCrossListDrag = useCallback(
    async (
      taskId: TID,
      sourceLabels: string[],
      targetLabels: string[],
      targetType: 'regular' | 'others' | 'closed',
    ): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;

      // Parse current labels from task
      // NOTE: task.labels is a comma-separated string in this codebase
      const currentLabels = task.labels
        ? String(task.labels).split(', ').filter(Boolean)
        : [];

      try {
        // Handle different target types
        if (targetType === 'closed') {
          // Close the issue
          await syncTask(taskId, { state: 'closed' });
        } else if (targetType === 'others') {
          // Remove source labels only (move to "uncategorized")
          const newLabels = currentLabels.filter(
            (l) => !sourceLabels.includes(l),
          );
          await syncTask(taskId, {
            labels: newLabels.join(', '),
            // If was closed, reopen
            ...(task.state === 'closed' ? { state: 'opened' } : {}),
          });
        } else {
          // Regular list: swap labels (remove source, add target)
          const newLabels = currentLabels
            .filter((l) => !sourceLabels.includes(l))
            .concat(targetLabels);
          // Remove duplicates
          const uniqueLabels = [...new Set(newLabels)];
          await syncTask(taskId, {
            labels: uniqueLabels.join(', '),
            // If was closed, reopen
            ...(task.state === 'closed' ? { state: 'opened' } : {}),
          });
        }
        // syncTask handles optimistic update, no need to refresh on success
        return true;
      } catch (error) {
        showToast(
          `Failed to move issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
        refreshTasks();
        return false;
      }
    },
    [tasks, syncTask, showToast, refreshTasks],
  );

  /**
   * Clear snapshot after successful operation
   */
  const clearSnapshot = useCallback(() => {
    snapshotRef.current = null;
  }, []);

  return {
    captureSnapshot,
    handleSameListReorder,
    handleCrossListDrag,
    clearSnapshot,
  };
}
