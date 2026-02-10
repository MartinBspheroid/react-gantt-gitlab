import { describe, it, expect } from 'vitest';
import {
  createSplitTask,
  mergeSplitTask,
  splitTaskAt,
  addSplitPart,
  removeSplitPart,
  calculateGapsInSplitTask,
  visualizeSplitTask,
} from '../SplitTasks';
import type { ITask } from '@svar-ui/gantt-store';

describe('SplitTasks', () => {
  const createTask = (id: string): ITask => ({
    id,
    text: `Task ${id}`,
    start: new Date('2024-01-01'),
    end: new Date('2024-01-10'),
    duration: 9,
  });

  describe('createSplitTask', () => {
    it('should create split task from parts', () => {
      const task = createTask('1');
      const parts = [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ];

      const splitTask = createSplitTask(task, parts);

      expect(splitTask.id).toBe('1');
      expect(splitTask.parts).toHaveLength(2);
      expect(splitTask.parts[0].duration).toBe(2);
    });

    it('should generate unique part IDs', () => {
      const task = createTask('1');
      const parts = [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ];

      const splitTask = createSplitTask(task, parts);

      expect(splitTask.parts[0].id).toBe('1_part_1');
      expect(splitTask.parts[1].id).toBe('1_part_2');
    });
  });

  describe('mergeSplitTask', () => {
    it('should merge split task back to single task', () => {
      const task = createTask('1');
      const parts = [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ];
      const splitTask = createSplitTask(task, parts);

      const merged = mergeSplitTask(splitTask);

      expect(merged.id).toBe('1');
      expect(merged.start).toEqual(new Date('2024-01-01'));
      expect(merged.end).toEqual(new Date('2024-01-10'));
    });

    it('should throw for empty parts', () => {
      expect(() => mergeSplitTask({ id: '1', parts: [] })).toThrow();
    });
  });

  describe('splitTaskAt', () => {
    it('should split task at given date', () => {
      const task = createTask('1');
      const splitDate = new Date('2024-01-05');

      const splitTask = splitTaskAt(task, splitDate);

      expect(splitTask.parts).toHaveLength(2);
      expect(splitTask.parts[0].end).toEqual(splitDate);
      expect(splitTask.parts[1].start).toEqual(splitDate);
    });

    it('should throw if split date is outside task range', () => {
      const task = createTask('1');

      expect(() => splitTaskAt(task, new Date('2023-12-31'))).toThrow();
      expect(() => splitTaskAt(task, new Date('2024-01-15'))).toThrow();
    });

    it('should throw if task has no dates', () => {
      const task: ITask = { id: '1', text: 'No dates' };

      expect(() => splitTaskAt(task, new Date())).toThrow();
    });
  });

  describe('addSplitPart', () => {
    it('should add new part and maintain sort order', () => {
      const task = createTask('1');
      let splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
      ]);

      splitTask = addSplitPart(
        splitTask,
        new Date('2024-01-05'),
        new Date('2024-01-08'),
      );

      expect(splitTask.parts).toHaveLength(2);
      expect(splitTask.parts[1].start).toEqual(new Date('2024-01-05'));
    });
  });

  describe('removeSplitPart', () => {
    it('should remove specified part', () => {
      const task = createTask('1');
      let splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ]);

      splitTask = removeSplitPart(splitTask, splitTask.parts[0].id);

      expect(splitTask.parts).toHaveLength(1);
    });
  });

  describe('calculateGapsInSplitTask', () => {
    it('should identify gaps between parts', () => {
      const task = createTask('1');
      const splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ]);

      const gaps = calculateGapsInSplitTask(splitTask);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].start).toEqual(new Date('2024-01-03'));
      expect(gaps[0].end).toEqual(new Date('2024-01-05'));
    });

    it('should return empty array for contiguous parts', () => {
      const task = createTask('1');
      const splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-05') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ]);

      const gaps = calculateGapsInSplitTask(splitTask);

      expect(gaps).toHaveLength(0);
    });

    it('should return empty array for single part', () => {
      const task = createTask('1');
      const splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-10') },
      ]);

      const gaps = calculateGapsInSplitTask(splitTask);

      expect(gaps).toHaveLength(0);
    });
  });

  describe('visualizeSplitTask', () => {
    it('should return parts with gaps included', () => {
      const task = createTask('1');
      const splitTask = createSplitTask(task, [
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') },
        { start: new Date('2024-01-05'), end: new Date('2024-01-10') },
      ]);

      const visual = visualizeSplitTask(splitTask);

      expect(visual).toHaveLength(3);
      expect(visual[0].isGap).toBe(false);
      expect(visual[1].isGap).toBe(true);
      expect(visual[2].isGap).toBe(false);
    });
  });
});
