// @ts-nocheck
/**
 * useDialogHandlers Hook
 * Confirmation handlers for create/delete/discard dialogs.
 */

import { useCallback } from 'react';
import {
  getChildrenForTask,
  sortByDeletionOrder,
} from './ganttTaskUtils.ts';

export function useDialogHandlers({
  api,
  // Refs
  allTasksRef,
  pendingEditorChangesRef,
  pendingAddTaskContextRef,
  pendingDeleteTaskIdsRef,
  // Data operations
  createMilestone,
  createTask,
  syncTask,
  sync,
  showToast,
  // Dialog state
  createItemDialogType,
  setCreateItemDialogOpen,
  setDeleteDialogOpen,
  setDeleteDialogItems,
  setDiscardChangesDialogOpen,
}) {
  // Handler for adding a new milestone - opens CreateItemDialog
  const handleAddMilestone = useCallback(() => {
    // This just triggers dialog open - actual creation is in handleCreateItemConfirm
    // The caller should set dialog type and open it
  }, []);

  // Handler for CreateItemDialog confirmation
  const handleCreateItemConfirm = useCallback(
    async (items) => {
      if (createItemDialogType === 'milestone') {
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
        const context = pendingAddTaskContextRef.current;
        if (!context) {
          setCreateItemDialogOpen(false);
          return;
        }

        const { baseTask, parentTask, itemType } = context;

        try {
          for (const item of items) {
            const newTask = {
              ...baseTask,
              text: item.title,
              details: item.description || '',
              assigned: item.assignees?.join(', ') || '',
            };

            if (itemType === 'issue' && parentTask?.$isMilestone) {
              newTask._source = {
                ...newTask._source,
                milestoneGlobalId: parentTask._source.globalId,
              };
            }

            if (itemType === 'task' && parentTask?.$isIssue) {
              newTask.parent = parentTask.id;
            }

            await createTask(newTask);
          }

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
      sync();
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
        if (recursive) {
          const allItems = new Set(taskIds);
          for (const taskId of taskIds) {
            const children = getChildrenForTask(taskId, allTasksRef.current);
            children.forEach((child) => allItems.add(child.id));
          }
          taskIds = Array.from(allItems);
        }

        taskIds = sortByDeletionOrder(taskIds, allTasksRef.current);

        const processedSet = new Set();

        if (action === 'delete') {
          for (const taskId of taskIds) {
            if (processedSet.has(taskId)) continue;
            processedSet.add(taskId);
            api.exec('delete-task', { id: taskId, skipHandler: true });
          }
        } else if (action === 'close') {
          for (const taskId of taskIds) {
            if (processedSet.has(taskId)) continue;

            const task = allTasksRef.current.find((t) => t.id === taskId);
            if (task?.$isMilestone || task?._source?.type === 'milestone') {
              console.log(
                `[GanttView] Skipping close for milestone: ${taskId}`,
              );
              continue;
            }

            processedSet.add(taskId);
            await syncTask(taskId, { state: 'closed' });
          }
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

  return {
    handleAddMilestone,
    handleCreateItemConfirm,
    handleDiscardChangesConfirm,
    handleDeleteConfirm,
  };
}
