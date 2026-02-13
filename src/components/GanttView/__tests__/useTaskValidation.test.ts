/**
 * useTaskValidation Hook Tests
 * Tests for task validation logic: invalid task detection and orphaned task detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskValidation } from '../useTaskValidation';

describe('useTaskValidation', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  // =========================================================================
  // Invalid task detection
  // =========================================================================

  describe('invalid task detection', () => {
    it('should return empty invalidTasks array when all tasks are valid', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01' },
        { id: 2, text: 'Task 2', start: '2024-01-02' },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.invalidTasks).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should detect tasks missing id', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01' },
        { text: 'Task 2', start: '2024-01-02' } as any,
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.invalidTasks).toHaveLength(1);
      expect(result.current.invalidTasks[0]).toEqual(tasks[1]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[GanttView RENDER] Found invalid tasks:',
        [tasks[1]],
      );
    });

    it('should detect tasks missing text', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01' },
        { id: 2, start: '2024-01-02' } as any,
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.invalidTasks).toHaveLength(1);
      expect(result.current.invalidTasks[0]).toEqual(tasks[1]);
    });

    it('should detect tasks missing start', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01' },
        { id: 2, text: 'Task 2' } as any,
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.invalidTasks).toHaveLength(1);
      expect(result.current.invalidTasks[0]).toEqual(tasks[1]);
    });

    it('should detect multiple invalid tasks', () => {
      const tasks = [
        { text: 'Task 1' } as any,
        { id: 2, start: '2024-01-02' } as any,
        { id: 3, text: 'Task 3' } as any,
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.invalidTasks).toHaveLength(3);
    });
  });

  // =========================================================================
  // Orphaned task detection
  // =========================================================================

  describe('orphaned task detection', () => {
    it('should not flag tasks with parent=0 as orphaned', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01', parent: 0 },
        { id: 2, text: 'Task 2', start: '2024-01-02', parent: 0 },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toEqual([]);
    });

    it('should not flag tasks with valid parent as orphaned', () => {
      const tasks = [
        { id: 1, text: 'Parent', start: '2024-01-01', parent: 0 },
        { id: 2, text: 'Child', start: '2024-01-02', parent: 1 },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toEqual([]);
    });

    it('should detect tasks with missing parent as orphaned', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01', parent: 0 },
        { id: 2, text: 'Orphaned', start: '2024-01-02', parent: 999 },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toHaveLength(1);
      expect(result.current.orphanedTasks[0]).toEqual(tasks[1]);
    });

    it('should detect issues with Epic parents (epicParentId metadata)', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01', parent: 0 },
        {
          id: 2,
          text: 'Issue with Epic',
          start: '2024-01-02',
          parent: 999,
          _source: { type: 'issue', epicParentId: 100 },
        },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toHaveLength(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[GanttView] Some issues belong to Epics (not supported):',
        expect.objectContaining({
          epicIds: [100],
          affectedIssues: 1,
          note: 'Epic support is not implemented. These issues will appear at root level.',
        }),
      );
    });

    it('should log error for tasks with missing parents (not Epic issues)', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01', parent: 0 },
        {
          id: 2,
          text: 'Orphaned Task',
          start: '2024-01-02',
          parent: 999,
          type: 'task',
        },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toHaveLength(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[GanttView RENDER] Found orphaned tasks (parent does not exist):',
        expect.objectContaining({
          count: 1,
          orphanedTaskIds: expect.arrayContaining([
            expect.objectContaining({
              id: 2,
              parent: 999,
              text: 'Orphaned Task',
              type: 'task',
            }),
          ]),
          missingParentIds: [999],
        }),
      );
    });

    it('should handle both Epic issues and orphaned tasks separately', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01', parent: 0 },
        {
          id: 2,
          text: 'Epic Issue',
          start: '2024-01-02',
          parent: 100,
          _source: { type: 'issue', epicParentId: 100 },
        },
        {
          id: 3,
          text: 'Orphaned Task',
          start: '2024-01-03',
          parent: 999,
          type: 'task',
        },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current.orphanedTasks).toHaveLength(2);
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Memoization
  // =========================================================================

  describe('memoization', () => {
    it('should return same result when tasks array is unchanged', () => {
      const tasks = [{ id: 1, text: 'Task 1', start: '2024-01-01' }];

      const { result, rerender } = renderHook(
        ({ tasks }) => useTaskValidation(tasks),
        { initialProps: { tasks } },
      );

      const firstResult = result.current;

      rerender({ tasks });

      expect(result.current).toBe(firstResult);
    });

    it('should recompute when tasks array changes', () => {
      const tasks1 = [{ id: 1, text: 'Task 1', start: '2024-01-01' }];
      const tasks2 = [{ id: 1, text: 'Task 1', start: '2024-01-01' }];

      const { result, rerender } = renderHook(
        ({ tasks }) => useTaskValidation(tasks),
        { initialProps: { tasks: tasks1 } },
      );

      const firstResult = result.current;

      rerender({ tasks: tasks2 });

      expect(result.current).not.toBe(firstResult);
      expect(result.current.validTasks).toEqual(tasks2);
    });
  });

  // =========================================================================
  // Return values
  // =========================================================================

  describe('return values', () => {
    it('should return validation results and valid tasks', () => {
      const tasks = [
        { id: 1, text: 'Task 1', start: '2024-01-01' },
        { id: 2, text: 'Task 2', start: '2024-01-02' },
      ];

      const { result } = renderHook(() => useTaskValidation(tasks));

      expect(result.current).toEqual({
        invalidTasks: [],
        orphanedTasks: [],
        validTasks: tasks,
      });
    });
  });
});
