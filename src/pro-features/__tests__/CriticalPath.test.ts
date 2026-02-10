import { describe, it, expect } from 'vitest';
import {
  calculateCriticalPath,
  getCriticalTaskIds,
  isTaskOnCriticalPath,
} from '../CriticalPath';
import type { ITask, ILink } from '@svar-ui/gantt-store';

describe('CriticalPath', () => {
  const createTask = (
    id: string,
    start: Date,
    end: Date,
    duration?: number,
  ): ITask => ({
    id,
    start,
    end,
    duration,
    text: `Task ${id}`,
  });

  const createLink = (
    source: string,
    target: string,
    type: ILink['type'] = 'e2s',
  ): ILink => ({
    id: `${source}-${target}`,
    source,
    target,
    type,
  });

  it('should return enriched tasks with critical path data', () => {
    const baseDate = new Date('2024-01-01');
    const tasks: ITask[] = [
      createTask('1', baseDate, new Date('2024-01-03'), 2),
      createTask('2', new Date('2024-01-03'), new Date('2024-01-06'), 3),
    ];
    const links: ILink[] = [createLink('1', '2')];

    const result = calculateCriticalPath(tasks, links);

    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('earlyStart');
    expect(result[0]).toHaveProperty('earlyFinish');
    expect(result[0]).toHaveProperty('lateStart');
    expect(result[0]).toHaveProperty('lateFinish');
    expect(result[0]).toHaveProperty('slack');
    expect(result[0]).toHaveProperty('isCritical');
  });

  it('should calculate critical path for simple chain', () => {
    const baseDate = new Date('2024-01-01');
    const tasks: ITask[] = [
      createTask('1', baseDate, new Date('2024-01-03'), 2),
      createTask('2', new Date('2024-01-03'), new Date('2024-01-06'), 3),
      createTask('3', new Date('2024-01-06'), new Date('2024-01-08'), 2),
    ];
    const links: ILink[] = [createLink('1', '2'), createLink('2', '3')];

    const result = calculateCriticalPath(tasks, links);

    expect(result).toHaveLength(3);
    const criticalIds = getCriticalTaskIds(result);
    expect(criticalIds.length).toBeGreaterThan(0);
  });

  it('should return empty array for empty tasks', () => {
    const result = calculateCriticalPath([], []);
    expect(result).toHaveLength(0);
  });

  it('should handle tasks without links', () => {
    const baseDate = new Date('2024-01-01');
    const tasks: ITask[] = [
      createTask('1', baseDate, new Date('2024-01-03'), 2),
      createTask('2', baseDate, new Date('2024-01-05'), 4),
    ];

    const result = calculateCriticalPath(tasks, []);

    expect(result).toHaveLength(2);
    result.forEach((task) => {
      expect(task).toHaveProperty('isCritical');
    });
  });

  it('should identify if task exists in results', () => {
    const baseDate = new Date('2024-01-01');
    const tasks: ITask[] = [
      createTask('1', baseDate, new Date('2024-01-03'), 2),
      createTask('2', new Date('2024-01-03'), new Date('2024-01-05'), 2),
    ];
    const links: ILink[] = [createLink('1', '2')];

    const result = calculateCriticalPath(tasks, links);

    expect(result.find((t) => t.id === '1')).toBeDefined();
    expect(result.find((t) => t.id === '2')).toBeDefined();
    expect(isTaskOnCriticalPath('nonexistent', result)).toBe(false);
  });

  it('should calculate slack for parallel paths', () => {
    const baseDate = new Date('2024-01-01');
    const tasks: ITask[] = [
      createTask('start', baseDate, new Date('2024-01-02'), 1),
      createTask('path1', new Date('2024-01-02'), new Date('2024-01-10'), 8),
      createTask('path2', new Date('2024-01-02'), new Date('2024-01-05'), 3),
      createTask('end', new Date('2024-01-10'), new Date('2024-01-12'), 2),
    ];
    const links: ILink[] = [
      createLink('start', 'path1'),
      createLink('start', 'path2'),
      createLink('path1', 'end'),
      createLink('path2', 'end'),
    ];

    const result = calculateCriticalPath(tasks, links);

    const path1 = result.find((t) => t.id === 'path1');
    const path2 = result.find((t) => t.id === 'path2');

    expect(path1).toBeDefined();
    expect(path2).toBeDefined();
    expect(path2!.slack).toBeGreaterThanOrEqual(path1!.slack);
  });
});
