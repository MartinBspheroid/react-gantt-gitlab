/**
 * Workload View Utility Functions
 * Handles grouping tasks by assignee/label and overlap detection
 */

import type { ITask } from '@svar-ui/gantt-store';

export interface WorkloadGroup {
  id: number;
  text: string;
  type: 'assignee' | 'label';
  originalTasks: ITask[];
  rowCount: number;
}

export interface WorkloadTask extends ITask {
  $isWorkloadGroup?: boolean;
  $isWorkloadRow?: boolean;
  $groupType?: 'assignee' | 'label';
  $rowCount?: number;
  $workloadRow?: number;
  $workloadGroupId?: number;
  $originalId?: number | string;
}

/**
 * Get task assignees as an array
 */
function getTaskAssignees(task: ITask): string[] {
  if (!task.assigned) return [];
  if (typeof task.assigned === 'string') {
    return task.assigned
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }
  return [String(task.assigned)];
}

/**
 * Get task labels as an array
 */
function getTaskLabels(task: ITask): string[] {
  if (!task.labels) return [];
  if (typeof task.labels === 'string') {
    return task.labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (Array.isArray(task.labels)) {
    return task.labels.filter(Boolean).map(String);
  }
  return [];
}

/**
 * Assign tasks to rows based on overlap detection
 * Returns tasks grouped by row index
 */
function assignTasksToRows(tasks: ITask[]): Map<number, ITask[]> {
  const rows = new Map<number, ITask[]>();

  if (tasks.length === 0) {
    return rows;
  }

  // Sort by start date
  const sorted = [...tasks].sort((a, b) => {
    const aStart =
      a.start instanceof Date
        ? a.start
        : new Date(a.start || Date.now());
    const bStart =
      b.start instanceof Date
        ? b.start
        : new Date(b.start || Date.now());
    return aStart.getTime() - bStart.getTime();
  });

  // Track end times for each row
  const rowEndTimes: Date[] = [];

  for (const task of sorted) {
    const taskStart =
      task.start instanceof Date
        ? task.start
        : new Date(task.start || Date.now());
    const taskEnd =
      task.end instanceof Date
        ? task.end
        : new Date(task.end || task.start || Date.now());

    // Ensure end is after start (at least same day)
    const effectiveEnd =
      taskEnd >= taskStart ? taskEnd : new Date(taskStart.getTime() + 86400000);

    // Find first row where this task doesn't overlap
    let rowIndex = -1;
    for (let i = 0; i < rowEndTimes.length; i++) {
      if (rowEndTimes[i] <= taskStart) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      // All rows overlap, create new row
      rowIndex = rowEndTimes.length;
      rowEndTimes.push(effectiveEnd);
    } else {
      // Update row end time
      rowEndTimes[rowIndex] = effectiveEnd;
    }

    // Add task to row
    if (!rows.has(rowIndex)) {
      rows.set(rowIndex, []);
    }
    rows.get(rowIndex)!.push(task);
  }

  return rows;
}

/**
 * Generate workload view task structure
 * Creates a flat structure where:
 * - Each group (assignee/label) is a summary task
 * - Each row within a group is also a summary task
 * - Actual tasks are children of rows (not groups)
 */
export function generateWorkloadTasks(
  allTasks: ITask[],
  selectedAssignees: string[],
  selectedLabels: string[],
): WorkloadTask[] {
  const result: WorkloadTask[] = [];
  let idCounter = 100000;

  // Filter out milestone and summary tasks - only include actual work items
  const workItems = allTasks.filter((task) => {
    const isMilestone = task.$isMilestone || task.type === 'milestone';
    const isSummary = task.type === 'summary';
    return !isMilestone && !isSummary && task.start;
  });

  // Process assignee groups
  for (const assignee of selectedAssignees) {
    const assigneeTasks = workItems.filter((task) => {
      const taskAssignees = getTaskAssignees(task);
      return taskAssignees.includes(assignee);
    });

    const groupId = idCounter++;
    const rowsMap = assignTasksToRows(assigneeTasks);
    const rowCount = Math.max(rowsMap.size, 1);

    // Create group header
    result.push({
      id: groupId,
      text: assignee,
      type: 'summary',
      parent: 0,
      open: true,
      start: new Date(),
      end: new Date(),
      $isWorkloadGroup: true,
      $groupType: 'assignee',
      $rowCount: rowCount,
    });

    // Create rows and tasks
    for (const [rowIndex, rowTasks] of rowsMap) {
      const rowId = idCounter++;

      // Create row (invisible summary that holds tasks on same line)
      result.push({
        id: rowId,
        text: `Row ${rowIndex + 1}`,
        type: 'summary',
        parent: groupId,
        open: true,
        start: new Date(),
        end: new Date(),
        $isWorkloadRow: true,
        $workloadRow: rowIndex,
        $workloadGroupId: groupId,
      });

      // Add tasks to this row
      for (let i = 0; i < rowTasks.length; i++) {
        const task = rowTasks[i];
        result.push({
          ...task,
          id: `wl-${groupId}-${task.id}-${i}`,
          $originalId: task.id,
          $workloadRow: rowIndex,
          $workloadGroupId: groupId,
          parent: rowId,
          type: 'task', // Force task type to prevent summary behavior
        });
      }
    }

    // If no tasks, still show the group with empty row indicator
    if (assigneeTasks.length === 0) {
      const rowId = idCounter++;
      result.push({
        id: rowId,
        text: '(No tasks)',
        type: 'task',
        parent: groupId,
        start: new Date(),
        end: new Date(),
        $isWorkloadRow: true,
        $workloadRow: 0,
        $workloadGroupId: groupId,
      });
    }
  }

  // Process label groups
  for (const label of selectedLabels) {
    const labelTasks = workItems.filter((task) => {
      const taskLabels = getTaskLabels(task);
      return taskLabels.includes(label);
    });

    const groupId = idCounter++;
    const rowsMap = assignTasksToRows(labelTasks);
    const rowCount = Math.max(rowsMap.size, 1);

    // Create group header
    result.push({
      id: groupId,
      text: label,
      type: 'summary',
      parent: 0,
      open: true,
      start: new Date(),
      end: new Date(),
      $isWorkloadGroup: true,
      $groupType: 'label',
      $rowCount: rowCount,
    });

    // Create rows and tasks
    for (const [rowIndex, rowTasks] of rowsMap) {
      const rowId = idCounter++;

      // Create row
      result.push({
        id: rowId,
        text: `Row ${rowIndex + 1}`,
        type: 'summary',
        parent: groupId,
        open: true,
        start: new Date(),
        end: new Date(),
        $isWorkloadRow: true,
        $workloadRow: rowIndex,
        $workloadGroupId: groupId,
      });

      // Add tasks to this row
      for (let i = 0; i < rowTasks.length; i++) {
        const task = rowTasks[i];
        result.push({
          ...task,
          id: `wl-${groupId}-${task.id}-${i}`,
          $originalId: task.id,
          $workloadRow: rowIndex,
          $workloadGroupId: groupId,
          parent: rowId,
          type: 'task',
        });
      }
    }

    // If no tasks, still show the group with empty row indicator
    if (labelTasks.length === 0) {
      const rowId = idCounter++;
      result.push({
        id: rowId,
        text: '(No tasks)',
        type: 'task',
        parent: groupId,
        start: new Date(),
        end: new Date(),
        $isWorkloadRow: true,
        $workloadRow: 0,
        $workloadGroupId: groupId,
      });
    }
  }

  return result;
}

/**
 * Get unique assignees from all tasks
 */
export function getUniqueAssignees(tasks: ITask[]): string[] {
  const assigneesSet = new Set<string>();

  tasks.forEach((task) => {
    const taskAssignees = getTaskAssignees(task);
    taskAssignees.forEach((assignee) => {
      if (assignee) {
        assigneesSet.add(assignee);
      }
    });
  });

  return Array.from(assigneesSet).sort();
}

/**
 * Get unique labels from all tasks
 */
export function getUniqueLabels(tasks: ITask[]): string[] {
  const labelsSet = new Set<string>();

  tasks.forEach((task) => {
    const taskLabels = getTaskLabels(task);
    taskLabels.forEach((label) => {
      if (label) {
        labelsSet.add(label);
      }
    });
  });

  return Array.from(labelsSet).sort();
}

/**
 * Find the original task from task ID
 * Supports both direct IDs and workload task IDs (format: wl-{groupId}-{originalId}-{idx})
 */
export function findOriginalTask(
  taskId: string | number,
  allTasks: ITask[],
): ITask | null {
  const idStr = String(taskId);

  // Check if it's a workload task ID (format: wl-{groupId}-{originalId}-{idx})
  // This is used when Gantt component is used (legacy)
  if (idStr.startsWith('wl-')) {
    const parts = idStr.split('-');
    if (parts.length >= 4) {
      const originalId = parts[2];
      return allTasks.find((t) => String(t.id) === originalId) || null;
    }
  }

  // Direct ID match (WorkloadChart uses original task directly)
  return allTasks.find((t) => String(t.id) === idStr) || null;
}
