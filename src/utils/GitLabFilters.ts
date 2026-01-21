/**
 * GitLab Filters Utility
 * Helper functions for filtering and organizing GitLab data in Gantt
 */

import type { ITask } from '@svar-ui/gantt-store';
import type {
  GitLabMilestone,
  GitLabEpic,
  GitLabServerFilters,
} from '../types/gitlab';

/**
 * Server filter options for Preset storage
 * Matches GitLabServerFilters but with dateRange grouped
 */
export interface ServerFilterOptions {
  labelNames?: string[];
  milestoneTitles?: string[];
  assigneeUsernames?: string[];
  dateRange?: {
    createdAfter?: string;
    createdBefore?: string;
  };
}

/**
 * Filter options used by FilterPanel
 * Supports both client-side and server-side filtering
 */
export interface FilterOptions {
  // Client-side filter options (applied after data is fetched)
  milestoneIds?: number[];
  epicIds?: number[];
  labels?: string[];
  assignees?: string[];
  states?: string[];
  search?: string;

  // Filter type indicator for Preset
  filterType?: 'client' | 'server';

  // Server-side filter options (applied at API level)
  serverFilters?: ServerFilterOptions;
}

/**
 * Convert ServerFilterOptions to GitLabServerFilters for API call
 */
export function toGitLabServerFilters(
  options?: ServerFilterOptions,
): GitLabServerFilters | undefined {
  if (!options) return undefined;

  return {
    labelNames: options.labelNames,
    milestoneTitles: options.milestoneTitles,
    assigneeUsernames: options.assigneeUsernames,
    createdAfter: options.dateRange?.createdAfter,
    createdBefore: options.dateRange?.createdBefore,
  };
}

export class GitLabFilters {
  /**
   * Filter tasks by milestone using _gitlab.milestoneIid
   * Supports "NONE" (as 0) to filter tasks without milestone
   *
   * Note: We no longer use the parent field (10000 + iid) for filtering.
   * Instead, we use _gitlab.milestoneIid which is set when transforming work items.
   */
  static filterByMilestone(tasks: ITask[], milestoneIids: number[]): ITask[] {
    if (milestoneIids.length === 0) {
      return tasks;
    }

    // Check if filtering for tasks without milestone (NONE = 0)
    const includeNoMilestone = milestoneIids.includes(0);
    const otherMilestoneIids = milestoneIids.filter((id) => id !== 0);

    return tasks.filter((task) => {
      // Skip milestone summary tasks when filtering for "no milestone"
      if (task._gitlab?.type === 'milestone') {
        return otherMilestoneIids.includes(task._gitlab?.iid as number);
      }

      // Issue/Task - check by milestone association stored in _gitlab.milestoneIid
      const taskMilestoneIid = task._gitlab?.milestoneIid;

      // Check for no milestone
      if (includeNoMilestone && !taskMilestoneIid) {
        return true;
      }

      // Check for specific milestones
      if (taskMilestoneIid && otherMilestoneIids.length > 0) {
        return otherMilestoneIids.includes(taskMilestoneIid);
      }

      return false;
    });
  }

  /**
   * Filter tasks by epic
   * Supports "NONE" (as 0) to filter tasks without epic
   *
   * Note: GitLab Issues can have Epic parents (actual parent relationship in GitLab)
   * Epic parent ID is stored in _gitlab.epicParentId when Issue has Epic parent
   */
  static filterByEpic(tasks: ITask[], epicIds: number[]): ITask[] {
    if (epicIds.length === 0) {
      return tasks;
    }

    // Check if filtering for tasks without epic (NONE = 0)
    const includeNoEpic = epicIds.includes(0);
    const otherEpicIds = epicIds.filter((id) => id !== 0);

    return tasks.filter((task) => {
      // Check if task has Epic parent ID stored
      const epicParentId = task._gitlab?.epicParentId;

      // Check for no epic
      if (includeNoEpic && !epicParentId) {
        return true;
      }

      // Check for specific epics
      if (epicParentId && otherEpicIds.length > 0) {
        return otherEpicIds.includes(epicParentId);
      }

      return false;
    });
  }

