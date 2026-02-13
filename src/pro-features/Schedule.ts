import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { ICalendar, ITaskConstraint, IScheduleConfig } from './types';
import { isWorkday, addWorkdays, countWorkdays } from './Calendar';

export interface IScheduleResult {
  tasks: Map<TID, { start: Date; end: Date; changed: boolean }>;
  conflicts: IScheduleConflict[];
  affectedTaskIds: TID[];
}

export interface IScheduleConflict {
  taskId: TID;
  type: 'constraint_violation' | 'circular_dependency' | 'invalid_dates';
  message: string;
}

export type ScheduleTaskCallback = (
  taskId: TID,
  newStart: Date,
  newEnd: Date,
) => void;

function getLinkLag(link: ILink): number {
  return (link as unknown as { lag?: number }).lag || 0;
}

export function scheduleTasks(
  tasks: ITask[],
  links: ILink[],
  calendar?: ICalendar,
  constraints?: Map<TID, ITaskConstraint[]>,
  config?: IScheduleConfig,
  onScheduleTask?: ScheduleTaskCallback,
): IScheduleResult {
  const taskMap = new Map<TID, ITask>();
  const result = new Map<TID, { start: Date; end: Date; changed: boolean }>();
  const conflicts: IScheduleConflict[] = [];
  const affectedTaskIds: TID[] = [];

  tasks.forEach((task) => {
    if (task.id) {
      taskMap.set(task.id, task);
      result.set(task.id, {
        start: task.start || new Date(),
        end: task.end || new Date(),
        changed: false,
      });
    }
  });

  const predecessors = new Map<TID, ILink[]>();
  links.forEach((link) => {
    if (!predecessors.has(link.target)) {
      predecessors.set(link.target, []);
    }
    predecessors.get(link.target)!.push(link);
  });

  const sorted = topologicalSort(tasks, links);

  if (sorted.length === 0 && tasks.length > 0) {
    tasks.forEach((task) => {
      if (task.id) {
        conflicts.push({
          taskId: task.id,
          type: 'circular_dependency',
          message: 'Circular dependency detected',
        });
      }
    });
    return { tasks: result, conflicts, affectedTaskIds };
  }

  const projectStart = config?.projectStart;

  sorted.forEach((taskId) => {
    const task = taskMap.get(taskId);
    if (!task) return;

    const taskPreds = predecessors.get(taskId) || [];
    let earliestStart: Date | null = null;

    taskPreds.forEach((link) => {
      const predTask = taskMap.get(link.source);
      const predResult = result.get(link.source);

      if (!predTask || !predResult) return;

      const lag = getLinkLag(link);

      let predEnd = new Date(predResult.end);
      predEnd.setDate(predEnd.getDate() + 1 + lag);

      if (
        calendar &&
        config?.respectCalendar !== false &&
        !isWorkday(predEnd, calendar)
      ) {
        predEnd = addWorkdays(predEnd, 0, calendar);
      }

      switch (link.type) {
        case 'e2s':
          earliestStart = earliestStart
            ? maxDate(earliestStart, predEnd)
            : predEnd;
          break;
        case 's2s': {
          let predStart = new Date(predResult.start);
          predStart.setDate(predStart.getDate() + lag);
          earliestStart = earliestStart
            ? maxDate(earliestStart, predStart)
            : predStart;
          break;
        }
        case 'e2e':
        case 's2e':
          break;
      }
    });

    if (!earliestStart) {
      if (projectStart) {
        earliestStart = new Date(projectStart);
      } else {
        earliestStart = task.start ? new Date(task.start) : new Date();
      }
    }

    if (projectStart && earliestStart < projectStart) {
      earliestStart = new Date(projectStart);
    }

    if (
      calendar &&
      config?.respectCalendar !== false &&
      !isWorkday(earliestStart, calendar)
    ) {
      earliestStart = addWorkdays(earliestStart, 0, calendar);
    }

    const taskConstraints = constraints?.get(taskId) || [];
    taskConstraints.forEach((constraint) => {
      switch (constraint.type) {
        case 'start-no-earlier-than':
          if (earliestStart) {
            earliestStart = maxDate(earliestStart, constraint.date);
          } else {
            earliestStart = constraint.date;
          }
          break;
        case 'must-start-on':
          earliestStart = constraint.date;
          break;
        case 'start-no-later-than':
          if (earliestStart && earliestStart > constraint.date) {
            conflicts.push({
              taskId,
              type: 'constraint_violation',
              message: `Task cannot start before ${constraint.date.toLocaleDateString()} but dependencies require later start`,
            });
          }
          break;
      }
    });

    const duration = getTaskDuration(task, calendar, earliestStart);
    let scheduledEnd = addDays(earliestStart, duration - 1);

    if (calendar) {
      scheduledEnd = addWorkdays(earliestStart, duration - 1, calendar);
    }

    taskConstraints.forEach((constraint) => {
      switch (constraint.type) {
        case 'finish-no-earlier-than':
          scheduledEnd = maxDate(scheduledEnd, constraint.date);
          break;
        case 'finish-no-later-than':
          if (scheduledEnd > constraint.date) {
            conflicts.push({
              taskId,
              type: 'constraint_violation',
              message: `Task cannot finish after ${constraint.date.toLocaleDateString()}`,
            });
          }
          break;
        case 'must-finish-on':
          scheduledEnd = constraint.date;
          break;
      }
    });

    const currentResult = result.get(taskId)!;
    const changed =
      !datesEqual(currentResult.start, earliestStart) ||
      !datesEqual(currentResult.end, scheduledEnd);

    result.set(taskId, {
      start: earliestStart,
      end: scheduledEnd,
      changed,
    });

    if (changed) {
      affectedTaskIds.push(taskId);
      if (onScheduleTask) {
        onScheduleTask(taskId, earliestStart, scheduledEnd);
      }
    }
  });

  return { tasks: result, conflicts, affectedTaskIds };
}

