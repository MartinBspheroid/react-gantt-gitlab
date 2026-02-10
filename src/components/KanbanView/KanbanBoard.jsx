// src/components/KanbanView/KanbanBoard.jsx

/**
 * KanbanBoard
 *
 * Container for all KanbanLists. Handles issue distribution to lists
 * based on label matching (AND logic).
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { KanbanList } from './KanbanList';
import './KanbanBoard.css';

/**
 * Check if an issue matches a list's label criteria (AND logic)
 * @param {Object} task - The task/issue
 * @param {string[]} listLabels - Labels the issue must have (all of them)
 * @returns {boolean}
 */
function issueMatchesList(task, listLabels) {
  if (!listLabels || listLabels.length === 0) return false;

  const taskLabels = task.labels ? task.labels.split(', ').filter(Boolean) : [];
  return listLabels.every((label) => taskLabels.includes(label));
}

/**
 * Check if an issue is "Others" (doesn't match any list)
 */
function isOthersIssue(task, lists) {
  return !lists.some((list) => issueMatchesList(task, list.labels));
}

/**
 * Check if an issue is closed
 */
function isClosedIssue(task) {
  return task.state === 'closed' || task._gitlab?.state === 'closed';
}

export function KanbanBoard({
  board,
  tasks,
  childTasksMap,
  labelColorMap,
  onCardDoubleClick,
  activeTaskId = null,
  overListId = null,
  // Temporary sort overrides - managed by parent (KanbanBoardDnd) for drag logic access
  sortOverrides = {},
  onSortOverridesChange,
}) {
  // Handle sort change from list header UI (temporary, not persisted)
  const handleListSortChange = useCallback(
    (listId, newSortBy, newSortOrder) => {
      onSortOverridesChange?.((prev) => ({
        ...prev,
        [listId]: { sortBy: newSortBy, sortOrder: newSortOrder },
      }));
    },
    [onSortOverridesChange],
  );

  // Middle mouse button panning
  const boardRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, scrollLeft: 0 });

  const handleMouseDown = useCallback((e) => {
    // Middle mouse button (button === 1)
    if (e.button !== 1) return;
    e.preventDefault();

    const board = boardRef.current;
    if (!board) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      scrollLeft: board.scrollLeft,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isPanning) return;

      const board = boardRef.current;
      if (!board) return;

      const dx = e.clientX - panStartRef.current.x;
      board.scrollLeft = panStartRef.current.scrollLeft - dx;
    },
    [isPanning],
  );

  const handleMouseUp = useCallback((e) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
  }, []);

  // Cleanup: stop panning when mouse is released anywhere or leaves window
  useEffect(() => {
    if (!isPanning) return;

    const stopPanning = () => setIsPanning(false);

    // Handle mouse up anywhere (including outside window when it returns)
    window.addEventListener('mouseup', stopPanning);
    // Handle mouse leaving the document
    document.addEventListener('mouseleave', stopPanning);
    // Handle window losing focus (e.g., user switches to another app)
    window.addEventListener('blur', stopPanning);

    return () => {
      window.removeEventListener('mouseup', stopPanning);
      document.removeEventListener('mouseleave', stopPanning);
      window.removeEventListener('blur', stopPanning);
    };
  }, [isPanning]);

  // Distribute tasks to lists
  const distributedLists = useMemo(() => {
    if (!board || !tasks) return [];

    const result = [];

    // Filter out closed issues first (they go to Closed list)
    const openTasks = tasks.filter((t) => !isClosedIssue(t));
    const closedTasks = tasks.filter((t) => isClosedIssue(t));

    // Others list (first position if enabled)
    if (board.showOthers) {
      const othersTasks = openTasks.filter((task) =>
        isOthersIssue(task, board.lists),
      );
      const defaultSortBy = board.othersSortBy || 'position';
      const defaultSortOrder = board.othersSortOrder || 'asc';
      const override = sortOverrides['__others__'];
      result.push({
        id: '__others__',
        name: 'Others',
        tasks: othersTasks,
        // Current sort (may be overridden temporarily)
        sortBy: override?.sortBy ?? defaultSortBy,
        sortOrder: override?.sortOrder ?? defaultSortOrder,
        // Default sort from config
        defaultSortBy,
        defaultSortOrder,
        isSpecial: true,
        specialType: 'others',
      });
    }

    // Regular lists
    for (const list of board.lists) {
      const listTasks = openTasks.filter((task) =>
        issueMatchesList(task, list.labels),
      );
      const defaultSortBy = list.sortBy || 'position';
      const defaultSortOrder = list.sortOrder || 'asc';
      const override = sortOverrides[list.id];
      result.push({
        ...list,
        tasks: listTasks,
        // Current sort (may be overridden temporarily)
        sortBy: override?.sortBy ?? defaultSortBy,
        sortOrder: override?.sortOrder ?? defaultSortOrder,
        // Default sort from config
        defaultSortBy,
        defaultSortOrder,
        isSpecial: false,
        specialType: null,
      });
    }

    // Closed list (last position if enabled)
    if (board.showClosed) {
      const defaultSortBy = board.closedSortBy || 'position';
      const defaultSortOrder = board.closedSortOrder || 'asc';
      const override = sortOverrides['__closed__'];
      result.push({
        id: '__closed__',
        name: 'Closed',
        tasks: closedTasks,
        // Current sort (may be overridden temporarily)
        sortBy: override?.sortBy ?? defaultSortBy,
        sortOrder: override?.sortOrder ?? defaultSortOrder,
        // Default sort from config
        defaultSortBy,
        defaultSortOrder,
        isSpecial: true,
        specialType: 'closed',
      });
    }

    return result;
  }, [board, tasks, sortOverrides]);

  if (!board) {
    return (
      <div className="kanban-board-empty">
        <i className="fas fa-columns" />
        <p>No board selected</p>
        <p className="kanban-board-empty-hint">
          Create a new board or select an existing one
        </p>
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      className={`kanban-board${isPanning ? ' kanban-board-panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {distributedLists.map((list) => (
        <KanbanList
          key={list.id}
          id={list.id}
          name={list.name}
          tasks={list.tasks}
          childTasksMap={childTasksMap}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          defaultSortBy={list.defaultSortBy}
          defaultSortOrder={list.defaultSortOrder}
          labelColorMap={labelColorMap}
          specialType={list.specialType}
          onCardDoubleClick={onCardDoubleClick}
          onSortChange={(newSortBy, newSortOrder) =>
            handleListSortChange(list.id, newSortBy, newSortOrder)
          }
          activeTaskId={activeTaskId}
          isOver={overListId === list.id}
          isDragEnabled={(list.sortBy || 'position') === 'position'}
        />
      ))}
    </div>
  );
}
