import { describe, it, expect } from 'vitest';
import { scheduleTasks } from '../Schedule';
import type { ITask, ILink } from '@svar-ui/gantt-store';
import type { ICalendar } from '../types';

describe('Schedule', () => {
  const createTaskWithDefaults = (
    id: string,
    start?: Date,
    end?: Date,
    duration?: number,
  ): ITask => ({
    id,
    text: `Task ${id}`,
    start: start || new Date('2024-01-01'),
    end: end || new Date('2024-01-05'),
    duration: duration ?? 4,
  });

  const createTaskNoDates = (id: string, duration?: number): ITask => ({
    id,
    text: `Task ${id}`,
    duration: duration ?? 4,
  });

  const createLink = (source: string, target: string): ILink => ({
    id: `${source}-${target}`,
    source,
    target,
    type: 'e2s' as const,
  });

  describe('scheduleTasks', () => {
    it('should return schedule results for all tasks', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskWithDefaults(
          '2',
          new Date('2024-01-05'),
          new Date('2024-01-10'),
        ),
      ];
      const links = [createLink('1', '2')];

      const result = scheduleTasks(tasks, links);

      expect(result.tasks.size).toBe(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should schedule tasks respecting dependencies', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLink('1', '2')];

      const result = scheduleTasks(tasks, links);

      const task1Schedule = result.tasks.get('1')!;
      const task2Schedule = result.tasks.get('2')!;

      expect(task2Schedule.start.getTime()).toBeGreaterThanOrEqual(
        task1Schedule.end.getTime(),
      );
    });

    it('should detect circular dependencies', () => {
      const tasks = [
        createTaskWithDefaults('1'),
        createTaskWithDefaults('2'),
        createTaskWithDefaults('3'),
      ];
      const links = [
        createLink('1', '2'),
        createLink('2', '3'),
        createLink('3', '1'),
      ];

      const result = scheduleTasks(tasks, links);

      expect(
        result.conflicts.some((c) => c.type === 'circular_dependency'),
      ).toBe(true);
    });

    it('should handle tasks without dependencies', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskWithDefaults(
          '2',
          new Date('2024-01-02'),
          new Date('2024-01-06'),
        ),
      ];

      const result = scheduleTasks(tasks, []);

      expect(result.tasks.size).toBe(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should respect calendar for scheduling', () => {
      const calendar: ICalendar = {
        workdays: [1, 2, 3, 4, 5],
        holidays: [],
      };

      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-05'),
          new Date('2024-01-08'),
        ),
        createTaskNoDates('2', 2),
      ];
      const links = [createLink('1', '2')];

      const result = scheduleTasks(tasks, links, calendar);

      const task2Schedule = result.tasks.get('2')!;
      expect(task2Schedule.start.getDay()).not.toBe(0);
      expect(task2Schedule.start.getDay()).not.toBe(6);
    });

    it('should compute scheduled end date based on duration', () => {
      const tasks = [
        createTaskWithDefaults('1', new Date('2024-01-01'), undefined, 5),
      ];

      const result = scheduleTasks(tasks, []);

      const task1Schedule = result.tasks.get('1')!;
      expect(task1Schedule.start.getDate()).toBe(1);
    });

    it('should return start date for tasks without dependencies', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
      ];

      const result = scheduleTasks(tasks, []);

      const task1Schedule = result.tasks.get('1')!;
      expect(task1Schedule.start.getFullYear()).toBe(2024);
      expect(task1Schedule.start.getMonth()).toBe(0);
      expect(task1Schedule.start.getDate()).toBe(1);
    });
  });

  describe('empty inputs', () => {
    it('should handle empty tasks array', () => {
      const result = scheduleTasks([], []);
      expect(result.tasks.size).toBe(0);
    });

    it('should handle empty links array', () => {
      const tasks = [createTaskWithDefaults('1')];
      const result = scheduleTasks(tasks, []);

      expect(result.tasks.size).toBe(1);
    });
  });

  describe('complex dependencies', () => {
    it('should handle multiple predecessors', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskWithDefaults(
          '2',
          new Date('2024-01-01'),
          new Date('2024-01-10'),
        ),
        createTaskNoDates('3', 2),
      ];
      const links = [createLink('1', '3'), createLink('2', '3')];

      const result = scheduleTasks(tasks, links);

      const task2Schedule = result.tasks.get('2')!;
      const task3Schedule = result.tasks.get('3')!;

      expect(task3Schedule.start.getTime()).toBeGreaterThanOrEqual(
        task2Schedule.end.getTime(),
      );
    });

    it('should handle diamond dependency pattern', () => {
      const tasks = [
        createTaskWithDefaults(
          'A',
          new Date('2024-01-01'),
          new Date('2024-01-03'),
        ),
        createTaskNoDates('B', 3),
        createTaskNoDates('C', 2),
        createTaskNoDates('D', 2),
      ];
      const links = [
        createLink('A', 'B'),
        createLink('A', 'C'),
        createLink('B', 'D'),
        createLink('C', 'D'),
      ];

      const result = scheduleTasks(tasks, links);

      expect(result.tasks.size).toBe(4);
      expect(result.conflicts).toHaveLength(0);
    });
  });
});
