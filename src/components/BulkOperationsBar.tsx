// @ts-nocheck
/**
 * BulkOperationsBar Component
 *
 * Floating bar that appears when multiple tasks are selected.
 * Provides bulk operations: assign, change state, reschedule, delete.
 */

import { useState, useCallback, useMemo } from 'react';
import { BulkAssignDialog } from './BulkAssignDialog';
import { BulkStateDialog } from './BulkStateDialog';
import { BulkRescheduleDialog } from './BulkRescheduleDialog';
import './BulkOperationsBar.css';

/**
 * @param {Object} props
 * @param {Array} props.selectedTasks - Array of selected task objects
 * @param {Object} props.api - Gantt API instance
 * @param {Object} props.provider - Data provider instance
 * @param {Array} props.assigneeOptions - Available assignees
 * @param {Function} props.onSync - Sync callback after bulk operations
 * @param {Function} props.showToast - Toast notification callback
 * @param {Function} props.onDeselectAll - Callback to deselect all
 */
export function BulkOperationsBar({
  selectedTasks = [],
  api,
  provider,
  assigneeOptions = [],
  onSync,
  showToast,
  onDeselectAll,
}) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const selectedCount = selectedTasks.length;

  const handleBulkAssign = useCallback(() => {
    if (selectedCount < 2) return;
    setShowAssignDialog(true);
  }, [selectedCount]);

  const handleBulkState = useCallback(() => {
    if (selectedCount < 2) return;
    setShowStateDialog(true);
  }, [selectedCount]);

  const handleBulkReschedule = useCallback(() => {
    if (selectedCount < 2) return;
    setShowRescheduleDialog(true);
  }, [selectedCount]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCount < 2 || !api || !provider) return;

    const confirmed = window.confirm(
      `Delete ${selectedCount} selected items? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      const taskIds = selectedTasks.map((t) => t.id);
      for (const taskId of taskIds) {
        await provider.deleteTask(taskId);
      }
      showToast(`Deleted ${selectedCount} items`, 'success');
      onDeselectAll?.();
      onSync?.();
    } catch (error) {
      console.error('[BulkOperations] Delete failed:', error);
      showToast(`Failed to delete items: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  }, [
    selectedCount,
    selectedTasks,
    api,
    provider,
    showToast,
    onDeselectAll,
    onSync,
  ]);

  const handleAssignConfirm = useCallback(
    async (assignees) => {
      if (!provider || selectedTasks.length === 0) return;

      setProcessing(true);
      try {
        const updates = [];
        for (const task of selectedTasks) {
          if (task._gitlab?.type === 'milestone') continue;
          updates.push(
            provider.syncTask(task.id, {
              assigned: assignees.join(', '),
              _gitlab: task._gitlab,
            }),
          );
        }
        await Promise.all(updates);
        showToast(`Assigned ${updates.length} items`, 'success');
        setShowAssignDialog(false);
        onSync?.();
      } catch (error) {
        console.error('[BulkOperations] Assign failed:', error);
        showToast(`Failed to assign: ${error.message}`, 'error');
      } finally {
        setProcessing(false);
      }
    },
    [provider, selectedTasks, showToast, onSync],
  );

  const handleStateConfirm = useCallback(
    async (newState) => {
      if (!provider || selectedTasks.length === 0) return;

      setProcessing(true);
      try {
        const updates = [];
        for (const task of selectedTasks) {
          if (task._gitlab?.type === 'milestone') continue;
          updates.push(
            provider.syncTask(task.id, {
              state: newState,
              _gitlab: task._gitlab,
            }),
          );
        }
        await Promise.all(updates);
        showToast(`Updated state for ${updates.length} items`, 'success');
        setShowStateDialog(false);
        onSync?.();
      } catch (error) {
        console.error('[BulkOperations] State change failed:', error);
        showToast(`Failed to change state: ${error.message}`, 'error');
      } finally {
        setProcessing(false);
      }
    },
    [provider, selectedTasks, showToast, onSync],
  );

  const handleRescheduleConfirm = useCallback(
    async (daysOffset) => {
      if (!api || selectedTasks.length === 0) return;

      setProcessing(true);
      try {
        const updates = [];
        for (const task of selectedTasks) {
          const currentStart = task.start;
          const currentEnd = task.end;

          if (!currentStart && !currentEnd) continue;

          const newStart = currentStart
            ? new Date(
                currentStart.getTime() + daysOffset * 24 * 60 * 60 * 1000,
              )
            : null;
          const newEnd = currentEnd
            ? new Date(currentEnd.getTime() + daysOffset * 24 * 60 * 60 * 1000)
            : null;

          const update = { _gitlab: task._gitlab };
          if (newStart) {
            update.start = newStart;
            update._gitlab = {
              ...update._gitlab,
              startDate: newStart.toISOString().split('T')[0],
            };
          }
          if (newEnd) {
            update.end = newEnd;
            update._gitlab = {
              ...update._gitlab,
              dueDate: newEnd.toISOString().split('T')[0],
            };
          }

          updates.push(provider.syncTask(task.id, update));
        }

        await Promise.all(updates);
        const action = daysOffset > 0 ? 'Moved forward' : 'Moved back';
        showToast(
          `${action} ${Math.abs(daysOffset)} day(s) for ${updates.length} items`,
          'success',
        );
        setShowRescheduleDialog(false);
        onSync?.();
      } catch (error) {
        console.error('[BulkOperations] Reschedule failed:', error);
        showToast(`Failed to reschedule: ${error.message}`, 'error');
      } finally {
        setProcessing(false);
      }
    },
    [api, provider, selectedTasks, showToast, onSync],
  );

  const eligibleTasks = useMemo(() => {
    return selectedTasks.filter((t) => t._gitlab?.type !== 'milestone');
  }, [selectedTasks]);

  if (selectedCount < 2) {
    return null;
  }

  return (
    <>
      <div className="bulk-operations-bar">
        <div className="bulk-selection-info">
          <span className="bulk-count-badge">{selectedCount}</span>
          <span className="bulk-selection-text">selected</span>
        </div>

        <div className="bulk-actions">
          <button
            className="bulk-action-btn"
            onClick={handleBulkAssign}
            disabled={processing || eligibleTasks.length === 0}
            title="Assign selected items"
          >
            <i className="fas fa-user-plus"></i>
            <span>Assign</span>
          </button>

          <button
            className="bulk-action-btn"
            onClick={handleBulkState}
            disabled={processing || eligibleTasks.length === 0}
            title="Change state"
          >
            <i className="fas fa-exchange-alt"></i>
            <span>State</span>
          </button>

          <button
            className="bulk-action-btn"
            onClick={handleBulkReschedule}
            disabled={processing}
            title="Move dates"
          >
            <i className="fas fa-calendar-alt"></i>
            <span>Reschedule</span>
          </button>

          <div className="bulk-action-separator"></div>

          <button
            className="bulk-action-btn bulk-action-danger"
            onClick={handleBulkDelete}
            disabled={processing}
            title="Delete selected items"
          >
            <i className="fas fa-trash"></i>
            <span>Delete</span>
          </button>
        </div>

        <button
          className="bulk-close-btn"
          onClick={onDeselectAll}
          title="Deselect all (Escape)"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <BulkAssignDialog
        isOpen={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        onConfirm={handleAssignConfirm}
        selectedCount={eligibleTasks.length}
        assigneeOptions={assigneeOptions}
        processing={processing}
      />

      <BulkStateDialog
        isOpen={showStateDialog}
        onClose={() => setShowStateDialog(false)}
        onConfirm={handleStateConfirm}
        selectedCount={eligibleTasks.length}
        processing={processing}
      />

      <BulkRescheduleDialog
        isOpen={showRescheduleDialog}
        onClose={() => setShowRescheduleDialog(false)}
        onConfirm={handleRescheduleConfirm}
        selectedCount={selectedCount}
        processing={processing}
      />
    </>
  );
}

export default BulkOperationsBar;