export function rescheduleFromTask(
  taskId: TID,
  tasks: ITask[],
  links: ILink[],
  calendar?: ICalendar,
  config?: IScheduleConfig,
  onScheduleTask?: ScheduleTaskCallback,
): IScheduleResult {
  const successors = new Map<TID, TID[]>();
  links.forEach((link) => {
    if (!successors.has(link.source)) {
      successors.set(link.source, []);
    }
    successors.get(link.source)!.push(link.target);
  });

  const affected = new Set<TID>([taskId]);
  const queue: TID[] = [taskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const succs = successors.get(current) || [];
    succs.forEach((s) => {
      if (!affected.has(s)) {
        affected.add(s);
        queue.push(s);
      }
    });
  }

  const affectedTasks = tasks.filter((t) => t.id && affected.has(t.id));
  const relevantLinks = links.filter(
    (l) => affected.has(l.source) && affected.has(l.target),
  );

  return scheduleTasks(
    affectedTasks,
    relevantLinks,
    calendar,
    undefined,
    config,
    onScheduleTask,
  );
}

export function getAffectedSuccessors(taskId: TID, links: ILink[]): TID[] {
  const successors = new Map<TID, TID[]>();
  links.forEach((link) => {
    if (!successors.has(link.source)) {
      successors.set(link.source, []);
    }
    successors.get(link.source)!.push(link.target);
  });

  const affected = new Set<TID>();
  const queue: TID[] = [taskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const succs = successors.get(current) || [];
    succs.forEach((s) => {
      if (!affected.has(s)) {
        affected.add(s);
        queue.push(s);
      }
    });
  }

  return Array.from(affected);
}

export function detectCircularDependencies(
  tasks: ITask[],
  links: ILink[],
): TID[][] {
  const cycles: TID[][] = [];
  const taskIds = new Set(tasks.filter((t) => t.id).map((t) => t.id));

  const successors = new Map<TID, TID[]>();
  links.forEach((link) => {
    if (!successors.has(link.source)) {
      successors.set(link.source, []);
    }
    successors.get(link.source)!.push(link.target);
  });

  function dfs(
    start: TID,
    current: TID,
    visited: Set<TID>,
    path: TID[],
  ): boolean {
    if (visited.has(current)) {
      if (current === start && path.length > 1) {
        cycles.push([...path]);
        return true;
      }
      return false;
    }

    visited.add(current);
    path.push(current);

    const succs = successors.get(current) || [];
    for (const succ of succs) {
      if (succ === start || !visited.has(succ)) {
        dfs(start, succ, visited, path);
      }
    }

    path.pop();
    visited.delete(current);
    return false;
  }

  taskIds.forEach((taskId) => {
    dfs(taskId, taskId, new Set(), []);
  });

  return cycles;
}

export function removeInvalidLinks(
  tasks: ITask[],
  links: ILink[],
): { validLinks: ILink[]; removedLinks: ILink[] } {
  const taskIds = new Set(tasks.filter((t) => t.id).map((t) => t.id));
  const validLinks: ILink[] = [];
  const removedLinks: ILink[] = [];

  const taskParents = new Map<TID, TID>();
  tasks.forEach((task) => {
    if (task.id && task.parent) {
      taskParents.set(task.id, task.parent);
    }
  });

  links.forEach((link) => {
    const sourceExists = taskIds.has(link.source);
    const targetExists = taskIds.has(link.target);
    const isSelfLink = link.source === link.target;

    let isSummaryToChild = false;
    let current = link.target;
    while (current) {
      if (current === link.source) {
        isSummaryToChild = true;
        break;
      }
      current = taskParents.get(current) || 0;
      if (current === 0) break;
    }

    if (!sourceExists || !targetExists || isSelfLink || isSummaryToChild) {
      removedLinks.push(link);
    } else {
      validLinks.push(link);
    }
  });

  return { validLinks, removedLinks };
}

function topologicalSort(tasks: ITask[], links: ILink[]): TID[] {
  const inDegree = new Map<TID, number>();
  const adjacency = new Map<TID, TID[]>();

  tasks.forEach((task) => {
    if (task.id) {
      inDegree.set(task.id, 0);
      adjacency.set(task.id, []);
    }
  });

  links.forEach((link) => {
    const current = inDegree.get(link.target) || 0;
    inDegree.set(link.target, current + 1);
    const adj = adjacency.get(link.source) || [];
    adj.push(link.target);
    adjacency.set(link.source, adj);
  });

  const queue: TID[] = [];
  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId);
    }
  });

  const result: TID[] = [];

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    result.push(taskId);

    const neighbors = adjacency.get(taskId) || [];
    neighbors.forEach((neighbor) => {
      const currentDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, currentDegree);
      if (currentDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (result.length !== tasks.length) {
    return [];
  }

  return result;
}

function getTaskDuration(
  task: ITask,
  calendar?: ICalendar,
  startDate?: Date,
): number {
  if (task.duration !== undefined) {
    return task.duration;
  }

  if (task.start && task.end) {
    if (calendar) {
      return countWorkdays(task.start, task.end, calendar);
    }
    return Math.ceil(
      (task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return 1;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? new Date(a) : new Date(b);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function datesEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
