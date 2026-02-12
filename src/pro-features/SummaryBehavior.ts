import type { ITask, IApi, TID } from '@svar-ui/gantt-store';
import type { ISummaryConfig } from './types';

const dayMs = 24 * 60 * 60 * 1000;

function getDurationInDays(task: ITask): number {
  if (task.duration != null) {
    return task.duration;
  }
  if (task.start && task.end) {
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    return Math.ceil(Math.abs(end - start) / dayMs);
  }
  return 0;
}

export function calculateSummaryProgress(api: IApi, summaryId: TID): number {
  const task = api.getTask(summaryId);
  if (!task?.data?.length) return 0;

  let totalProgress = 0;
  let totalDuration = 0;

  function collectFromChildren(children: ITask[]): void {
    for (const child of children) {
      if (child.type === 'milestone') continue;

      if (child.type === 'summary' && child.data?.length) {
        collectFromChildren(child.data);
      } else if (child.type !== 'summary') {
        const duration = getDurationInDays(child);
        const progress = child.progress ?? 0;
        totalDuration += duration;
        totalProgress += duration * progress;
      }
    }
  }

  collectFromChildren(task.data);

  if (totalDuration === 0) return 0;
  const result = totalProgress / totalDuration;
  return isNaN(result) ? 0 : Math.round(result * 100) / 100;
}

export function calculateSummaryDateRange(
  api: IApi,
  summaryId: TID,
): { start: Date | null; end: Date | null } {
  const task = api.getTask(summaryId);
  if (!task?.data?.length) {
    return { start: null, end: null };
  }

  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  function collectFromChildren(children: ITask[]): void {
    for (const child of children) {
      if (child.type === 'milestone' && child.start) {
        const childStart = new Date(child.start);
        if (!minStart || childStart < minStart) minStart = childStart;
        if (!maxEnd || childStart > maxEnd) maxEnd = childStart;
      } else if (child.type === 'summary' && child.data?.length) {
        collectFromChildren(child.data);
      } else if (child.start && child.end) {
        const childStart = new Date(child.start);
        const childEnd = new Date(child.end);
        if (!minStart || childStart < minStart) minStart = childStart;
        if (!maxEnd || childEnd > maxEnd) maxEnd = childEnd;
      }
    }
  }

  collectFromChildren(task.data);

  return { start: minStart, end: maxEnd };
}

export function shouldConvertToSummary(api: IApi, taskId: TID): boolean {
  const task = api.getTask(taskId);
  if (!task) return false;
  if (task.type === 'summary') return false;
  return !!task.data?.length;
}

export function shouldConvertToTask(api: IApi, taskId: TID): boolean {
  const task = api.getTask(taskId);
  if (!task) return false;
  if (task.type !== 'summary') return false;
  return !task.data?.length;
}

export function getSummaryChain(api: IApi, taskId: TID): TID[] {
  const chain: TID[] = [];
  const { tasks } = api.getState();

  let currentId: TID | undefined = taskId;
  while (currentId) {
    const task = api.getTask(currentId);
    if (task?.type === 'summary') {
      chain.push(currentId);
    }
    currentId = tasks.getSummaryId(currentId);
  }

  return chain;
}

export function updateSummaryProgress(
  api: IApi,
  summaryId: TID,
  skipUndo = true,
): void {
  const task = api.getTask(summaryId);
  if (!task || task.type !== 'summary') return;

  const progress = calculateSummaryProgress(api, summaryId);
  api.exec('update-task', {
    id: summaryId,
    task: { progress },
    skipUndo,
  });
}

export function updateSummaryDateRange(
  api: IApi,
  summaryId: TID,
  skipUndo = true,
): void {
  const task = api.getTask(summaryId);
  if (!task || task.type !== 'summary') return;

  const { start, end } = calculateSummaryDateRange(api, summaryId);
  if (start && end) {
    api.exec('update-task', {
      id: summaryId,
      task: { start, end },
      skipUndo,
    });
  }
}

export function convertToSummary(
  api: IApi,
  taskId: TID,
  skipUndo = true,
): void {
  const task = api.getTask(taskId);
  if (!task || task.type === 'summary') return;

  api.exec('update-task', {
    id: taskId,
    task: { type: 'summary' },
    skipUndo,
  });
}

export function convertToTask(api: IApi, taskId: TID, skipUndo = true): void {
  const task = api.getTask(taskId);
  if (!task || task.type !== 'summary') return;
  if (task.data?.length) return;

  api.exec('update-task', {
    id: taskId,
    task: { type: 'task' },
    skipUndo,
  });
}
