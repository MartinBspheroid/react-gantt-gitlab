# Phase 2: Kanban 基礎元件 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 Kanban 視圖的基礎元件（KanbanView, KanbanBoard, KanbanList, KanbanCard），實作 Board 顯示邏輯和 ViewSwitcher 切換。

**Architecture:** KanbanView 消費 GitLabDataContext 的 tasks，根據 Board 定義將 issues 分配到各 List。每個 List 根據 labels 篩選 issues（AND 邏輯）。特殊 List（Others, Closed）固定在首尾位置。

**Tech Stack:** React, TypeScript, CSS, Font Awesome icons, useGitLabData hook

---

## 前置準備

**安裝依賴（Phase 4 會用到，但先安裝）：**

```bash
cd /Users/farllee/vibecoding-project/react-gantt-gitlab/.worktrees/feature-issue-board-kanban
npm install @dnd-kit/core @dnd-kit/sortable uuid
```

---

## Task 1: 建立 KanbanCard 元件

**Files:**

- Create: `src/components/KanbanView/KanbanCard.jsx`
- Create: `src/components/KanbanView/KanbanCard.css`

**Step 1: 建立 KanbanCard.jsx**

```jsx
// src/components/KanbanView/KanbanCard.jsx

/**
 * KanbanCard
 *
 * Displays a single issue as a compact card in the Kanban board.
 * Shows: ID, title, assignees, labels, task completion, due date
 */

import './KanbanCard.css';

/**
 * Format due date for display
 * @param {Date|string|null} dueDate - The due date
 * @returns {{ text: string, isOverdue: boolean }}
 */
function formatDueDate(dueDate) {
  if (!dueDate) return { text: '', isOverdue: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'today', isOverdue: false };
  } else {
    return { text: `${diffDays}d`, isOverdue: false };
  }
}

/**
 * Parse labels string to array
 * @param {string} labelsStr - Comma-separated labels
 * @returns {string[]}
 */
function parseLabels(labelsStr) {
  if (!labelsStr) return [];
  return labelsStr.split(', ').filter(Boolean);
}

/**
 * Parse assignees string to array
 * @param {string} assigneesStr - Comma-separated assignees
 * @returns {string[]}
 */
function parseAssignees(assigneesStr) {
  if (!assigneesStr) return [];
  return assigneesStr.split(', ').filter(Boolean);
}

export function KanbanCard({
  task,
  labelColorMap,
  onDoubleClick,
  maxLabels = 3,
  maxAssignees = 2,
}) {
  const labels = parseLabels(task.labels);
  const assignees = parseAssignees(task.assigned);
  const dueInfo = formatDueDate(task.end);

  // Task completion status from GitLab
  const taskCompletion = task._gitlab?.taskCompletionStatus;
  const hasTaskCompletion = taskCompletion && taskCompletion.count > 0;

  // Calculate visible labels and overflow
  const visibleLabels = labels.slice(0, maxLabels);
  const overflowLabels = labels.length - maxLabels;

  // Calculate visible assignees and overflow
  const visibleAssignees = assignees.slice(0, maxAssignees);
  const overflowAssignees = assignees.length - maxAssignees;

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDoubleClick?.(task);
  };

  return (
    <div
      className="kanban-card"
      onDoubleClick={handleDoubleClick}
      data-task-id={task.id}
    >
      {/* Issue ID and Title */}
      <div className="kanban-card-header">
        <span className="kanban-card-id">#{task._gitlab?.iid || task.id}</span>
        <span className="kanban-card-title">{task.text}</span>
      </div>

      {/* Assignees */}
      {assignees.length > 0 && (
        <div className="kanban-card-assignees">
          <i className="fas fa-user kanban-card-icon" />
          <span className="kanban-card-assignees-list">
            {visibleAssignees.join(', ')}
            {overflowAssignees > 0 && (
              <span className="kanban-card-overflow">+{overflowAssignees}</span>
            )}
          </span>
        </div>
      )}

      {/* Labels */}
      {labels.length > 0 && (
        <div className="kanban-card-labels">
          <i className="fas fa-tag kanban-card-icon" />
          <span className="kanban-card-labels-list">
            {visibleLabels.map((label, index) => (
              <span
                key={label}
                className="kanban-card-label"
                style={{
                  backgroundColor: labelColorMap?.get(label) || '#6b7280',
                }}
              >
                {label}
              </span>
            ))}
            {overflowLabels > 0 && (
              <span className="kanban-card-overflow">+{overflowLabels}</span>
            )}
          </span>
        </div>
      )}

      {/* Bottom row: Task completion and Due date */}
      {(hasTaskCompletion || dueInfo.text) && (
        <div className="kanban-card-footer">
          {hasTaskCompletion && (
            <span className="kanban-card-tasks">
              <i className="fas fa-check-square kanban-card-icon" />
              {taskCompletion.completedCount}/{taskCompletion.count}
            </span>
          )}
          {dueInfo.text && (
            <span
              className={`kanban-card-due ${dueInfo.isOverdue ? 'kanban-card-due-overdue' : ''}`}
            >
              {dueInfo.isOverdue ? '-' : ''}
              {dueInfo.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: 建立 KanbanCard.css**

```css
/* src/components/KanbanView/KanbanCard.css */

