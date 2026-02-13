// @ts-nocheck
// src/components/KanbanView/KanbanCard.jsx

/**
 * KanbanCard
 *
 * Displays a single issue as a compact card in the Kanban board.
 * Shows: ID, title, assignees, labels, task completion, due date
 *
 * Supports drag-and-drop via @dnd-kit/sortable.
 * - listId: The column/list this card belongs to (for drag data)
 * - isDragging: External dragging state (e.g., from parent)
 * - isDragOverlay: True when this card is rendered as a drag overlay
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { openSourceLink } from '../../utils/LinkUtils';
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
  childTasks = [], // Child tasks (workItemType=Task) to display
  maxLabels = 2,
  maxAssignees = 2,
  listId,
  isDragging = false,
  isDragOverlay = false,
}) {
  // Setup sortable hook for drag-and-drop
  // Note: We always enable dragging to support cross-list drag.
  // Same-list reorder restriction is handled in KanbanBoardDnd.handleDragEnd
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: { taskId: task.id, listId },
    // Don't use disabled here - it would block cross-list drag too
  });

  // Build transform style for drag animation
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Build dynamic className
  const classNames = ['kanban-card'];
  if (isDragging || isSortableDragging) {
    classNames.push('kanban-card-dragging');
  }
  if (isDragOverlay) {
    classNames.push('drag-overlay');
  }

  const labels = parseLabels(task.labels);
  const assignees = parseAssignees(task.assigned);
  const dueInfo = formatDueDate(task.end);

  // Child tasks (work items with workItemType='Task')
  const hasChildTasks = childTasks && childTasks.length > 0;

  // Calculate visible labels and overflow
  const visibleLabels = labels.slice(0, maxLabels);
  const overflowLabels = labels.length - maxLabels;

  // Calculate visible assignees and overflow
  const visibleAssignees = assignees.slice(0, maxAssignees);
  const overflowAssignees = assignees.length - maxAssignees;

  // Handle click on ID to open source link
  // Also handle mouseDown to prevent drag from starting
  const handleIdClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSourceLink(task);
  };

  const handleIdMouseDown = (e) => {
    // Stop propagation to prevent drag from starting
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames.join(' ')}
      data-task-id={task.id}
      {...attributes}
      {...listeners}
    >
      {/* Issue ID, Due Date, and Title */}
      <div className="kanban-card-header">
        <div className="kanban-card-header-row">
          <span
            className="kanban-card-id"
            onClick={handleIdClick}
            onMouseDown={handleIdMouseDown}
            onTouchStart={handleIdMouseDown}
            title="Open in source"
          >
            #{task.issueId || task.id}
          </span>
          {dueInfo.text && (
            <span
              className={`kanban-card-due ${dueInfo.isOverdue ? 'kanban-card-due-overdue' : ''}`}
            >
              {dueInfo.isOverdue ? '-' : ''}
              {dueInfo.text}
            </span>
          )}
        </div>
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
            {visibleLabels.map((label) => (
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

      {/* Child Tasks */}
      {hasChildTasks && (
        <div className="kanban-card-tasks">
          {childTasks.map((childTask) => (
            <div
              key={childTask.id}
              className={`kanban-card-task-item ${childTask.state === 'closed' ? 'kanban-card-task-done' : ''}`}
            >
              <i
                className={`fas ${childTask.state === 'closed' ? 'fa-check-square' : 'fa-square'} kanban-card-icon`}
              />
              <span className="kanban-card-task-title">{childTask.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
