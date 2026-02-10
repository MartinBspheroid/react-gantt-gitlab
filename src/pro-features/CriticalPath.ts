import type { ITask, ILink, TID } from '@svar-ui/gantt-store';
import type { ICriticalPathTask } from './types';

export function calculateCriticalPath(
  tasks: ITask[],
  links: ILink[],
): ICriticalPathTask[] {
  const taskMap = new Map<TID, ITask>();
  const result: ICriticalPathTask[] = [];

  tasks.forEach((task) => {
    taskMap.set(task.id!, task);
  });

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

  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskPredecessors = predecessors.get(taskId) || [];
    let maxEarlyFinish = 0;

    taskPredecessors.forEach((link) => {
      const predTask = enrichedTasks.get(link.source);
      if (!predTask) return;

      const lag = getLinkLag(link, predTask, task);

      if (link.type === 's2s' || link.type === 'e2s') {
        const predEarlyStart =
          link.type === 's2s' ? predTask.earlyStart : predTask.earlyFinish;
        const potentialEarlyStart = predEarlyStart + lag;
        maxEarlyFinish = Math.max(maxEarlyFinish, potentialEarlyStart);
      }
    });

    task.earlyStart = maxEarlyFinish;
    const duration = getTaskDuration(task);
    task.earlyFinish = task.earlyStart + duration;
  });

  let projectEnd = 0;
  sortedTasks.forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (task && task.earlyFinish > projectEnd) {
      projectEnd = task.earlyFinish;
    }
  });

  [...sortedTasks].reverse().forEach((taskId) => {
    const task = enrichedTasks.get(taskId);
    if (!task) return;

    const taskSuccessors = successors.get(taskId) || [];
    let minLateStart = Infinity;

    if (taskSuccessors.length === 0) {
      task.lateFinish = projectEnd;
    } else {
      taskSuccessors.forEach((link) => {
        const succTask = enrichedTasks.get(link.target);
        if (!succTask) return;

        const lag = getLinkLag(link, task, succTask);

        if (link.type === 's2e' || link.type === 's2s') {
          const succLateStart = succTask.lateStart - lag;
          minLateStart = Math.min(minLateStart, succLateStart);
        } else {
          const succLateFinish = succTask.lateFinish - lag;
          minLateStart = Math.min(minLateStart, succLateFinish);
        }
      });
      task.lateFinish = minLateStart === Infinity ? projectEnd : minLateStart;
    }

    const duration = getTaskDuration(task);
    task.lateStart = task.lateFinish - duration;
    task.slack = task.lateStart - task.earlyStart;
    task.isCritical = task.slack === 0;
  });

  enrichedTasks.forEach((task) => {
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
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return 1;
}

function getLinkLag(link: ILink, _source: ITask, _target: ITask): number {
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