.kanban-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.3;
  transition: box-shadow 0.15s ease;
}

.kanban-card:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.kanban-card-header {
  margin-bottom: 4px;
}

.kanban-card-id {
  color: #6b7280;
  font-weight: 500;
  margin-right: 4px;
}

.kanban-card-title {
  color: #1f2937;
  word-break: break-word;
}

.kanban-card-icon {
  color: #9ca3af;
  font-size: 10px;
  margin-right: 4px;
  width: 12px;
  text-align: center;
}

.kanban-card-assignees,
.kanban-card-labels {
  display: flex;
  align-items: flex-start;
  margin-top: 4px;
  color: #6b7280;
}

.kanban-card-assignees-list,
.kanban-card-labels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}

.kanban-card-label {
  display: inline-block;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 10px;
  color: white;
  white-space: nowrap;
}

.kanban-card-overflow {
  color: #9ca3af;
  font-size: 10px;
  margin-left: 2px;
}

.kanban-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  color: #6b7280;
}

.kanban-card-tasks {
  display: flex;
  align-items: center;
}

.kanban-card-due {
  font-size: 11px;
}

.kanban-card-due-overdue {
  color: #dc2626;
  font-weight: 500;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanCard.jsx src/components/KanbanView/KanbanCard.css
git commit -m "feat(kanban): add KanbanCard component

- Compact card design with ID, title, assignees, labels
- Task completion status and due date display
- Overflow indicators (+N) for labels and assignees
- Overdue dates shown in red

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立 KanbanList 元件

**Files:**

- Create: `src/components/KanbanView/KanbanList.jsx`
- Create: `src/components/KanbanView/KanbanList.css`

**Step 1: 建立 KanbanList.jsx**

```jsx
// src/components/KanbanView/KanbanList.jsx

/**
 * KanbanList
 *
 * A single column/list in the Kanban board.
 * Displays a header with count and contains KanbanCard items.
 */

import { useMemo } from 'react';
import { KanbanCard } from './KanbanCard';
import './KanbanList.css';

/**
 * Sort tasks based on sortBy and sortOrder
 */
function sortTasks(tasks, sortBy, sortOrder, labelPriorityMap) {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'position':
        // Use relative_position from GitLab, fallback to id
        const posA = a._gitlab?.relativePosition ?? a.id;
        const posB = b._gitlab?.relativePosition ?? b.id;
        comparison = posA - posB;
        break;

      case 'due_date':
        // Null dates go to the end
        const dateA = a.end ? new Date(a.end).getTime() : Infinity;
        const dateB = b.end ? new Date(b.end).getTime() : Infinity;
        comparison = dateA - dateB;
        break;

      case 'created_at':
        const createdA = a._gitlab?.createdAt
          ? new Date(a._gitlab.createdAt).getTime()
          : 0;
        const createdB = b._gitlab?.createdAt
          ? new Date(b._gitlab.createdAt).getTime()
          : 0;
        comparison = createdA - createdB;
        break;

      case 'label_priority':
        // Use labelPriority computed in parent, fallback to MAX_SAFE_INTEGER
        const priorityA = a.labelPriority ?? Number.MAX_SAFE_INTEGER;
        const priorityB = b.labelPriority ?? Number.MAX_SAFE_INTEGER;
        comparison = priorityA - priorityB;
        break;

      case 'id':
      default:
        const idA = a._gitlab?.iid ?? a.id;
        const idB = b._gitlab?.iid ?? b.id;
        comparison = idA - idB;
        break;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

export function KanbanList({
  id,
  name,
  tasks,
  sortBy = 'position',
  sortOrder = 'asc',
  labelColorMap,
  labelPriorityMap,
  isSpecial = false, // true for Others and Closed lists
  specialType = null, // 'others' | 'closed'
  onCardDoubleClick,
}) {
  // Sort tasks
  const sortedTasks = useMemo(
    () => sortTasks(tasks, sortBy, sortOrder, labelPriorityMap),
    [tasks, sortBy, sortOrder, labelPriorityMap],
  );

  // Determine header class based on special type
  const headerClass = specialType
    ? `kanban-list-header kanban-list-header-${specialType}`
    : 'kanban-list-header';

  return (
    <div className="kanban-list" data-list-id={id}>
      {/* List Header */}
      <div className={headerClass}>
        <span className="kanban-list-name">{name}</span>
        <span className="kanban-list-count">{tasks.length}</span>
      </div>

      {/* List Content */}
      <div className="kanban-list-content">
        {sortedTasks.length === 0 ? (
          <div className="kanban-list-empty">No issues</div>
        ) : (
          sortedTasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              labelColorMap={labelColorMap}
              onDoubleClick={onCardDoubleClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: 建立 KanbanList.css**

```css
/* src/components/KanbanView/KanbanList.css */

.kanban-list {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 300px;
  background: #f3f4f6;
  border-radius: 6px;
  overflow: hidden;
}

.kanban-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #e5e7eb;
  border-bottom: 1px solid #d1d5db;
}

