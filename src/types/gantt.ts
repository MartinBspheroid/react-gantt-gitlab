import type { ITask } from '@svar-ui/gantt-store';
import type { ISplitTaskPart } from '../pro-features/types';

/**
 * Extended GanttTask interface with all custom properties used across the application.
 * This eliminates the need for 'as any' type assertions when accessing custom fields.
 *
 * @example
 * // Instead of:
 * const epicId = (task as any).epicId;
 *
 * // Use:
 * const epicId = (task as GanttTask).epicId;
 */
export interface GanttTask extends ITask {
  // GitLab/Azure DevOps specific fields
  /** Milestone IID (internal ID) for GitLab milestones */
  milestoneIid?: number;

  /** Epic parent ID for hierarchical epic relationships */
  epicParentId?: number;

  /** Epic ID for grouping tasks by epic */
  epicId?: number;

  /** Epic name for display purposes */
  epic?: string;

  /** Sprint/iteration name for display purposes */
  iteration?: string;

  /** Work item type (e.g., 'Issue', 'Task', 'Bug') */
  workItemType?: string;

  // Split task support
  /** Array of split task parts for segmented tasks */
  splitParts?: ISplitTaskPart[];

  // Grouping and metadata fields
  /** Flag indicating if task is a milestone summary */
  $isMilestone?: boolean;

  /** Flag indicating if task is an issue (as opposed to a task) */
  $isIssue?: boolean;

  /** Flag indicating if task is a group header */
  $groupHeader?: boolean;

  /** Group name for grouped views */
  $groupName?: string;

  /** Group index for ordering */
  $groupIndex?: number;

  /** Group type (e.g., 'assignee', 'epic', 'sprint') */
  $groupType?: string;

  /** Task count within a group */
  $taskCount?: number;

  /** Issue ID (used for milestone tasks) */
  issueId?: number | string;

  // Additional fields used in filters
  /** Additional metadata stored on tasks */
  _gitlab?: {
    type?: string;
    iid?: number;
    milestoneIid?: number;
    [key: string]: unknown;
  };
}

/**
 * Helper type to safely access extended task properties
 * Use this when you need to ensure a task has the extended fields
 */
export type ExtendedTask = GanttTask;

/**
 * Type guard to check if a task is a GanttTask with extended properties
 */
export function isGanttTask(task: ITask): task is GanttTask {
  return task !== null && typeof task === 'object' && 'id' in task;
}

/**
 * Helper function to safely cast an ITask to GanttTask
 * This is preferred over 'as any' or 'as GanttTask' assertions
 */
export function toGanttTask(task: ITask): GanttTask {
  return task as GanttTask;
}

/**
 * Helper function to safely access a property that might not exist on ITask
 * Returns undefined if the property doesn't exist
 */
export function getTaskProperty<T>(
  task: ITask,
  property: keyof GanttTask,
): T | undefined {
  return (task as GanttTask)[property] as T | undefined;
}
