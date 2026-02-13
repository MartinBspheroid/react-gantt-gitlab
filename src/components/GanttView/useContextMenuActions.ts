// @ts-nocheck
/**
 * useContextMenuActions Hook
 * Context menu configuration and action handlers.
 * Handles Move In, Open in ADO, Change State, Assign To, Split Task, Blueprint options.
 */

import { useState, useCallback, useMemo } from 'react';
import { defaultMenuOptions } from '@svar-ui/gantt-store';

export function useContextMenuActions({
  api,
  provider,
  syncTask,
  sync,
  showToast,
  // Modal setters
  setShowMoveInModal,
  setShowSaveBlueprintModal,
  setShowApplyBlueprintModal,
  setSelectedMilestoneForBlueprint,
  setMoveInProcessing,
}) {
  // State to hold selected tasks when modal is opened
  const [selectedTasksForModal, setSelectedTasksForModal] = useState([]);

  // Get selected tasks from Gantt API when modal opens
  const getSelectedTasks = useCallback(() => {
    if (!api) return [];
    const state = api.getState();
    return state._selected || [];
  }, [api]);

  // Custom context menu options
  const contextMenuOptions = useMemo(() => {
    const options = [...defaultMenuOptions];

    // Find the paste-task option index and insert custom options after it
    const pasteIndex = options.findIndex((opt) => opt.id === 'paste-task');
    const insertIndex = pasteIndex !== -1 ? pasteIndex + 1 : options.length;

    // Insert separator and Azure DevOps custom options
    options.splice(
      insertIndex,
      0,
      { type: 'separator' },
      {
        id: 'open-in-ado',
        text: 'Open in Azure DevOps',
        icon: 'fas fa-external-link-alt',
        check: (task) => task?._source?.webUrl || task?._source?.url,
      },
      {
        id: 'change-state',
        text: 'Change State',
        icon: 'fas fa-exchange-alt',
        check: (task) =>
          task && !task?.$isMilestone && task?._source?.type !== 'milestone',
        data: [
          { id: 'change-state:open', text: 'Open' },
          { id: 'change-state:closed', text: 'Closed' },
        ],
      },
      {
        id: 'assign-to',
        text: 'Assign To',
        icon: 'fas fa-user-plus',
        check: (task) =>
          task && !task?.$isMilestone && task?._source?.type !== 'milestone',
        data: [
          { id: 'assign-to:unassigned', text: 'Unassigned' },
          { type: 'separator' },
        ],
      },
    );

    // Find the delete-task option index and insert Move In... before it
    const deleteIndex = options.findIndex((opt) => opt.id === 'delete-task');
    if (deleteIndex !== -1) {
      options.splice(deleteIndex, 0, {
        id: 'move-in',
        text: 'Move In...',
        icon: 'wxi-folder',
        check: (task) => task != null,
      });
    } else {
      options.push({ type: 'separator' });
      options.push({
        id: 'move-in',
        text: 'Move In...',
        icon: 'wxi-folder',
        check: (task) => task != null,
      });
    }

    // Add Split Task option
    const splitIndex = options.findIndex((opt) => opt.id === 'delete-task');
    if (splitIndex !== -1) {
      options.splice(splitIndex, 0, {
        id: 'split-task',
        text: 'Split Task',
        icon: 'wxi-split',
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
      check: (task) => task?._source?.type === 'milestone',
    });
    options.push({
      id: 'create-from-blueprint',
      text: 'Create from Blueprint...',
      icon: 'fas fa-paste',
      check: (task) => task != null,
    });

    return options;
  }, []);

  // Handle context menu click events
  const handleContextMenuClick = useCallback(
    async ({ action, context: ctx }) => {
      if (action?.id === 'move-in') {
        const tasks = getSelectedTasks();
        setSelectedTasksForModal(tasks);
        setShowMoveInModal(true);
      } else if (action?.id === 'split-task') {
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
        if (ctx?._source?.type === 'milestone') {
          setSelectedMilestoneForBlueprint(ctx);
          setShowSaveBlueprintModal(true);
        }
      } else if (action?.id === 'create-from-blueprint') {
        setShowApplyBlueprintModal(true);
      } else if (action?.id === 'open-in-ado') {
        const webUrl = ctx?._source?.webUrl || ctx?._source?.url;
        if (webUrl) {
          window.open(webUrl, '_blank', 'noopener,noreferrer');
        }
      } else if (action?.id?.startsWith('change-state:')) {
        const newState = action.id.split(':')[1];
        if (ctx?.id && newState) {
          try {
            await syncTask(ctx.id, { state: newState });
            showToast(`State changed to ${newState}`, 'success');
            await sync();
          } catch (error) {
            console.error('[GanttView] Failed to change state:', error);
            showToast(`Failed to change state: ${error.message}`, 'error');
          }
        }
      } else if (action?.id?.startsWith('assign-to:')) {
        const assigneeValue = action.id.split(':')[1];
        if (ctx?.id) {
          try {
            const newAssignee =
              assigneeValue === 'unassigned' ? '' : assigneeValue;
            await syncTask(ctx.id, { assigned: newAssignee });
            showToast(
              newAssignee ? `Assigned to ${newAssignee}` : 'Unassigned',
              'success',
            );
            await sync();
          } catch (error) {
            console.error('[GanttView] Failed to assign task:', error);
            showToast(`Failed to assign: ${error.message}`, 'error');
          }
        }
      }
    },
    [getSelectedTasks, syncTask, sync, api, showToast],
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
            result = await provider.batchUpdateParent(iids, targetId);
            break;
          case 'milestone':
            result = await provider.batchUpdateMilestone(iids, targetId);
            break;
          case 'epic':
            result = await provider.batchUpdateEpic(iids, targetId);
            break;
          default:
            throw new Error(`Unknown move type: ${type}`);
        }

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
          result.failed.forEach((f) => {
            showToast(`#${f.iid}: ${f.error}`, 'error');
          });
          throw new Error('Move operation failed');
        }

        if (result.success.length > 0) {
          setShowMoveInModal(false);
          await sync();
        }
      } catch (error) {
        console.error('[GanttView] Move In failed:', error);
        showToast(`Move failed: ${error.message}`, 'error');
        throw error;
      } finally {
        setMoveInProcessing(false);
      }
    },
    [provider, showToast, sync],
  );

  return {
    contextMenuOptions,
    handleContextMenuClick,
    handleMoveIn,
    selectedTasksForModal,
  };
}