.kanban-list-header-others {
  background: #fef3c7;
  border-bottom-color: #fcd34d;
}

.kanban-list-header-closed {
  background: #dbeafe;
  border-bottom-color: #93c5fd;
}

.kanban-list-name {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.kanban-list-count {
  background: #9ca3af;
  color: white;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.kanban-list-header-others .kanban-list-count {
  background: #d97706;
}

.kanban-list-header-closed .kanban-list-count {
  background: #3b82f6;
}

.kanban-list-content {
  flex: 1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  min-height: 100px;
}

.kanban-list-empty {
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
  padding: 20px 10px;
  font-style: italic;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanList.jsx src/components/KanbanView/KanbanList.css
git commit -m "feat(kanban): add KanbanList component

- List header with name and count badge
- Sorting by position, due_date, created_at, label_priority, id
- Special styling for Others (yellow) and Closed (blue) lists
- Empty state placeholder

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立 KanbanBoard 元件

**Files:**

- Create: `src/components/KanbanView/KanbanBoard.jsx`
- Create: `src/components/KanbanView/KanbanBoard.css`

**Step 1: 建立 KanbanBoard.jsx**

```jsx
// src/components/KanbanView/KanbanBoard.jsx

/**
 * KanbanBoard
 *
 * Container for all KanbanLists. Handles issue distribution to lists
 * based on label matching (AND logic).
 */

import { useMemo } from 'react';
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
  labelColorMap,
  labelPriorityMap,
  onCardDoubleClick,
}) {
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
      result.push({
        id: '__others__',
        name: 'Others',
        tasks: othersTasks,
        sortBy: 'position',
        sortOrder: 'asc',
        isSpecial: true,
        specialType: 'others',
      });
    }

    // Regular lists
    for (const list of board.lists) {
      const listTasks = openTasks.filter((task) =>
        issueMatchesList(task, list.labels),
      );
      result.push({
        ...list,
        tasks: listTasks,
        isSpecial: false,
        specialType: null,
      });
    }

    // Closed list (last position if enabled)
    if (board.showClosed) {
      result.push({
        id: '__closed__',
        name: 'Closed',
        tasks: closedTasks,
        sortBy: 'position',
        sortOrder: 'asc',
        isSpecial: true,
        specialType: 'closed',
      });
    }

    return result;
  }, [board, tasks]);

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
    <div className="kanban-board">
      {distributedLists.map((list) => (
        <KanbanList
          key={list.id}
          id={list.id}
          name={list.name}
          tasks={list.tasks}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          labelColorMap={labelColorMap}
          labelPriorityMap={labelPriorityMap}
          isSpecial={list.isSpecial}
          specialType={list.specialType}
          onCardDoubleClick={onCardDoubleClick}
        />
      ))}
    </div>
  );
}
```

**Step 2: 建立 KanbanBoard.css**

```css
/* src/components/KanbanView/KanbanBoard.css */

.kanban-board {
  display: flex;
  gap: 8px;
  padding: 8px;
  height: 100%;
  overflow-x: auto;
  align-items: flex-start;
}

.kanban-board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
  text-align: center;
  padding: 40px;
}

.kanban-board-empty i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d1d5db;
}

.kanban-board-empty p {
  margin: 4px 0;
  font-size: 16px;
}

.kanban-board-empty-hint {
  font-size: 13px;
  color: #9ca3af;
}
```

**Step 3: Commit**

```bash
git add src/components/KanbanView/KanbanBoard.jsx src/components/KanbanView/KanbanBoard.css
git commit -m "feat(kanban): add KanbanBoard component

- Distributes tasks to lists based on label matching (AND logic)
- Others list: issues not matching any list (leftmost)
- Closed list: closed issues (rightmost)
- Empty state when no board selected

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立 KanbanView 元件

**Files:**

- Create: `src/components/KanbanView/KanbanView.jsx`
- Create: `src/components/KanbanView/KanbanView.css`
- Create: `src/components/KanbanView/index.js`

**Step 1: 建立 KanbanView.jsx**

```jsx
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
```

**Step 2: 建立 KanbanView.css**

```css
/* src/components/KanbanView/KanbanView.css */

.kanban-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9fafb;
}

.kanban-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.kanban-view-board-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #374151;
}

.kanban-view-board-name i {
  color: #6b7280;
}

.kanban-view-stats {
  font-size: 12px;
  color: #6b7280;
}

.kanban-view-content {
  flex: 1;
  overflow: hidden;
}
```

**Step 3: 建立 index.js**

```javascript
// src/components/KanbanView/index.js

export { KanbanView } from './KanbanView';
export { KanbanBoard } from './KanbanBoard';
export { KanbanList } from './KanbanList';
export { KanbanCard } from './KanbanCard';
```

**Step 4: Commit**

```bash
git add src/components/KanbanView/
git commit -m "feat(kanban): add KanbanView component

- Main Kanban view consuming GitLabDataContext
- Applies same client-side filters as Gantt view
- Computes label priority for sorting
- Demo board with default template (To Do / In Progress / Done)
- Header with board name and issue count

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立 ViewSwitcher 元件

**Files:**

- Create: `src/components/GitLabWorkspace/ViewSwitcher.jsx`
- Create: `src/components/GitLabWorkspace/ViewSwitcher.css`

**Step 1: 建立 ViewSwitcher.jsx**

```jsx
// src/components/GitLabWorkspace/ViewSwitcher.jsx

/**
 * ViewSwitcher
 *
 * Toggle between Gantt and Kanban views.
 */

import './ViewSwitcher.css';

export function ViewSwitcher({ activeView, onViewChange }) {
  return (
    <div className="view-switcher">
      <button
        className={`view-switcher-btn ${activeView === 'gantt' ? 'active' : ''}`}
        onClick={() => onViewChange('gantt')}
        title="Gantt View"
      >
        <i className="fas fa-bars-staggered" />
        <span>Gantt</span>
      </button>
      <button
        className={`view-switcher-btn ${activeView === 'kanban' ? 'active' : ''}`}
        onClick={() => onViewChange('kanban')}
        title="Kanban View"
      >
        <i className="fas fa-columns" />
        <span>Kanban</span>
      </button>
    </div>
  );
}
```

**Step 2: 建立 ViewSwitcher.css**

```css
/* src/components/GitLabWorkspace/ViewSwitcher.css */

.view-switcher {
  display: flex;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.view-switcher-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-switcher-btn:hover {
  color: #374151;
  background: #e5e7eb;
}

.view-switcher-btn.active {
  color: #1f2937;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.view-switcher-btn i {
  font-size: 12px;
}
```

**Step 3: Commit**

```bash
git add src/components/GitLabWorkspace/ViewSwitcher.jsx src/components/GitLabWorkspace/ViewSwitcher.css
git commit -m "feat(workspace): add ViewSwitcher component

- Toggle buttons for Gantt and Kanban views
- Active state styling
- Font Awesome icons

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 整合 ViewSwitcher 和 KanbanView 到 GitLabWorkspace

**Files:**

- Modify: `src/components/GitLabWorkspace/GitLabWorkspace.jsx`

**Step 1: 更新 GitLabWorkspace.jsx**

```jsx
// src/components/GitLabWorkspace/GitLabWorkspace.jsx

/**
 * GitLabWorkspace
 *
 * Main container component that wraps Gantt and Kanban views.
 * Provides shared data context and view switching.
 */

import { useState } from 'react';
import { GitLabDataProvider } from '../../contexts/GitLabDataContext';
import { GanttView } from '../GanttView/GanttView';
import { KanbanView } from '../KanbanView/KanbanView';
import { ViewSwitcher } from './ViewSwitcher';
import './GitLabWorkspace.css';

export function GitLabWorkspace({ initialConfigId, autoSync = false }) {
  const [activeView, setActiveView] = useState('gantt'); // 'gantt' | 'kanban'

  return (
    <GitLabDataProvider initialConfigId={initialConfigId} autoSync={autoSync}>
      <div className="gitlab-workspace">
        {/* View Switcher in header area */}
        <div className="gitlab-workspace-header">
          <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* View Content */}
        <div className="gitlab-workspace-content">
          {activeView === 'gantt' && <GanttView />}
          {activeView === 'kanban' && <KanbanView />}
        </div>
      </div>
    </GitLabDataProvider>
  );
}
```

**Step 2: 更新 GitLabWorkspace.css**

```css
/* src/components/GitLabWorkspace/GitLabWorkspace.css */