  /**
   * Filter tasks by labels
   * Supports "NONE" value to filter tasks without labels
   */
  static filterByLabels(tasks: ITask[], labels: string[]): ITask[] {
    if (labels.length === 0) {
      return tasks;
    }

    // Check if filtering for tasks without labels
    const includeNoLabels = labels.includes('NONE');
    const otherLabels = labels.filter((l) => l !== 'NONE');

    return tasks.filter((task) => {
      const taskLabels =
        typeof task.labels === 'string'
          ? task.labels
              .split(',')
              .map((l) => l.trim())
              .filter((l) => l)
          : task.labels || [];

      // Check for no labels
      if (includeNoLabels && taskLabels.length === 0) {
        return true;
      }

      // Check for specific labels
      if (otherLabels.length > 0 && taskLabels.length > 0) {
        return otherLabels.some((label) => taskLabels.includes(label));
      }

      return false;
    });
  }

  /**
   * Filter tasks by assignees
   * Supports "NONE" value to filter unassigned tasks
   */
  static filterByAssignees(tasks: ITask[], assignees: string[]): ITask[] {
    if (assignees.length === 0) {
      return tasks;
    }

    // Check if filtering for unassigned tasks
    const includeUnassigned = assignees.includes('NONE');
    const otherAssignees = assignees.filter((a) => a !== 'NONE');

    return tasks.filter((task) => {
      // Check for unassigned
      if (includeUnassigned && !task.assigned) {
        return true;
      }

      // If no other assignees to check, and task has assignees, exclude it
      if (otherAssignees.length === 0) {
        return false;
      }

      if (!task.assigned) {
        return false;
      }

      const taskAssignees =
        typeof task.assigned === 'string'
          ? task.assigned.split(',').map((a) => a.trim())
          : [task.assigned];

      return otherAssignees.some((assignee) =>
        taskAssignees.some((ta) =>
          ta.toLowerCase().includes(assignee.toLowerCase()),
        ),
      );
    });
  }

  /**
   * Filter tasks by state
   *
   * Note: GitLab GraphQL API returns state as 'OPEN' / 'CLOSED' (uppercase, no 'ed' suffix)
   * But the filter UI uses 'opened' / 'closed' for user-friendly display
   * This function normalizes both formats for comparison
   */
  static filterByState(tasks: ITask[], states: string[]): ITask[] {
    if (states.length === 0) {
      return tasks;
    }

    // Normalize filter states to match GitLab GraphQL format
    // 'opened' -> 'OPEN', 'closed' -> 'CLOSED'
    const normalizedStates = states.map((s) => {
      const lower = s.toLowerCase();
      if (lower === 'opened' || lower === 'open') return 'OPEN';
      if (lower === 'closed' || lower === 'close') return 'CLOSED';
      return s.toUpperCase();
    });

    return tasks.filter((task) => {
      if (!task.state) return false;
      // Normalize task state to uppercase for comparison
      const taskState = task.state.toUpperCase();
      return normalizedStates.includes(taskState);
    });
  }

  /**
   * Search tasks by text
   */
  static searchTasks(tasks: ITask[], searchText: string): ITask[] {
    if (!searchText || searchText.trim() === '') {
      return tasks;
    }

    const search = searchText.toLowerCase();

    return tasks.filter((task) => {
      return (
        task.text?.toLowerCase().includes(search) ||
        task.details?.toLowerCase().includes(search) ||
        task.labels?.toString().toLowerCase().includes(search) ||
        task.assigned?.toString().toLowerCase().includes(search)
      );
    });
  }

