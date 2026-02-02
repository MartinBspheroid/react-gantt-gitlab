// src/components/KanbanView/KanbanView.jsx

/**
 * KanbanView
 *
 * Main Kanban view component. Consumes data from GitLabDataContext.
 * Displays issues in a board layout with customizable lists.
 *
 * Phase 3: Board management functionality
 * - BoardSelector for selecting/creating boards
 * - CreateBoardDialog for new boards
 * - BoardSettingsModal for editing boards
 * - ListEditDialog for editing lists
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGitLabData } from '../../contexts/GitLabDataContext';
import { useIssueBoard } from '../../hooks/useIssueBoard';
import { KanbanBoard } from './KanbanBoard';
import { BoardSelector } from './BoardSelector';
import { CreateBoardDialog } from './CreateBoardDialog';
import { BoardSettingsModal } from './BoardSettingsModal';
import { ListEditDialog } from './ListEditDialog';
import { GitLabFilters } from '../../utils/GitLabFilters';
import './KanbanView.css';

export function KanbanView() {
  // Get shared data from context
  const {
    tasks: allTasks,
    filterOptions,
    serverFilterOptions,
    showToast,
    currentConfig,
    proxyConfig,
  } = useGitLabData();

  // Board management state from hook
  const {
    boards,
    currentBoard,
    loading: boardsLoading,
    saving: boardsSaving,
    error: boardsError,
    createBoard,
    updateBoard,
    deleteBoard,
    selectBoard,
    addList,
    updateList,
  } = useIssueBoard({
    proxyConfig,
    fullPath: currentConfig?.fullPath || '',
    isGroup: currentConfig?.type === 'group',
    autoLoad: !!proxyConfig && !!currentConfig?.fullPath,
  });

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

  // Get available labels for list editing
  const availableLabels = useMemo(() => {
    return (serverFilterOptions?.labels || []).map(
      (label) => label.title || label.name
    );
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
    // Only include issues (not milestones)
    const issuesOnly = tasksWithPriority.filter(
      (task) => task.$isIssue || task._gitlab?.type === 'issue'
    );
    return GitLabFilters.applyFilters(issuesOnly, filterOptions);
  }, [tasksWithPriority, filterOptions]);

  // Handle card double-click (open editor)
  const handleCardDoubleClick = useCallback(
    (task) => {
      showToast(
        `Opening editor for #${task._gitlab?.iid || task.id}...`,
        'info'
      );
      // TODO: Implement editor integration
    },
    [showToast]
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
    [createBoard, showToast]
  );

  const handleSaveBoard = useCallback(
    async (updatedBoard) => {
      await updateBoard(updatedBoard);
      setShowSettingsModal(false);
      showToast('Board settings saved', 'success');
    },
    [updateBoard, showToast]
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
    [editingList, addList, updateList, showToast]
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
        {!currentBoard ? (
          renderEmptyState()
        ) : (
          <KanbanBoard
            board={currentBoard}
            tasks={filteredTasks}
            labelColorMap={labelColorMap}
            labelPriorityMap={labelPriorityMap}
            onCardDoubleClick={handleCardDoubleClick}
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
    </div>
  );
}
