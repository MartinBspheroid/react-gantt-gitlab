import { describe, it, expect } from 'vitest';
import {
  scheduleTasks,
  rescheduleFromTask,
  getAffectedSuccessors,
  detectCircularDependencies,
  removeInvalidLinks,
} from '../Schedule';
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

  describe('3-level dependency chain', () => {
    it('should cascade changes through 3 levels', () => {
      const tasks = [
        createTaskWithDefaults(
          'A',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('B', 3),
        createTaskNoDates('C', 2),
      ];
      const links = [createLink('A', 'B'), createLink('B', 'C')];

      const result = scheduleTasks(tasks, links);

      const taskASchedule = result.tasks.get('A')!;
      const taskBSchedule = result.tasks.get('B')!;
      const taskCSchedule = result.tasks.get('C')!;

      expect(taskBSchedule.start.getTime()).toBeGreaterThanOrEqual(
        taskASchedule.end.getTime(),
      );
      expect(taskCSchedule.start.getTime()).toBeGreaterThanOrEqual(
        taskBSchedule.end.getTime(),
      );

      expect(result.affectedTaskIds).toContain('B');
      expect(result.affectedTaskIds).toContain('C');
    });

    it('should respect dependencies in long chain with lag', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-03'),
        ),
        createTaskNoDates('2', 2),
        createTaskNoDates('3', 2),
        createTaskNoDates('4', 2),
      ];
      const links: ILink[] = [
        { id: '1-2', source: '1', target: '2', type: 'e2s', lag: 2 } as ILink,
        createLink('2', '3'),
        createLink('3', '4'),
      ];

      const result = scheduleTasks(tasks, links);

      const task1Schedule = result.tasks.get('1')!;
      const task2Schedule = result.tasks.get('2')!;

      const expectedStart = new Date(task1Schedule.end);
      expectedStart.setDate(expectedStart.getDate() + 1 + 2);

      expect(task2Schedule.start.getTime()).toBeGreaterThanOrEqual(
        expectedStart.getTime(),
      );
    });
  });

  describe('lag time support', () => {
    const createLinkWithLag = (
      source: string,
      target: string,
      lag: number,
    ): ILink =>
      ({
        id: `${source}-${target}`,
        source,
        target,
        type: 'e2s',
        lag,
      }) as ILink;

    it('should apply positive lag (delay) between tasks', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLinkWithLag('1', '2', 3)];

      const result = scheduleTasks(tasks, links);

      const task1Schedule = result.tasks.get('1')!;
      const task2Schedule = result.tasks.get('2')!;

      const minStart = new Date(task1Schedule.end);
      minStart.setDate(minStart.getDate() + 1 + 3);

      expect(task2Schedule.start.getTime()).toBeGreaterThanOrEqual(
        minStart.getTime(),
      );
    });

    it('should handle negative lag (lead time)', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-10'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLinkWithLag('1', '2', -2)];

      const result = scheduleTasks(tasks, links);

      const task1Schedule = result.tasks.get('1')!;
      const task2Schedule = result.tasks.get('2')!;

      const normalStart = new Date(task1Schedule.end);
      normalStart.setDate(normalStart.getDate() + 1);

      expect(task2Schedule.start.getTime()).toBeLessThanOrEqual(
        normalStart.getTime(),
      );
    });

    it('should handle zero lag (standard dependency)', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLinkWithLag('1', '2', 0)];

      const result = scheduleTasks(tasks, links);

      const task1Schedule = result.tasks.get('1')!;
      const task2Schedule = result.tasks.get('2')!;

      const expectedStart = new Date(task1Schedule.end);
      expectedStart.setDate(expectedStart.getDate() + 1);

      expect(task2Schedule.start.getTime()).toBeGreaterThanOrEqual(
        expectedStart.getTime(),
      );
    });
  });

  describe('projectStart constraint', () => {
    it('should respect projectStart for first task', () => {
      const tasks = [createTaskNoDates('1', 5)];
      const projectStart = new Date('2024-02-15');

      const result = scheduleTasks(tasks, [], undefined, undefined, {
        projectStart,
      });

      const task1Schedule = result.tasks.get('1')!;
      expect(task1Schedule.start.getTime()).toBeGreaterThanOrEqual(
        projectStart.getTime(),
      );
    });

    it('should not move tasks before projectStart', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLink('1', '2')];
      const projectStart = new Date('2024-01-15');

      const result = scheduleTasks(tasks, [], undefined, undefined, {
        projectStart,
      });

      const task1Schedule = result.tasks.get('1')!;
      expect(task1Schedule.start.getTime()).toBeGreaterThanOrEqual(
        projectStart.getTime(),
      );
    });
  });

  describe('rescheduleFromTask', () => {
    it('should reschedule only affected successors', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
        createTaskNoDates('3', 2),
        createTaskWithDefaults(
          '4',
          new Date('2024-01-01'),
          new Date('2024-01-03'),
        ),
      ];
      const links = [createLink('1', '2'), createLink('2', '3')];

      const result = rescheduleFromTask('1', tasks, links);

      expect(result.affectedTaskIds).toContain('1');
      expect(result.affectedTaskIds).toContain('2');
      expect(result.affectedTaskIds).toContain('3');
      expect(result.affectedTaskIds).not.toContain('4');
    });
  });

  describe('getAffectedSuccessors', () => {
    it('should return all downstream task IDs', () => {
      const links: ILink[] = [
        createLink('A', 'B'),
        createLink('B', 'C'),
        createLink('C', 'D'),
        createLink('X', 'Y'),
      ];

      const affected = getAffectedSuccessors('A', links);

      expect(affected).toContain('B');
      expect(affected).toContain('C');
      expect(affected).toContain('D');
      expect(affected).not.toContain('A');
      expect(affected).not.toContain('X');
      expect(affected).not.toContain('Y');
    });

    it('should handle branching dependencies', () => {
      const links: ILink[] = [
        createLink('A', 'B'),
        createLink('A', 'C'),
        createLink('B', 'D'),
        createLink('C', 'D'),
      ];

      const affected = getAffectedSuccessors('A', links);

      expect(affected).toEqual(expect.arrayContaining(['B', 'C', 'D']));
      expect(affected).toHaveLength(3);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      const tasks = [
        createTaskWithDefaults('A'),
        createTaskWithDefaults('B'),
        createTaskWithDefaults('C'),
      ];
      const links = [
        createLink('A', 'B'),
        createLink('B', 'C'),
        createLink('C', 'A'),
      ];

      const cycles = detectCircularDependencies(tasks, links);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty array when no cycles exist', () => {
      const tasks = [
        createTaskWithDefaults('A'),
        createTaskWithDefaults('B'),
        createTaskWithDefaults('C'),
      ];
      const links = [createLink('A', 'B'), createLink('B', 'C')];

      const cycles = detectCircularDependencies(tasks, links);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('removeInvalidLinks', () => {
    it('should remove self-referential links', () => {
      const tasks = [createTaskWithDefaults('1')];
      const links: ILink[] = [
        { id: 'self', source: '1', target: '1', type: 'e2s' },
      ];

      const { validLinks, removedLinks } = removeInvalidLinks(tasks, links);

      expect(validLinks).toHaveLength(0);
      expect(removedLinks).toHaveLength(1);
    });

    it('should remove links to non-existent tasks', () => {
      const tasks = [createTaskWithDefaults('1')];
      const links = [createLink('1', 'nonexistent')];

      const { validLinks, removedLinks } = removeInvalidLinks(tasks, links);

      expect(validLinks).toHaveLength(0);
      expect(removedLinks).toHaveLength(1);
    });

    it('should keep valid links', () => {
      const tasks = [createTaskWithDefaults('1'), createTaskWithDefaults('2')];
      const links = [createLink('1', '2')];

      const { validLinks, removedLinks } = removeInvalidLinks(tasks, links);

      expect(validLinks).toHaveLength(1);
      expect(removedLinks).toHaveLength(0);
    });

    it('should remove summary-to-child links', () => {
      const parentTask: ITask = {
        id: 'parent',
        text: 'Parent',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
        parent: 0,
      };
      const childTask: ITask = {
        id: 'child',
        text: 'Child',
        start: new Date('2024-01-02'),
        end: new Date('2024-01-05'),
        parent: 'parent',
      };
      const tasks = [parentTask, childTask];
      const links = [createLink('parent', 'child')];

      const { validLinks, removedLinks } = removeInvalidLinks(tasks, links);

      expect(validLinks).toHaveLength(0);
      expect(removedLinks).toHaveLength(1);
    });
  });

  describe('onScheduleTask callback', () => {
    it('should call callback for each changed task', () => {
      const tasks = [
        createTaskWithDefaults(
          '1',
          new Date('2024-01-01'),
          new Date('2024-01-05'),
        ),
        createTaskNoDates('2', 3),
      ];
      const links = [createLink('1', '2')];
      const scheduledTasks: string[] = [];

      scheduleTasks(tasks, links, undefined, undefined, undefined, (taskId) => {
        scheduledTasks.push(String(taskId));
      });

      expect(scheduledTasks.length).toBeGreaterThan(0);
    });
  });
});
