// src/components/KanbanView/KanbanBoardDnd.jsx

/**
 * KanbanBoardDnd
 *
 * Wrapper component that provides DnD context for the Kanban board.
 * Handles drag events and coordinates with API operations.
 *
 * Note: This component manages drag state (activeTask, sourceListId, overListId)
 * and passes them to KanbanBoard for visual feedback. The actual API operations
 * are handled by the parent component via callback props.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanBoard } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';
import './KanbanBoardDnd.css';

/**
 * Custom collision detection that prefers pointerWithin for containers
 * and closestCorners for cards.
 *
 * This provides better UX when dragging between lists since it detects
 * which list the pointer is actually over, rather than just the closest corner.
 */
function customCollisionDetection(args) {
  // First check if pointer is within a droppable
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  // Fallback to closestCorners
  return closestCorners(args);
}

/**
 * Get list info from list ID
 * @param {string} listId - The list ID
 * @param {Object} board - The board configuration
 * @returns {{ type: 'others'|'closed'|'regular', labels: string[] }}
 */
function getListInfo(listId, board) {
  if (listId === '__others__') {
    return { type: 'others', labels: [] };
  }
  if (listId === '__closed__') {
    return { type: 'closed', labels: [] };
  }
  const list = board?.lists?.find((l) => l.id === listId);
  return { type: 'regular', labels: list?.labels || [] };
}

/**
 * Find which list a task belongs to
 * @param {string|number} taskId - The task ID to find
 * @param {Object} board - The board configuration
 * @param {Array} tasks - All tasks
 * @returns {string|null} - The list ID or null if not found
 */
function findTaskListId(taskId, board, tasks) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  // Check if closed
  if (task.state === 'closed' || task._gitlab?.state === 'closed') {
    return '__closed__';
  }

  const taskLabels = task.labels ? task.labels.split(', ').filter(Boolean) : [];

  // Check each regular list (uses AND logic - task must have ALL list labels)
  for (const list of board?.lists || []) {
    if (list.labels.every((label) => taskLabels.includes(label))) {
      return list.id;
    }
  }

  // Default to Others if no list matches
  return '__others__';
}

/**
 * Check if a list allows same-list drag (manual sorting)
 * Uses current sort (including temporary overrides) not just default sort.
 * @param {string} listId - The list ID
 * @param {Object} board - The board configuration
 * @param {Object} sortOverrides - Temporary sort overrides from KanbanBoard state
 * @returns {boolean}
 */
function isListDragEnabled(listId, board, sortOverrides = {}) {
  // Check for temporary override first
  const override = sortOverrides[listId];
  if (override?.sortBy) {
    return override.sortBy === 'position';
  }

  // Fall back to default sort from board config
  if (listId === '__others__') {
    return (board?.othersSortBy || 'position') === 'position';
  }
  if (listId === '__closed__') {
    return (board?.closedSortBy || 'position') === 'position';
  }
  const list = board?.lists?.find((l) => l.id === listId);
  return (list?.sortBy || 'position') === 'position';
}

export function KanbanBoardDnd({
  board,
  tasks,
  childTasksMap,
  labelColorMap,
  onCardDoubleClick,
  onSameListReorder,
  onCrossListDrag,
}) {
  // Configure sensors with activation constraint
  // Require 5px of movement before drag starts, allowing clicks to work
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    }),
  );

  // Temporary sort overrides per list (not persisted to config)
  // Map of listId -> { sortBy, sortOrder }
  // Lifted from KanbanBoard to allow drag logic to access current sort state
  const [sortOverrides, setSortOverrides] = useState({});

  // Reset sort overrides when board changes
  useEffect(() => {
    setSortOverrides({});
  }, [board?.id]);

  // Drag state
  const [activeTask, setActiveTask] = useState(null);
  const [activeListId, setActiveListId] = useState(null);
  const [overListId, setOverListId] = useState(null);

  // Handle drag start
  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      const task = tasks.find((t) => t.id === active.id);
      if (task) {
        setActiveTask(task);
        const listId = findTaskListId(active.id, board, tasks);
        setActiveListId(listId);
      }
    },
    [tasks, board],
  );

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event) => {
    const { over } = event;
    if (over) {
      // Get the list ID from the over element
      // Cards pass listId in their data, lists use their ID directly
      const listId = over.data?.current?.listId || over.id;
      setOverListId(listId);
    } else {
      setOverListId(null);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;

      // Capture current state before resetting (for async operations)
      const currentActiveListId = activeListId;

      // Reset visual state immediately for responsive UI
      setActiveTask(null);
      setActiveListId(null);
      setOverListId(null);

      if (!over || !currentActiveListId) {
        return;
      }

      // Get target list ID
      const targetListId = over.data?.current?.listId || over.id;
      const targetTaskId = over.data?.current?.taskId || null;

      // Get list info for source and target
      const sourceList = getListInfo(currentActiveListId, board);
      const targetList = getListInfo(targetListId, board);

      // Same list reorder - only if list is in manual (position) sort mode
      if (currentActiveListId === targetListId && targetTaskId) {
        if (!isListDragEnabled(currentActiveListId, board, sortOverrides)) {
          // Non-manual sort mode - don't allow same-list reorder
          return;
        }
        if (onSameListReorder) {
          // Determine position based on drag direction (using delta.y from event)
          // If delta.y < 0, we're dragging upward, so place 'before' target
          // If delta.y >= 0, we're dragging downward, so place 'after' target
          const delta = event.delta;
          const position = delta && delta.y < 0 ? 'before' : 'after';
          await onSameListReorder(active.id, targetTaskId, position);
        }
        return;
      }

      // Cross-list drag
      if (currentActiveListId !== targetListId) {
        if (onCrossListDrag) {
          await onCrossListDrag(
            active.id,
            sourceList.labels,
            targetList.labels,
            targetList.type,
          );
        }
      }
    },
    [activeListId, board, sortOverrides, onSameListReorder, onCrossListDrag],
  );

  // Handle drag cancel (e.g., pressing Escape)
  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setActiveListId(null);
    setOverListId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <KanbanBoard
        board={board}
        tasks={tasks}
        childTasksMap={childTasksMap}
        labelColorMap={labelColorMap}
        onCardDoubleClick={onCardDoubleClick}
        activeTaskId={activeTask?.id}
        overListId={overListId}
        sortOverrides={sortOverrides}
        onSortOverridesChange={setSortOverrides}
      />

      {/* Drag overlay - shows card preview during drag */}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <KanbanCard
            task={activeTask}
            labelColorMap={labelColorMap}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
