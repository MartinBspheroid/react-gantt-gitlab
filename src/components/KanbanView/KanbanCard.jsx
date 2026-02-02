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
