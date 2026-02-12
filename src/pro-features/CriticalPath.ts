import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { ICriticalPathTask, ICriticalPathConfig } from './types';

export interface ICriticalPathOptions {
  config?: ICriticalPathConfig;
  projectStart?: Date;
  projectEnd?: Date;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function calculateCriticalPath(
  tasks: ITask[],
  links: ILink[],
  options?: ICriticalPathOptions,
): ICriticalPathTask[] {
  const mode = options?.config?.type || 'strict';

  if (mode === 'flexible') {
    return calculateFlexibleCriticalPath(tasks, links, options);
  }
  return calculateStrictCriticalPath(tasks, links, options);
}

function calculateStrictCriticalPath(
  tasks: ITask[],
  links: ILink[],
  options?: ICriticalPathOptions,
): ICriticalPathTask[] {
  const result: ICriticalPathTask[] = [];

  if (tasks.length === 0) return result;

  const predecessors = new Map<TID, ILink[]>();
  const successors = new Map<TID, ILink[]>();

  links.forEach((link) => {
    if (!predecessors.has(link.target)) {
      predecessors.set(link.target, []);
    }
    predecessors.get(link.target)!.push(link);

    if (!successors.has(link.source)) {
      successors.set(link.source, []);
    }
    successors.get(link.source)!.push(link);
  });

  const enrichedTasks: Map<TID, ICriticalPathTask> = new Map();
  tasks.forEach((task) => {
    enrichedTasks.set(task.id!, {
      ...task,
      earlyStart: 0,
      earlyFinish: 0,
      lateStart: Infinity,
      lateFinish: Infinity,
      slack: 0,
      isCritical: false,
    });
  });

  const sortedTasks = topologicalSort(tasks, links);

  let projectStartTime: number | null =
    options?.projectStart?.getTime() ?? null;

  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskPredecessors = predecessors.get(taskId) || [];

    if (taskPredecessors.length === 0) {
      const taskStart = task.start?.getTime() ?? 0;
      task.earlyStart =
        projectStartTime !== null
          ? Math.max(projectStartTime, taskStart)
          : taskStart;
    } else {
      let maxEarlyStart = 0;
      taskPredecessors.forEach((link) => {
        const predTask = enrichedTasks.get(link.source);
        if (!predTask) return;

        const lag = getLinkLag(link);

        switch (link.type) {
          case 'e2s':
          case 'e2e':
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyFinish + lag);
            break;
          case 's2s':
          case 's2e':
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyStart + lag);
            break;
          default:
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyFinish + lag);
        }
      });
      task.earlyStart = maxEarlyStart;
    }

    const duration = getTaskDuration(task);
    task.earlyFinish = task.earlyStart + duration * MS_PER_DAY;
  });

  let projectEndTime: number = options?.projectEnd?.getTime() ?? 0;
  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (task && task.earlyFinish > projectEndTime) {
      projectEndTime = task.earlyFinish;
    }
  });

  [...sortedTasks].reverse().forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskSuccessors = successors.get(taskId) || [];

    if (taskSuccessors.length === 0) {
      task.lateFinish = projectEndTime;
    } else {
      let minLateFinish = Infinity;
      taskSuccessors.forEach((link) => {
        const succTask = enrichedTasks.get(link.target);
        if (!succTask) return;

        const lag = getLinkLag(link);

        switch (link.type) {
          case 'e2s':
          case 's2s':
            minLateFinish = Math.min(minLateFinish, succTask.lateStart - lag);
            break;
          case 'e2e':
          case 's2e':
            minLateFinish = Math.min(minLateFinish, succTask.lateFinish - lag);
            break;
          default:
            minLateFinish = Math.min(minLateFinish, succTask.lateStart - lag);
        }
      });
      task.lateFinish =
        minLateFinish === Infinity ? projectEndTime : minLateFinish;
    }

    const duration = getTaskDuration(task);
    task.lateStart = task.lateFinish - duration * MS_PER_DAY;
    task.slack = task.lateStart - task.earlyStart;
    task.isCritical = task.slack === 0;
  });

  enrichedTasks.forEach((task) => {
    result.push(task);
  });

  return result;
}