.gitlab-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.gitlab-workspace-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  z-index: 10;
}

.gitlab-workspace-content {
  flex: 1;
  overflow: hidden;
}
```

**Step 3: 驗證 build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/GitLabWorkspace/
git commit -m "feat(workspace): integrate ViewSwitcher and KanbanView

- Add ViewSwitcher to workspace header
- Enable Gantt/Kanban view switching
- Update CSS for header layout

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 更新 exports

**Files:**

- Modify: `src/index.js`

**Step 1: 更新 src/index.js**

加入 KanbanView exports：

```javascript
// 在現有 exports 之後加入：

// KanbanView exports
export {
  KanbanView,
  KanbanBoard,
  KanbanList,
  KanbanCard,
} from './components/KanbanView';

// ViewSwitcher export
export { ViewSwitcher } from './components/GitLabWorkspace/ViewSwitcher';
```

**Step 2: 驗證 build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: export KanbanView components and ViewSwitcher

- Export KanbanView, KanbanBoard, KanbanList, KanbanCard
- Export ViewSwitcher

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 手動測試

**Step 1: 啟動開發伺服器**

Run: `npm run dev`

**Step 2: 測試清單**

在瀏覽器中測試：

1. [ ] ViewSwitcher 顯示在頁面頂部
2. [ ] 點擊 "Gantt" 切換到 Gantt 視圖
3. [ ] 點擊 "Kanban" 切換到 Kanban 視圖
4. [ ] Kanban 視圖顯示 Board header（名稱 + issue 數量）
5. [ ] Lists 正確顯示（Others, To Do, In Progress, Done, Closed）
6. [ ] Issues 根據 labels 正確分配到各 List
7. [ ] KanbanCard 顯示 ID、標題、assignees、labels、due date
8. [ ] 超過限制的 labels/assignees 顯示 +N
9. [ ] 過期的 due date 顯示紅色
10. [ ] 雙擊卡片顯示 toast（暫時）
11. [ ] 切換視圖時 filter 狀態保持一致

**Step 3: 記錄測試結果**

如果發現問題，記錄並修復後再繼續。

---

## Task 9: 最終 commit

**Step 1: 確保所有變更已 commit**

Run: `git status`

**Step 2: 如有遺漏，建立總結 commit**

```bash
git add -A
git commit -m "chore: Phase 2 complete - Kanban foundation

Phase 2 完成摘要：
- KanbanCard: 緊湊卡片設計
- KanbanList: List 欄位含排序
- KanbanBoard: Board 容器含 issue 分配
- KanbanView: Kanban 主視圖
- ViewSwitcher: Gantt/Kanban 切換
- 整合到 GitLabWorkspace

下一步: Phase 3 - Board 管理

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 風險與注意事項

1. **Issue 分類邏輯** - labels AND 邏輯可能導致 issue 出現在多個 list，設計上已處理（issue 會出現在第一個匹配的 list）
2. **Demo Board** - Phase 2 使用硬編碼 demo board，Phase 3 會加入 Board 管理
3. **Editor 整合** - 雙擊開啟 Editor 的完整實作留到 Phase 3
4. **拖曳功能** - Phase 4 才實作，目前只有顯示功能

---

## 執行選項

Plan complete and saved to `docs/plans/2026-01-30-phase2-kanban-foundation.md`.

**兩個執行選項：**

**1. Subagent-Driven (this session)** - 在此 session 中逐個 task 執行，每個 task 由 fresh subagent 處理，中間有 code review

**2. Parallel Session (separate)** - 開啟新 session 在 worktree 中，使用 executing-plans skill 批次執行

**你要選擇哪個方式？**
