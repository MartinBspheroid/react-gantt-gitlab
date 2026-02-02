// src/components/KanbanView/KanbanView.jsx

/**
 * KanbanView
 *
 * Main Kanban view component. Consumes data from GitLabDataContext.
 * Displays issues in a board layout with customizable lists.
 */

import { useState, useMemo, useCallback } from 'react';
import { useGitLabData } from '../../contexts/GitLabDataContext';
import { KanbanBoard } from './KanbanBoard';
import { GitLabFilters } from '../../utils/GitLabFilters';
import { DEFAULT_BOARD_TEMPLATES } from '../../types/issueBoard';
import './KanbanView.css';

// Generate a simple UUID (for demo board)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Create a default demo board
function createDemoBoard() {
  const template = DEFAULT_BOARD_TEMPLATES.kanban;
  return {
    id: generateId(),
    name: template.name,
    lists: template.lists.map((list) => ({
      ...list,
      id: generateId(),
    })),
    showOthers: true,
    showClosed: true,
  };
}

export function KanbanView() {
  // Get shared data from context
  const {
    tasks: allTasks,
    filterOptions,
    serverFilterOptions,
    showToast,
  } = useGitLabData();

  // Current board (Phase 3 will add board selection)
  // For now, use a demo board
  const [currentBoard] = useState(() => createDemoBoard());

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
      (task) => task.$isIssue || task._gitlab?.type === 'issue',
    );
    return GitLabFilters.applyFilters(issuesOnly, filterOptions);
  }, [tasksWithPriority, filterOptions]);

  // Handle card double-click (open editor)
  // TODO: Phase 2 will integrate with shared Editor
  const handleCardDoubleClick = useCallback(
    (task) => {
      showToast(
        `Opening editor for #${task._gitlab?.iid || task.id}...`,
        'info',
      );
      // TODO: Implement editor integration
    },
    [showToast],
  );

  return (
    <div className="kanban-view">
      {/* Board Header - TODO: Phase 3 will add BoardSelector */}
      <div className="kanban-view-header">
        <div className="kanban-view-board-name">
          <i className="fas fa-columns" />
          <span>{currentBoard?.name || 'Kanban Board'}</span>
        </div>
        <div className="kanban-view-stats">
          <span>{filteredTasks.length} issues</span>
        </div>
      </div>

      {/* Board Content */}
      <div className="kanban-view-content">
        <KanbanBoard
          board={currentBoard}
          tasks={filteredTasks}
          labelColorMap={labelColorMap}
          labelPriorityMap={labelPriorityMap}
          onCardDoubleClick={handleCardDoubleClick}
        />
      </div>
    </div>
  );
}
