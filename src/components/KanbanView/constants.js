// src/components/KanbanView/constants.js

/**
 * Shared constants for Kanban view components
 */

/**
 * Sort options for Kanban lists
 * Used by SortControl and ListEditDialog
 */
export const SORT_OPTIONS = [
  { value: 'position', label: 'Manual' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'created_at', label: 'Created' },
  { value: 'label_priority', label: 'Label Priority' },
  { value: 'title', label: 'Title' },
  { value: 'assignee', label: 'Assignee' },
];

/**
 * Sort order options
 */
export const SORT_ORDER_OPTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];