function calculateFlexibleCriticalPath(
  tasks: ITask[],
  links: ILink[],
  options?: ICriticalPathOptions,
): ICriticalPathTask[] {
  const result: ICriticalPathTask[] = [];

  if (tasks.length === 0) return result;

  const predecessors = new Map<TID, ILink[]>();
  const successors = new Map<TID, ILink[]>();

  links.forEach((link) => {
    if (!predecessors.has(link.target)) {
      predecessors.set(link.target, []);
    }
    predecessors.get(link.target)!.push(link);

    if (!successors.has(link.source)) {
      successors.set(link.source, []);
    }
    successors.get(link.source)!.push(link);
  });

  const enrichedTasks: Map<TID, ICriticalPathTask> = new Map();
  tasks.forEach((task) => {
    enrichedTasks.set(task.id!, {
      ...task,
      earlyStart: 0,
      earlyFinish: 0,
      lateStart: Infinity,
      lateFinish: Infinity,
      slack: 0,
      isCritical: false,
    });
  });

  const sortedTasks = topologicalSort(tasks, links);

  let projectStartTime: number | null =
    options?.projectStart?.getTime() ?? null;

  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskPredecessors = predecessors.get(taskId) || [];

    if (taskPredecessors.length === 0) {
      const taskStart = task.start?.getTime() ?? 0;
      task.earlyStart =
        projectStartTime !== null
          ? Math.max(projectStartTime, taskStart)
          : taskStart;
    } else {
      let maxEarlyStart = 0;
      taskPredecessors.forEach((link) => {
        const predTask = enrichedTasks.get(link.source);
        if (!predTask) return;

        const lag = getLinkLag(link);

        switch (link.type) {
          case 'e2s':
          case 'e2e':
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyFinish + lag);
            break;
          case 's2s':
          case 's2e':
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyStart + lag);
            break;
          default:
            maxEarlyStart = Math.max(maxEarlyStart, predTask.earlyFinish + lag);
        }
      });
      task.earlyStart = maxEarlyStart;
    }

    const duration = getTaskDuration(task);
    task.earlyFinish = task.earlyStart + duration * MS_PER_DAY;
  });

  let projectEndTime: number = options?.projectEnd?.getTime() ?? 0;
  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (task && task.earlyFinish > projectEndTime) {
      projectEndTime = task.earlyFinish;
    }
  });

  [...sortedTasks].reverse().forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskSuccessors = successors.get(taskId) || [];

    if (taskSuccessors.length === 0) {
      task.lateFinish = projectEndTime;
    } else {
      let minLateFinish = Infinity;
      taskSuccessors.forEach((link) => {
        const succTask = enrichedTasks.get(link.target);
        if (!succTask) return;

        const lag = getLinkLag(link);

        switch (link.type) {
          case 'e2s':
          case 's2s':
            minLateFinish = Math.min(minLateFinish, succTask.lateStart - lag);
            break;
          case 'e2e':
          case 's2e':
            minLateFinish = Math.min(minLateFinish, succTask.lateFinish - lag);
            break;
          default:
            minLateFinish = Math.min(minLateFinish, succTask.lateStart - lag);
        }
      });
      task.lateFinish =
        minLateFinish === Infinity ? projectEndTime : minLateFinish;
    }

    const duration = getTaskDuration(task);
    task.lateStart = task.lateFinish - duration * MS_PER_DAY;
    task.slack = task.lateStart - task.earlyStart;
  });

  const criticalPath: Set<TID> = new Set();
  const startTasks = sortedTasks.filter(
    (id) => (predecessors.get(id) || []).length === 0,
  );

  const visited = new Set<TID>();

  const tracePath = (currentId: TID) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const task = enrichedTasks.get(currentId);
    if (!task) return;

    task.isCritical = true;
    criticalPath.add(currentId);

    const taskSuccessors = successors.get(currentId) || [];
    if (taskSuccessors.length === 0) {
      return;
    }

    let minSlackSuccessor: TID | null = null;
    let minSlack = Infinity;

    taskSuccessors.forEach((link) => {
      const succTask = enrichedTasks.get(link.target);
      if (succTask && succTask.slack < minSlack) {
        minSlack = succTask.slack;
        minSlackSuccessor = link.target;
      }
    });

    if (minSlackSuccessor !== null) {
      tracePath(minSlackSuccessor);
    }
  };

  startTasks.forEach((startId) => {
    visited.clear();
    tracePath(startId);
  });

  enrichedTasks.forEach((task) => {
    if (!criticalPath.has(task.id!)) {
      task.isCritical = false;
    }
    result.push(task);
  });

  return result;
}

function topologicalSort(tasks: ITask[], links: ILink[]): TID[] {
  const inDegree = new Map<TID, number>();
  const adjacency = new Map<TID, TID[]>();

  tasks.forEach((task) => {
    inDegree.set(task.id!, 0);
    adjacency.set(task.id!, []);
  });

  links.forEach((link) => {
    const current = inDegree.get(link.target) || 0;
    inDegree.set(link.target, current + 1);
    adjacency.get(link.source)!.push(link.target);
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
      const currentDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, currentDegree);
      if (currentDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  return result;
}

function getTaskDuration(task: ITask): number {
  if (task.duration !== undefined) {
    return task.duration;
  }

  if (task.start && task.end) {
    const diff = task.end.getTime() - task.start.getTime();
    return Math.ceil(diff / MS_PER_DAY);
  }

  return 1;
}

function getLinkLag(link: ILink): number {
  return (link as any).lag || 0;
}

export function getCriticalTaskIds(tasks: ICriticalPathTask[]): TID[] {
  return tasks.filter((t) => t.isCritical).map((t) => t.id!);
}

export function isTaskOnCriticalPath(
  taskId: TID,
  criticalTasks: ICriticalPathTask[],
): boolean {
  const task = criticalTasks.find((t) => t.id === taskId);
  return task ? task.isCritical : false;
}
