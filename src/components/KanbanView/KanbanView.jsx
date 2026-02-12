// src/components/KanbanView/KanbanView.jsx

/**
 * KanbanView
 *
 * Main Kanban view component. Consumes data from DataContext.
 * Displays issues in a board layout with customizable lists.
 *
 * Phase 3: Board management functionality
 * - BoardSelector for selecting/creating boards
 * - CreateBoardDialog for new boards
 * - BoardSettingsModal for editing boards
 * - ListEditDialog for editing lists
 *
 * Phase 4: Drag-and-drop functionality
 * - KanbanBoardDnd for drag-and-drop support
 * - useDragOperations for handling API operations
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { KanbanBoardDnd } from './KanbanBoardDnd';
import { BoardSelector } from './BoardSelector';
import { CreateBoardDialog } from './CreateBoardDialog';
import { BoardSettingsModal } from './BoardSettingsModal';
import { ListEditDialog } from './ListEditDialog';
import { DataFilters } from '../../utils/DataFilters';
import { useDragOperations } from '../../hooks/useDragOperations';
// ProjectSelector removed - data source is provided via DataProvider
import { ColorRulesEditor } from '../ColorRulesEditor';
import './KanbanView.css';
import '../shared/SettingsModal.css';
import '../shared/modal-close-button.css';

export function KanbanView({ showSettings, onSettingsClose }) {
  // Get shared data from context
  const {
    tasks: allTasks,
    filterOptions,
    serverFilterOptions,
    showToast,
    currentConfig,
    proxyConfig,
    provider,
    sync,
    syncTask,
    reorderTaskLocal,
    // For settings modal
    reloadConfigs,
    handleConfigChange,
    canEditHolidays,
    holidaysText,
    workdaysText,
    colorRules,
    holidaysLoading,
    holidaysSaving,
    holidaysError,
    setHolidaysText,
    setWorkdaysText,
    setColorRules,
  } = useData();

  // Board management state
  // TODO: Replace with generic board management when provider supports it
  const boards = [];
  const currentBoard = null;
  const boardsLoading = false;
  const boardsSaving = false;
  const boardsError = null;
  const createBoard = async () => null;
  const updateBoard = async () => {};
  const deleteBoard = async () => {};
  const selectBoard = () => {};
  const addList = async () => {};
  const updateList = async () => {};

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingList, setEditingList] = useState(null); // null = closed, undefined = new list, object = edit list

  // Show error toast when boards error occurs
  useEffect(() => {
    if (boardsError) {
      showToast(`Board error: ${boardsError}`, 'error');
    }
  }, [boardsError, showToast]);

  // Build label color map from server filter options
  const labelColorMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.color) {
        map.set(label.title || label.name, label.color);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Build label priority map from server filter options
  const labelPriorityMap = useMemo(() => {
    const map = new Map();
    (serverFilterOptions?.labels || []).forEach((label) => {
      if (label.priority != null) {
        map.set(label.title || label.name, label.priority);
      }
    });
    return map;
  }, [serverFilterOptions?.labels]);

  // Get available labels for list editing (with colors for FilterMultiSelect)
  const availableLabels = useMemo(() => {
    return (serverFilterOptions?.labels || []).map((label) => ({
      title: label.title || label.name,
      color: label.color,
    }));
  }, [serverFilterOptions?.labels]);

  // Add labelPriority to tasks
  const tasksWithPriority = useMemo(() => {
    return allTasks.map((task) => {
      const taskLabels = task.labels
        ? task.labels.split(', ').filter(Boolean)
        : [];
      let labelPriority = Number.MAX_SAFE_INTEGER;

      taskLabels.forEach((labelTitle) => {
        const priority = labelPriorityMap.get(labelTitle);
        if (priority !== undefined && priority < labelPriority) {
          labelPriority = priority;
        }
      });

      return { ...task, labelPriority };
    });
  }, [allTasks, labelPriorityMap]);

  // Apply client-side filters (same as Gantt)
  const filteredTasks = useMemo(() => {
    // Only include issues (not milestones, not Tasks which are child items)
    const issuesOnly = tasksWithPriority.filter(
      (task) => task.$isIssue && task.workItemType !== 'Task',
    );
    return DataFilters.applyFilters(issuesOnly, filterOptions);
  }, [tasksWithPriority, filterOptions]);

  // Build child tasks map: issueId -> childTasks[]
  // Child tasks are items with workItemType='Task' and have a parent
  const childTasksMap = useMemo(() => {
    const map = new Map();
    tasksWithPriority.forEach((task) => {
      // Check if this is a Task (child item) with a parent
      if (task.workItemType === 'Task' && task.parent) {
        const parentId = task.parent;
        if (!map.has(parentId)) {
          map.set(parentId, []);
        }
        map.get(parentId).push(task);
      }
    });
    return map;
  }, [tasksWithPriority]);

  // === Drag-and-Drop Operations ===
  // Reorder task wrapper: converts task ID for API call
  // Uses optimistic update for immediate UI feedback
  const reorderTask = useCallback(
    async (taskId, targetTaskId, position) => {
      if (!provider) {
        throw new Error('Provider not available');
      }
      const task = filteredTasks.find((t) => t.id === taskId);
      const targetTask = filteredTasks.find((t) => t.id === targetTaskId);
      if (!task?.issueId || !targetTask?.issueId) {
        throw new Error('Task IID not found');
      }

      // Optimistic update: update local state immediately
      const { rollback } = reorderTaskLocal(taskId, targetTaskId, position);

      try {
        // Sync to provider
        await provider.reorderWorkItem(
          task.issueId,
          targetTask.issueId,
          position,
        );
      } catch (error) {
        // Rollback on failure
        rollback();
        throw error;
      }
    },
    [provider, filteredTasks, reorderTaskLocal],
  );

  // Refresh tasks by triggering a sync
  const refreshTasks = useCallback(() => {
    sync();
  }, [sync]);

  // Get drag operation handlers from hook
  const { handleSameListReorder, handleCrossListDrag } = useDragOperations({
    tasks: filteredTasks,
    syncTask,
    reorderTask,
    showToast,
    refreshTasks,
  });

  // Handle card double-click (open editor)
  const handleCardDoubleClick = useCallback(
    (task) => {
      showToast(`Opening editor for #${task.issueId || task.id}...`, 'info');
      // TODO: Implement editor integration
    },
    [showToast],
  );

  // Board management handlers
  const handleCreateBoard = useCallback(
    async (boardData) => {
      const newBoard = await createBoard(boardData);
      if (newBoard) {
        setShowCreateDialog(false);
        showToast(`Board "${newBoard.name}" created`, 'success');
      }
    },
    [createBoard, showToast],
  );

  const handleSaveBoard = useCallback(
    async (updatedBoard) => {
      await updateBoard(updatedBoard);
      setShowSettingsModal(false);
      showToast('Board settings saved', 'success');
    },
    [updateBoard, showToast],
  );

  const handleDeleteBoard = useCallback(async () => {
    if (!currentBoard) return;

    await deleteBoard(currentBoard.id);
    setShowSettingsModal(false);
    showToast(`Board "${currentBoard.name}" deleted`, 'success');
  }, [currentBoard, deleteBoard, showToast]);

  // List management handlers
  const handleEditList = useCallback((list) => {
    // list = null means open Add List dialog
    // list = object means open Edit List dialog
    setEditingList(list === null ? undefined : list);
  }, []);

  const handleSaveList = useCallback(
    async (listData) => {
      if (editingList === undefined) {
        // Adding new list
        await addList(listData);
        showToast(`List "${listData.name}" added`, 'success');
      } else {
        // Updating existing list
        await updateList(listData);
        showToast(`List "${listData.name}" updated`, 'success');
      }
      setEditingList(null);
    },
    [editingList, addList, updateList, showToast],
  );

  // Render loading state
  const renderLoadingState = () => (
    <div className="kanban-view-empty">
      <i className="fas fa-spinner fa-spin" />
      <h3>Loading Boards...</h3>
    </div>
  );

  // Render empty state when no board
  const renderEmptyState = () => (
    <div className="kanban-view-empty">
      <i className="fas fa-columns" />
      <h3>No Board Selected</h3>
      <p>
        {boards.length === 0
          ? 'Create a board to get started with Kanban view.'
          : 'Select a board from the dropdown above.'}
      </p>
      <button
        onClick={() => setShowCreateDialog(true)}
        className="kanban-view-empty-btn"
      >
        <i className="fas fa-plus" />
        Create New Board
      </button>
    </div>
  );

  return (
    <div className="kanban-view">
      {/* Board Selector */}
      <BoardSelector
        boards={boards}
        currentBoard={currentBoard}
        onSelectBoard={selectBoard}
        onCreateBoard={() => setShowCreateDialog(true)}
        onEditBoard={() => setShowSettingsModal(true)}
        loading={boardsLoading}
        saving={boardsSaving}
      />

      {/* Board Content */}
      <div className="kanban-view-content">
        {boardsLoading ? (
          renderLoadingState()
        ) : !currentBoard ? (
          renderEmptyState()
        ) : (
          <KanbanBoardDnd
            board={currentBoard}
            tasks={filteredTasks}
            childTasksMap={childTasksMap}
            labelColorMap={labelColorMap}
            onCardDoubleClick={handleCardDoubleClick}
            onSameListReorder={handleSameListReorder}
            onCrossListDrag={handleCrossListDrag}
          />
        )}
      </div>

      {/* Create Board Dialog */}
      <CreateBoardDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateBoard}
        saving={boardsSaving}
      />

      {/* Board Settings Modal */}
      <BoardSettingsModal
        isOpen={showSettingsModal}
        board={currentBoard}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveBoard}
        onDelete={handleDeleteBoard}
        onEditList={handleEditList}
        saving={boardsSaving}
      />

      {/* List Edit Dialog */}
      <ListEditDialog
        isOpen={editingList !== null}
        list={editingList || null}
        availableLabels={availableLabels}
        onClose={() => setEditingList(null)}
        onSave={handleSaveList}
        saving={boardsSaving}
      />

      {/* Project Settings Modal (shared with GanttView) */}
      {showSettings && (
        <div
          className="settings-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              onSettingsClose?.();
            }
          }}
        >
          <div
            className="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button onClick={onSettingsClose} className="modal-close-btn">
                &times;
              </button>
            </div>

            <div className="settings-modal-body">
              <div className="settings-section">
                <h4>Data Source</h4>
                <p style={{ fontSize: '13px', color: '#666' }}>
                  Data source is configured via the DataProvider wrapper.
                </p>
              </div>

              <div className="settings-section">
                <h4 className="settings-section-header">
                  Holidays
                  {!canEditHolidays && (
                    <span className="permission-warning">
                      <i className="fas fa-lock"></i>
                      {currentConfig?.type === 'group'
                        ? ' Not available for Groups'
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
                        ? ' Not available for Groups'
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
                        ? ' Not available for Groups'
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
    </div>
  );
}
