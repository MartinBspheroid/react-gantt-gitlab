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

  describe('strict mode', () => {
    it('should use strict mode by default', () => {
      const baseDate = new Date('2024-01-01');
      const tasks: ITask[] = [
        createTask('1', baseDate, new Date('2024-01-03'), 2),
        createTask('2', new Date('2024-01-03'), new Date('2024-01-06'), 3),
      ];
      const links: ILink[] = [createLink('1', '2')];

      const result = calculateCriticalPath(tasks, links, {
        config: { type: 'strict' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].isCritical).toBe(true);
      expect(result[1].isCritical).toBe(true);
    });

    it('should identify tasks with zero slack as critical', () => {
      const baseDate = new Date('2024-01-01');
      const tasks: ITask[] = [
        createTask('1', baseDate, new Date('2024-01-02'), 1),
        createTask('2', new Date('2024-01-02'), new Date('2024-01-04'), 2),
        createTask('3', new Date('2024-01-04'), new Date('2024-01-06'), 2),
      ];
      const links: ILink[] = [createLink('1', '2'), createLink('2', '3')];

      const result = calculateCriticalPath(tasks, links, {
        config: { type: 'strict' },
      });

      const criticalTasks = result.filter((t) => t.isCritical);
      criticalTasks.forEach((t) => {
        expect(t.slack).toBe(0);
      });
    });
  });

  describe('flexible mode', () => {
    it('should use greedy forward selection in flexible mode', () => {
      const baseDate = new Date('2024-01-01');
      const tasks: ITask[] = [
        createTask('1', baseDate, new Date('2024-01-02'), 1),
        createTask('2', new Date('2024-01-02'), new Date('2024-01-04'), 2),
        createTask('3', new Date('2024-01-04'), new Date('2024-01-06'), 2),
      ];
      const links: ILink[] = [createLink('1', '2'), createLink('2', '3')];

      const result = calculateCriticalPath(tasks, links, {
        config: { type: 'flexible' },
      });

      expect(result).toHaveLength(3);
      const criticalIds = getCriticalTaskIds(result);
      expect(criticalIds).toContain('1');
      expect(criticalIds).toContain('2');
      expect(criticalIds).toContain('3');
    });

    it('should select path with minimum slack in parallel branches', () => {
      const baseDate = new Date('2024-01-01');
      const tasks: ITask[] = [
        createTask('start', baseDate, new Date('2024-01-02'), 1),
        createTask('short', new Date('2024-01-02'), new Date('2024-01-03'), 1),
        createTask('long', new Date('2024-01-02'), new Date('2024-01-10'), 8),
        createTask('end', new Date('2024-01-10'), new Date('2024-01-11'), 1),
      ];
      const links: ILink[] = [
        createLink('start', 'short'),
        createLink('start', 'long'),
        createLink('short', 'end'),
        createLink('long', 'end'),
      ];

      const result = calculateCriticalPath(tasks, links, {
        config: { type: 'flexible' },
      });

      const longTask = result.find((t) => t.id === 'long');
      expect(longTask?.isCritical).toBe(true);
    });
  });

  describe('project boundaries', () => {
    it('should use projectStart as earliest start time', () => {
      const projectStart = new Date('2024-01-05');
      const tasks: ITask[] = [
        createTask('1', new Date('2024-01-01'), new Date('2024-01-02'), 1),
      ];

      const result = calculateCriticalPath(tasks, [], {
        projectStart,
      });

      expect(result[0].earlyStart).toBe(projectStart.getTime());
    });

    it('should use projectEnd as latest finish time', () => {
      const projectEnd = new Date('2024-01-10');
      const tasks: ITask[] = [
        createTask('1', new Date('2024-01-01'), new Date('2024-01-05'), 4),
      ];

      const result = calculateCriticalPath(tasks, [], {
        projectEnd,
      });

      expect(result[0].lateFinish).toBe(projectEnd.getTime());
    });
  });

  describe('10-task project with known critical path', () => {
    it('should correctly identify critical path in complex project', () => {
      const baseDate = new Date('2024-01-01');

      const tasks: ITask[] = [
        createTask('A', baseDate, new Date('2024-01-02'), 1),
        createTask('B', new Date('2024-01-02'), new Date('2024-01-04'), 2),
        createTask('C', new Date('2024-01-02'), new Date('2024-01-05'), 3),
        createTask('D', new Date('2024-01-04'), new Date('2024-01-07'), 3),
        createTask('E', new Date('2024-01-05'), new Date('2024-01-08'), 3),
        createTask('F', new Date('2024-01-07'), new Date('2024-01-10'), 3),
        createTask('G', new Date('2024-01-08'), new Date('2024-01-09'), 1),
        createTask('H', new Date('2024-01-10'), new Date('2024-01-12'), 2),
        createTask('I', new Date('2024-01-09'), new Date('2024-01-11'), 2),
        createTask('J', new Date('2024-01-12'), new Date('2024-01-14'), 2),
      ];

      const links: ILink[] = [
        createLink('A', 'B'),
        createLink('A', 'C'),
        createLink('B', 'D'),
        createLink('C', 'E'),
        createLink('D', 'F'),
        createLink('E', 'G'),
        createLink('F', 'H'),
        createLink('G', 'I'),
        createLink('H', 'J'),
        createLink('I', 'J'),
      ];

      const result = calculateCriticalPath(tasks, links, {
        config: { type: 'strict' },
      });

      expect(result).toHaveLength(10);

      const criticalIds = new Set(getCriticalTaskIds(result));

      expect(criticalIds.has('A')).toBe(true);
      expect(criticalIds.has('B')).toBe(true);
      expect(criticalIds.has('D')).toBe(true);
      expect(criticalIds.has('F')).toBe(true);
      expect(criticalIds.has('H')).toBe(true);
      expect(criticalIds.has('J')).toBe(true);

      const taskC = result.find((t) => t.id === 'C');
      const taskE = result.find((t) => t.id === 'E');
      const taskG = result.find((t) => t.id === 'G');
      const taskI = result.find((t) => t.id === 'I');

      expect(taskC?.slack).toBeGreaterThan(0);
      expect(taskE?.slack).toBeGreaterThan(0);
      expect(taskG?.slack).toBeGreaterThan(0);
      expect(taskI?.slack).toBeGreaterThan(0);
    });

    it('should show slack/float for non-critical tasks', () => {
      const baseDate = new Date('2024-01-01');
      const tasks: ITask[] = [
        createTask('start', baseDate, new Date('2024-01-02'), 1),
        createTask(
          'critical',
          new Date('2024-01-02'),
          new Date('2024-01-10'),
          8,
        ),
        createTask(
          'nonCritical',
          new Date('2024-01-02'),
          new Date('2024-01-04'),
          2,
        ),
        createTask('end', new Date('2024-01-10'), new Date('2024-01-12'), 2),
      ];
      const links: ILink[] = [
        createLink('start', 'critical'),
        createLink('start', 'nonCritical'),
        createLink('critical', 'end'),
        createLink('nonCritical', 'end'),
      ];

      const result = calculateCriticalPath(tasks, links);

      const nonCriticalTask = result.find((t) => t.id === 'nonCritical');
      expect(nonCriticalTask?.slack).toBeGreaterThan(0);
      expect(nonCriticalTask?.isCritical).toBe(false);

      const criticalTask = result.find((t) => t.id === 'critical');
      expect(criticalTask?.slack).toBe(0);
      expect(criticalTask?.isCritical).toBe(true);
    });
  });
});
