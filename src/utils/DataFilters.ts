/**
 * Data Filters Utility
 * Helper functions for filtering and organizing data in Gantt
 */

import type { ITask } from '@svar-ui/gantt-store';
import type { GanttTask } from '../types/gantt';

/**
 * Server filter options for Preset storage
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
  priorities?: number[];

  // Critical path filter
  criticalPathOnly?: boolean;
  criticalTaskIds?: (string | number)[];

  // Filter type indicator for Preset
  filterType?: 'client' | 'server';

  // Server-side filter options (applied at API level)
  serverFilters?: ServerFilterOptions;
}

/**
 * Convert ServerFilterOptions to a flat server filter format for API calls
 */
export function toServerFilters(
  options?: ServerFilterOptions,
): Record<string, unknown> | undefined {
  if (!options) return undefined;

  return {
    labelNames: options.labelNames,
    milestoneTitles: options.milestoneTitles,
    assigneeUsernames: options.assigneeUsernames,
    createdAfter: options.dateRange?.createdAfter,
    createdBefore: options.dateRange?.createdBefore,
  };
}

export class DataFilters {
  /**
   * Filter tasks by milestone
   * Supports "NONE" (as 0) to filter tasks without milestone
   *
   * Note: Milestone task IDs use string format "m-{iid}" to avoid collision with work item IIDs.
   * Tasks store their milestone association in a milestoneIid field or via their parent field.
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
      if (task.$isMilestone || task.type === 'milestone') {
        return otherMilestoneIids.includes(
          (task.issueId as number) || (task.id as number),
        );
      }

      // Issue/Task - check by milestone association stored in milestoneIid
      const taskMilestoneIid = (task as GanttTask).milestoneIid;

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
   */
  static filterByEpic(tasks: ITask[], epicIds: number[]): ITask[] {
    if (epicIds.length === 0) {
      return tasks;
    }

    // Check if filtering for tasks without epic (NONE = 0)
    const includeNoEpic = epicIds.includes(0);
    const otherEpicIds = epicIds.filter((id) => id !== 0);

    return tasks.filter((task) => {
      // Check if task has epic parent ID stored
      const epicParentId = (task as GanttTask).epicParentId;

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
   * State values are normalized for comparison:
   * 'opened' -> 'OPEN', 'closed' -> 'CLOSED'
   */
  static filterByState(tasks: ITask[], states: string[]): ITask[] {
    if (states.length === 0) {
      return tasks;
    }

    // Normalize filter states
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
   * Filter tasks by priority (0-4)
   * Supports filtering for tasks without priority (undefined/null)
   */
  static filterByPriority(tasks: ITask[], priorities: number[]): ITask[] {
    if (priorities.length === 0) {
      return tasks;
    }

    return tasks.filter((task) => {
      const taskPriority = task.priority;
      // If task has no priority, it's treated as P4 (lowest)
      const effectivePriority = taskPriority ?? 4;
      return priorities.includes(effectivePriority);
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
   * Filter tasks to show only critical path
   */
  static filterByCriticalPath(
    tasks: ITask[],
    criticalTaskIds: (string | number)[],
  ): ITask[] {
    if (!criticalTaskIds || criticalTaskIds.length === 0) {
      return tasks;
    }

    const criticalSet = new Set(criticalTaskIds);
    return tasks.filter((task) => criticalSet.has(task.id!));
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

    if (options.priorities && options.priorities.length > 0) {
      filtered = this.filterByPriority(filtered, options.priorities);
    }

    if (options.search) {
      filtered = this.searchTasks(filtered, options.search);
    }

    if (options.criticalPathOnly && options.criticalTaskIds) {
      filtered = this.filterByCriticalPath(filtered, options.criticalTaskIds);
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
   *   - parent = "m-{iid}": Milestone (string format, e.g., "m-1", "m-8")
   *   - parent = number: Could be an epic ID or a work item IID (hierarchical relationship)
   *
   * Note: Milestone IDs use string format to avoid collision with Issue IIDs > 10000
   */
  static ensureParentChildIntegrity(
    filteredTasks: ITask[],
    allTasks: ITask[],
  ): ITask[] {
    const taskMap = new Map<number | string, ITask>();

    // Process each task
    filteredTasks.forEach((task) => {
      // Check if this task has a parent
      if (task.parent && task.parent !== 0) {
        // Check if this is an Issue (Issue's parent in Gantt = Milestone)
        const isIssue =
          (task as GanttTask).$isIssue ||
          (task as GanttTask).workItemType === 'Issue' ||
          ((task as GanttTask).workItemType !== 'Task' && !(task as GanttTask).type);

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
          // Task's parent is another work item (hierarchical relationship)
          const parentExists = allTasks.some((t) => t.id === task.parent);

          if (!parentExists) {
            // Parent doesn't exist - move task to root level
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
    milestones: any[],
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
      if (task.$isMilestone || task.type === 'milestone') {
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
  static groupByEpic(tasks: ITask[], epics: any[]): Map<number, ITask[]> {
    const groups = new Map<number, ITask[]>();

    // Initialize groups with epics
    epics.forEach((epic) => {
      groups.set(epic.id, []);
    });

    // Add "No Epic" group
    groups.set(0, []);

    // Assign tasks to groups
    tasks.forEach((task) => {
      const epicId = (task as GanttTask).epicId || 0;
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

        taskLabels.forEach((label: string) => {
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
   * Create a filter function for SVAR's filter-rows action
   * This function determines which tasks should be visible based on filter options
   *
   * The filter function checks if a task should be visible AND includes parent chains
   * to maintain hierarchy integrity in the Gantt chart.
   *
   * @param allTasks - All tasks in the data store
   * @param options - Filter options
   * @returns A function that returns true if a task should be visible
   */
  static createSvarFilterFunction(
    allTasks: ITask[],
    options: FilterOptions,
  ): (task: ITask) => boolean {
    const visibleTaskIds = new Set<number | string>();

    const matchesBasicFilters = (task: ITask): boolean => {
      if (options.milestoneIds && options.milestoneIds.length > 0) {
        const milestoneIids = options.milestoneIds;
        const includeNoMilestone = milestoneIids.includes(0);
        const otherMilestoneIids = milestoneIids.filter((id) => id !== 0);

        if (task._gitlab?.type === 'milestone') {
          if (!otherMilestoneIids.includes(task._gitlab?.iid as number)) {
            return false;
          }
        } else {
          const taskMilestoneIid = task._gitlab?.milestoneIid;
          if (includeNoMilestone && !taskMilestoneIid) {
          } else if (taskMilestoneIid && otherMilestoneIids.length > 0) {
            if (!otherMilestoneIids.includes(taskMilestoneIid)) {
              return false;
            }
          } else {
            return false;
          }
        }
      }

      if (options.epicIds && options.epicIds.length > 0) {
        const epicIds = options.epicIds;
        const includeNoEpic = epicIds.includes(0);
        const otherEpicIds = epicIds.filter((id) => id !== 0);
        const epicParentId = task._gitlab?.epicParentId;

        if (includeNoEpic && !epicParentId) {
        } else if (epicParentId && otherEpicIds.length > 0) {
          if (!otherEpicIds.includes(epicParentId)) {
            return false;
          }
        } else {
          return false;
        }
      }

      if (options.labels && options.labels.length > 0) {
        const labels = options.labels;
        const includeNoLabels = labels.includes('NONE');
        const otherLabels = labels.filter((l) => l !== 'NONE');
        const taskLabels =
          typeof task.labels === 'string'
            ? task.labels
                .split(',')
                .map((l) => l.trim())
                .filter((l) => l)
            : task.labels || [];

        if (includeNoLabels && taskLabels.length === 0) {
        } else if (otherLabels.length > 0 && taskLabels.length > 0) {
          if (!otherLabels.some((label) => taskLabels.includes(label))) {
            return false;
          }
        } else {
          return false;
        }
      }

      if (options.assignees && options.assignees.length > 0) {
        const assignees = options.assignees;
        const includeUnassigned = assignees.includes('NONE');
        const otherAssignees = assignees.filter((a) => a !== 'NONE');

        if (includeUnassigned && !task.assigned) {
        } else if (otherAssignees.length === 0) {
          return false;
        } else if (!task.assigned) {
          return false;
        } else {
          const taskAssignees =
            typeof task.assigned === 'string'
              ? task.assigned.split(',').map((a) => a.trim())
              : [task.assigned];
          if (
            !otherAssignees.some((assignee) =>
              taskAssignees.some((ta) =>
                ta.toLowerCase().includes(assignee.toLowerCase()),
              ),
            )
          ) {
            return false;
          }
        }
      }

      if (options.states && options.states.length > 0) {
        const normalizedStates = options.states.map((s) => {
          const lower = s.toLowerCase();
          if (lower === 'opened' || lower === 'open') return 'OPEN';
          if (lower === 'closed' || lower === 'close') return 'CLOSED';
          return s.toUpperCase();
        });
        if (
          !task.state ||
          !normalizedStates.includes(task.state.toUpperCase())
        ) {
          return false;
        }
      }

      if (options.priorities && options.priorities.length > 0) {
        const taskPriority = task.priority;
        const effectivePriority = taskPriority ?? 4;
        if (!options.priorities.includes(effectivePriority)) {
          return false;
        }
      }

      if (options.search) {
        const search = options.search.toLowerCase();
        if (
          !task.text?.toLowerCase().includes(search) &&
          !task.details?.toLowerCase().includes(search) &&
          !task.labels?.toString().toLowerCase().includes(search) &&
          !task.assigned?.toString().toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (options.criticalPathOnly && options.criticalTaskIds) {
        const criticalSet = new Set(options.criticalTaskIds);
        if (!criticalSet.has(task.id!)) {
          return false;
        }
      }

      return true;
    };

    const taskMap = new Map<number | string, ITask>();
    allTasks.forEach((task) => taskMap.set(task.id!, task));

    const addParentChain = (taskId: number | string) => {
      if (visibleTaskIds.has(taskId)) return;
      visibleTaskIds.add(taskId);

      const task = taskMap.get(taskId);
      if (task?.parent && task.parent !== 0) {
        addParentChain(task.parent);
      }
    };

    allTasks.forEach((task) => {
      if (matchesBasicFilters(task)) {
        addParentChain(task.id!);
      }
    });

    return (task: ITask) => visibleTaskIds.has(task.id!);
  }

  /**
   * Check if any client-side filters are active
   */
  static hasActiveFilters(options: FilterOptions): boolean {
    return (
      (options.milestoneIds?.length ?? 0) > 0 ||
      (options.epicIds?.length ?? 0) > 0 ||
      (options.labels?.length ?? 0) > 0 ||
      (options.assignees?.length ?? 0) > 0 ||
      (options.states?.length ?? 0) > 0 ||
      (options.priorities?.length ?? 0) > 0 ||
      !!options.search ||
      !!options.criticalPathOnly
    );
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
      if (task.$isMilestone || task.type === 'milestone') {
        return;
      }

      stats.total++;

      const progress = task.progress || 0;
      totalProgress += progress;

      // Normalize state check
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

  /**
   * Group type options for row grouping
   */
  static readonly GROUP_BY_OPTIONS = [
    { value: 'none', label: 'No Grouping' },
    { value: 'assignee', label: 'By Assignee' },
    { value: 'epic', label: 'By Epic' },
    { value: 'sprint', label: 'By Sprint' },
  ] as const;

  /**
   * Group tasks by a specified field and create virtual group header tasks
   * Returns tasks with group headers interspersed, suitable for Gantt display
   *
   * @param tasks - Array of tasks to group
   * @param groupBy - Grouping type: 'none', 'assignee', 'epic', 'sprint'
   * @param collapsedGroups - Set of group IDs that are collapsed
   * @returns Object with grouped tasks array and group metadata
   */
  static groupTasks(
    tasks: ITask[],
    groupBy: string,
    collapsedGroups: Set<string> = new Set(),
  ): {
    tasks: ITask[];
    groupCount: number;
    groupMeta: Map<
      string,
      {
        name: string;
        taskCount: number;
        dateRange: { start: Date | null; end: Date | null } | null;
      }
    >;
  } {
    if (groupBy === 'none' || !groupBy) {
      return { tasks, groupCount: 0, groupMeta: new Map() };
    }

    const groupMap = new Map<string, ITask[]>();
    const groupMeta = new Map<
      string,
      {
        name: string;
        taskCount: number;
        dateRange: { start: Date | null; end: Date | null } | null;
      }
    >();

    const getGroupKey = (task: ITask): string => {
      switch (groupBy) {
        case 'assignee':
          return (task.assigned as string) || 'Unassigned';
        case 'epic':
          return ((task as GanttTask).epic as string) || 'No Epic';
        case 'sprint':
          return ((task as GanttTask).iteration as string) || 'No Sprint';
        default:
          return 'Other';
      }
    };

    const getSortValue = (task: ITask): string => {
      const key = getGroupKey(task);
      if (key === 'Unassigned' || key === 'No Epic' || key === 'No Sprint') {
        return '\xFF';
      }
      return key.toLowerCase();
    };

    tasks.forEach((task) => {
      const key = getGroupKey(task);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(task);
    });

    const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => {
      const aSort =
        a === 'Unassigned' || a === 'No Epic' || a === 'No Sprint'
          ? '\xFF'
          : a.toLowerCase();
      const bSort =
        b === 'Unassigned' || b === 'No Epic' || a === 'No Sprint'
          ? '\xFF'
          : b.toLowerCase();
      return aSort.localeCompare(bSort);
    });

    const result: ITask[] = [];
    let groupIndex = 0;

    sortedGroups.forEach(([groupName, groupTasks]) => {
      const groupId = `group-${groupBy}-${groupName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const isCollapsed = collapsedGroups.has(groupId);

      const tasksWithDates = groupTasks.filter((t) => t.start && t.end);
      const dateRange =
        tasksWithDates.length > 0
          ? {
              start: new Date(
                Math.min(...tasksWithDates.map((t) => t.start!.getTime())),
              ),
              end: new Date(
                Math.max(...tasksWithDates.map((t) => t.end!.getTime())),
              ),
            }
          : null;

      groupMeta.set(groupId, {
        name: groupName,
        taskCount: groupTasks.length,
        dateRange,
      });

      const groupHeader: ITask = {
        id: groupId,
        text: groupName,
        start: dateRange?.start || new Date(),
        end: dateRange?.end || new Date(),
        parent: 0,
        open: !isCollapsed,
        $groupHeader: true,
        $groupName: groupName,
        $groupIndex: groupIndex,
        $groupType: groupBy,
        $taskCount: groupTasks.length,
        progress: 0,
        type: 'project',
      } as GanttTask;

      result.push(groupHeader);

      if (!isCollapsed) {
        const childTasks = groupTasks.map((task) => ({
          ...task,
          $groupIndex: groupIndex,
        }));
        result.push(...childTasks);
      }

      groupIndex++;
    });

    return {
      tasks: result,
      groupCount: sortedGroups.length,
      groupMeta,
    };
  }

  /**
   * Get unique values for a grouping field from tasks
   */
  static getUniqueGroupValues(tasks: ITask[], groupBy: string): string[] {
    const values = new Set<string>();

    tasks.forEach((task) => {
      switch (groupBy) {
        case 'assignee':
          if (task.assigned) {
            const assignees =
              typeof task.assigned === 'string'
                ? task.assigned.split(',').map((a) => a.trim())
                : [task.assigned];
            assignees.forEach((a) => a && values.add(a));
          } else {
            values.add('Unassigned');
          }
          break;
        case 'epic':
          {
            const epic = (task as GanttTask).epic;
            if (epic) {
              values.add(epic);
            } else {
              values.add('No Epic');
            }
          }
          break;
        case 'sprint':
          {
            const iteration = (task as GanttTask).iteration;
            if (iteration) {
              values.add(iteration);
            } else {
              values.add('No Sprint');
            }
          }
          break;
      }
    });

    return Array.from(values).sort((a, b) => {
      if (a === 'Unassigned' || a === 'No Epic' || a === 'No Sprint') return 1;
      if (b === 'Unassigned' || b === 'No Epic' || b === 'No Sprint') return -1;
      return a.localeCompare(b);
    });
  }
}
