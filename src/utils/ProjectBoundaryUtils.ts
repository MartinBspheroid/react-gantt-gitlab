/**
 * Project Boundary Utilities
 *
 * Provides functions for calculating and managing project timeline boundaries.
 * Used by scheduling, critical path analysis, and visual boundary display.
 */

export interface IProjectBoundaries {
  projectStart: Date | null;
  projectEnd: Date | null;
}

export interface ITaskWithDates {
  start?: Date | null;
  end?: Date | null;
}

/**
 * Derive project boundaries from task data
 *
 * Calculates the earliest start and latest end dates from all tasks.
 * Used when projectStart/projectEnd are not explicitly provided.
 *
 * @param tasks - Array of tasks with start/end dates
 * @returns Object containing projectStart and projectEnd dates (or null if no valid dates)
 */
export function deriveBoundariesFromTasks(
  tasks: ITaskWithDates[],
): IProjectBoundaries {
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  for (const task of tasks) {
    if (task.start) {
      const startDate =
        task.start instanceof Date ? task.start : new Date(task.start);
      if (!earliestStart || startDate < earliestStart) {
        earliestStart = startDate;
      }
    }

    if (task.end) {
      const endDate = task.end instanceof Date ? task.end : new Date(task.end);
      if (!latestEnd || endDate > latestEnd) {
        latestEnd = endDate;
      }
    }
  }

  return {
    projectStart: earliestStart,
    projectEnd: latestEnd,
  };
}

/**
 * Resolve effective project boundaries
 *
 * Uses explicitly provided boundaries if available, otherwise derives from tasks.
 *
 * @param explicitStart - Explicitly set projectStart (optional)
 * @param explicitEnd - Explicitly set projectEnd (optional)
 * @param tasks - Array of tasks to derive boundaries from if not explicitly set
 * @returns Resolved project boundaries
 */
export function resolveProjectBoundaries(
  explicitStart: Date | null | undefined,
  explicitEnd: Date | null | undefined,
  tasks: ITaskWithDates[],
): IProjectBoundaries {
  const derived = deriveBoundariesFromTasks(tasks);

  return {
    projectStart:
      explicitStart instanceof Date ? explicitStart : derived.projectStart,
    projectEnd: explicitEnd instanceof Date ? explicitEnd : derived.projectEnd,
  };
}

/**
 * Check if a date is within project boundaries
 *
 * @param date - Date to check
 * @param boundaries - Project boundaries
 * @param includeEnd - Whether to include the end date as within bounds (default: true)
 * @returns true if date is within boundaries
 */
export function isWithinProjectBoundaries(
  date: Date,
  boundaries: IProjectBoundaries,
  includeEnd: boolean = true,
): boolean {
  const { projectStart, projectEnd } = boundaries;

  if (projectStart && date < projectStart) {
    return false;
  }

  if (projectEnd) {
    if (includeEnd) {
      return date <= projectEnd;
    }
    return date < projectEnd;
  }

  return true;
}

/**
 * Enforce projectStart boundary for scheduling
 *
 * If a task's start date is before projectStart, adjust it to projectStart.
 * Used by auto-scheduling to ensure tasks don't start before project start.
 *
 * @param taskStart - Proposed task start date
 * @param projectStart - Project start boundary (optional)
 * @returns Adjusted start date that respects projectStart boundary
 */
export function enforceProjectStartBoundary(
  taskStart: Date,
  projectStart: Date | null | undefined,
): Date {
  if (!projectStart) {
    return taskStart;
  }

  const boundary =
    projectStart instanceof Date ? projectStart : new Date(projectStart);
  return taskStart < boundary ? new Date(boundary) : new Date(taskStart);
}

/**
 * Enforce projectEnd boundary for scheduling
 *
 * If a task's end date is after projectEnd, adjust it to projectEnd.
 * Used by critical path backward pass to respect project end deadline.
 *
 * @param taskEnd - Proposed task end date
 * @param projectEnd - Project end boundary (optional)
 * @returns Adjusted end date that respects projectEnd boundary
 */
export function enforceProjectEndBoundary(
  taskEnd: Date,
  projectEnd: Date | null | undefined,
): Date {
  if (!projectEnd) {
    return taskEnd;
  }

  const boundary =
    projectEnd instanceof Date ? projectEnd : new Date(projectEnd);
  return taskEnd > boundary ? new Date(boundary) : new Date(taskEnd);
}

/**
 * Calculate slack time for a task relative to project boundaries
 *
 * Slack (float) is the amount of time a task can be delayed without affecting
 * the project end date.
 *
 * @param taskEnd - Task's end date
 * @param projectEnd - Project end boundary
 * @returns Slack time in milliseconds (0 if no projectEnd or task is on critical path)
 */
export function calculateSlackTime(
  taskEnd: Date,
  projectEnd: Date | null | undefined,
): number {
  if (!projectEnd) {
    return 0;
  }

  const boundary =
    projectEnd instanceof Date ? projectEnd : new Date(projectEnd);
  const slack = boundary.getTime() - taskEnd.getTime();

  return Math.max(0, slack);
}

/**
 * Format boundary date for display
 *
 * @param date - Date to format
 * @returns Formatted date string or 'Not set'
 */
export function formatBoundaryDate(date: Date | null | undefined): string {
  if (!date) {
    return 'Not set';
  }

  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
