import type { ITask, TID } from '@svar-ui/gantt-store';
import type { GanttTask } from '../types/gantt';
import type { ISplitTask, ISplitTaskPart } from './types';

export function createSplitTask(
  originalTask: ITask,
  parts: Array<{ start: Date; end: Date }>,
): ISplitTask {
  const splitParts: ISplitTaskPart[] = parts.map((part, index) => ({
    id: `${originalTask.id}_part_${index + 1}` as TID,
    start: part.start,
    end: part.end,
    duration: calculateDuration(part.start, part.end),
  }));

  return {
    id: originalTask.id!,
    parts: splitParts,
  };
}

export function mergeSplitTask(splitTask: ISplitTask): ITask {
  if (splitTask.parts.length === 0) {
    throw new Error('Cannot merge split task with no parts');
  }

  const sortedParts = [...splitTask.parts].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const start = sortedParts[0].start;
  const end = sortedParts[sortedParts.length - 1].end;
  const totalDuration = sortedParts.reduce(
    (sum, part) => sum + part.duration,
    0,
  );

  return {
    id: splitTask.id,
    start,
    end,
    duration: totalDuration,
  };
}

export function isSplitTask(task: ITask): boolean {
  return (
    Array.isArray((task as GanttTask).splitParts) &&
    (task as GanttTask).splitParts!.length > 1
  );
}

export function getSplitParts(task: ITask): ISplitTaskPart[] {
  return (task as GanttTask).splitParts || [];
}

export function addSplitPart(
  splitTask: ISplitTask,
  start: Date,
  end: Date,
): ISplitTask {
  const newPart: ISplitTaskPart = {
    id: `${splitTask.id}_part_${splitTask.parts.length + 1}` as TID,
    start,
    end,
    duration: calculateDuration(start, end),
  };

  const newParts = [...splitTask.parts, newPart].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  return {
    ...splitTask,
    parts: newParts,
  };
}

export function removeSplitPart(
  splitTask: ISplitTask,
  partId: TID,
): ISplitTask {
  return {
    ...splitTask,
    parts: splitTask.parts.filter((p) => p.id !== partId),
  };
}

export function updateSplitPart(
  splitTask: ISplitTask,
  partId: TID,
  updates: Partial<ISplitTaskPart>,
): ISplitTask {
  return {
    ...splitTask,
    parts: splitTask.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            ...updates,
            duration: calculateDuration(
              updates.start || part.start,
              updates.end || part.end,
            ),
          }
        : part,
    ),
  };
}

export function splitTaskAt(task: ITask, splitDate: Date): ISplitTask {
  if (!task.start || !task.end) {
    throw new Error('Task must have start and end dates to split');
  }

  if (splitDate <= task.start || splitDate >= task.end) {
    throw new Error('Split date must be within task duration');
  }

  return createSplitTask(task, [
    { start: task.start, end: splitDate },
    { start: splitDate, end: task.end },
  ]);
}

export function calculateGapsInSplitTask(
  splitTask: ISplitTask,
): Array<{ start: Date; end: Date; duration: number }> {
  if (splitTask.parts.length < 2) return [];

  const sortedParts = [...splitTask.parts].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const gaps: Array<{ start: Date; end: Date; duration: number }> = [];

  for (let i = 0; i < sortedParts.length - 1; i++) {
    const currentEnd = sortedParts[i].end;
    const nextStart = sortedParts[i + 1].start;

    if (currentEnd < nextStart) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: calculateDuration(currentEnd, nextStart),
      });
    }
  }

  return gaps;
}

function calculateDuration(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function visualizeSplitTask(splitTask: ISplitTask): Array<{
  id: TID;
  start: Date;
  end: Date;
  duration: number;
  isGap: boolean;
}> {
  const sortedParts = [...splitTask.parts].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const result: Array<{
    id: TID;
    start: Date;
    end: Date;
    duration: number;
    isGap: boolean;
  }> = [];

  for (let i = 0; i < sortedParts.length; i++) {
    result.push({ ...sortedParts[i], isGap: false });

    if (i < sortedParts.length - 1) {
      const gapStart = sortedParts[i].end;
      const gapEnd = sortedParts[i + 1].start;

      if (gapStart < gapEnd) {
        result.push({
          id: `gap_${i}` as TID,
          start: gapStart,
          end: gapEnd,
          duration: calculateDuration(gapStart, gapEnd),
          isGap: true,
        });
      }
    }
  }

  return result;
}