  /**
   * Apply all filters
   */
  static applyFilters(tasks: ITask[], options: FilterOptions): ITask[] {
    let filtered = tasks;

    if (options.milestoneIds && options.milestoneIds.length > 0) {
      filtered = this.filterByMilestone(filtered, options.milestoneIds);
    }

    if (options.epicIds && options.epicIds.length > 0) {
      filtered = this.filterByEpic(filtered, options.epicIds);
    }

    if (options.labels && options.labels.length > 0) {
      filtered = this.filterByLabels(filtered, options.labels);
    }

    if (options.assignees && options.assignees.length > 0) {
      filtered = this.filterByAssignees(filtered, options.assignees);
    }

    if (options.states && options.states.length > 0) {
      filtered = this.filterByState(filtered, options.states);
    }

    if (options.search) {
      filtered = this.searchTasks(filtered, options.search);
    }

    // Ensure parent-child integrity: include all necessary parent tasks
    filtered = this.ensureParentChildIntegrity(filtered, tasks);

    return filtered;
  }

  /**
   * Ensure all filtered tasks have their parent tasks included
   * This prevents orphaned tasks in the Gantt chart
   *
   * IMPORTANT: Parent field has different meanings:
   *
   * For GitLab Issues:
   *   - parent >= 10000: Milestone (we use parent field to display Issues under Milestones in Gantt)
   *   - parent < 10000: Epic ID from GitLab (Issues can have Epic parents, but we don't support Epic display)
   *
   * For GitLab Tasks:
   *   - parent = another work item's IID (hierarchical relationship)
   */
  static ensureParentChildIntegrity(
    filteredTasks: ITask[],
    allTasks: ITask[],
  ): ITask[] {
    const taskMap = new Map<number | string, ITask>();

    // Process each task
    //
    // GitLab Work Item Hierarchy Rules:
    // - Issue's parent can ONLY be: Epic (via hierarchyWidget) or Milestone (via milestoneWidget, shown as parent in Gantt)
    // - Task's parent can ONLY be: Issue (via hierarchyWidget)
    // - NEVER use ID ranges (e.g., < 10000) to guess parent type - this is unreliable and causes bugs
    // - Always use _gitlab metadata (workItemType, epicParentId, etc.) to determine relationships
    //
    filteredTasks.forEach((task) => {
      // Check if this task has a parent
      if (task.parent && task.parent !== 0) {
        // Check if this is an Issue (Issue's parent in Gantt = Milestone, Epic parent stored separately)
        const isIssue =
          task.$isIssue ||
          task._gitlab?.workItemType === 'Issue' ||
          (task._gitlab?.workItemType !== 'Task' && !task._gitlab?.type);

        if (isIssue) {
          // Issue's parent in Gantt context is Milestone
          const parentExists = allTasks.some((t) => t.id === task.parent);

          if (parentExists) {
            // Parent (Milestone) exists, keep the relationship
            taskMap.set(task.id, task);

            // Ensure the milestone is included
            if (!taskMap.has(task.parent)) {
              const parentTask = allTasks.find((t) => t.id === task.parent);
              if (parentTask) {
                taskMap.set(task.parent, parentTask);
              }
            }
          } else {
            // Parent doesn't exist (filtered Milestone)
            // Move to root level
            const modifiedTask = { ...task, parent: 0 };
            taskMap.set(task.id, modifiedTask);
          }
        } else {
          // Task's parent can ONLY be an Issue (never Epic, never Milestone)
          const parentExists = allTasks.some((t) => t.id === task.parent);

          if (!parentExists) {
            // Parent Issue doesn't exist - likely filtered out (e.g., closed issue)
            // Move task to root level
            const modifiedTask = { ...task, parent: 0 };
            taskMap.set(task.id, modifiedTask);
          } else {
            // Parent exists, add task as-is
            taskMap.set(task.id, task);

            // Also ensure the parent is included in the result
            let currentParentId: number | string | undefined = task.parent;
            while (currentParentId && currentParentId !== 0) {
              if (!taskMap.has(currentParentId)) {
                const parentTask = allTasks.find(
                  (t) => t.id === currentParentId,
                );
                if (parentTask) {
                  taskMap.set(currentParentId, parentTask);
                  currentParentId = parentTask.parent;
                } else {
                  break;
                }
              } else {
                break;
              }
            }
          }
        }
      } else {
        // No parent or root level, add as-is
        taskMap.set(task.id, task);
      }
    });

    return Array.from(taskMap.values());
  }

  /**
   * Group tasks by milestone
   */
  static groupByMilestone(
    tasks: ITask[],
    milestones: GitLabMilestone[],
  ): Map<number, ITask[]> {
    const groups = new Map<number, ITask[]>();

    // Initialize groups with milestones
    milestones.forEach((milestone) => {
      groups.set(milestone.id, []);
    });

    // Add "No Milestone" group
    groups.set(0, []);

    // Assign tasks to groups
    tasks.forEach((task) => {
      // Skip milestone summary tasks
      if (task._gitlab?.type === 'milestone') {
        return;
      }

      const milestoneId = (task.parent as number) || 0;
      const group = groups.get(milestoneId);
      if (group) {
        group.push(task);
      }
    });

    return groups;
  }

  /**
   * Group tasks by epic
   */
  static groupByEpic(
    tasks: ITask[],
    epics: GitLabEpic[],
  ): Map<number, ITask[]> {
    const groups = new Map<number, ITask[]>();

    // Initialize groups with epics
    epics.forEach((epic) => {
      groups.set(epic.id, []);
    });

    // Add "No Epic" group
    groups.set(0, []);

    // Assign tasks to groups
    tasks.forEach((task) => {
      const epicId = task._gitlab?.epic?.id || 0;
      const group = groups.get(epicId);
      if (group) {
        group.push(task);
      }
    });

    return groups;
  }

  /**
   * Get unique labels from tasks
   */
  static getUniqueLabels(tasks: ITask[]): string[] {
    const labelsSet = new Set<string>();

    tasks.forEach((task) => {
      if (task.labels) {
        const taskLabels =
          typeof task.labels === 'string'
            ? task.labels.split(',').map((l) => l.trim())
            : task.labels;

        taskLabels.forEach((label) => {
          if (label) {
            labelsSet.add(label);
          }
        });
      }
    });

    return Array.from(labelsSet).sort();
  }

  /**
   * Get unique assignees from tasks
   */
  static getUniqueAssignees(tasks: ITask[]): string[] {
    const assigneesSet = new Set<string>();

    tasks.forEach((task) => {
      if (task.assigned) {
        const taskAssignees =
          typeof task.assigned === 'string'
            ? task.assigned.split(',').map((a) => a.trim())
            : [task.assigned];

        taskAssignees.forEach((assignee) => {
          if (assignee) {
            assigneesSet.add(assignee);
          }
        });
      }
    });

    return Array.from(assigneesSet).sort();
  }

  /**
   * Sort tasks by field
   */
  static sortTasks(
    tasks: ITask[],
    field: keyof ITask,
    order: 'asc' | 'desc' = 'asc',
  ): ITask[] {
    return [...tasks].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      let comparison = 0;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }

      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Calculate statistics for filtered tasks
   */
  static calculateStats(tasks: ITask[]): {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
    averageProgress: number;
  } {
    const now = new Date();
    let totalProgress = 0;

    const stats = {
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      overdue: 0,
      averageProgress: 0,
    };

    tasks.forEach((task) => {
      // Skip milestone summary tasks
      if (task._gitlab?.type === 'milestone') {
        return;
      }

      stats.total++;

      const progress = task.progress || 0;
      totalProgress += progress;

      // Normalize state check (GraphQL returns 'OPEN'/'CLOSED', REST returns 'opened'/'closed')
      const isClosed =
        task.state?.toUpperCase() === 'CLOSED' ||
        task.state?.toLowerCase() === 'closed';

      if (progress === 100 || isClosed) {
        stats.completed++;
      } else if (progress > 0) {
        stats.inProgress++;
      } else {
        stats.notStarted++;
      }

      // Check if overdue
      if (task.end && task.end < now && progress < 100 && !isClosed) {
        stats.overdue++;
      }
    });

    if (stats.total > 0) {
      stats.averageProgress = Math.round(totalProgress / stats.total);
    }

    return stats;
  }
}
