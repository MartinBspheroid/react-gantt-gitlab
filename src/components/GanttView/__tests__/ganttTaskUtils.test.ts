/**
 * ganttTaskUtils Tests
 * Pure utility functions for extracting tasks from SVAR Gantt state,
 * finding child tasks recursively, and sorting by deletion order.
 */

import { describe, it, expect } from 'vitest';
import {
  getTasksFromState,
  getChildrenForTask,
  sortByDeletionOrder,
} from '../ganttTaskUtils';

// ============================================================================
// getTasksFromState
// ============================================================================

describe('getTasksFromState', () => {
  it('should extract tasks from _pool Map (SVAR Gantt internal)', () => {
    const pool = new Map([
      [1, { id: 1, text: 'Task A' }],
      [2, { id: 2, text: 'Task B' }],
    ]);
    const state = { tasks: { _pool: pool } };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, text: 'Task A' });
    expect(result[1]).toEqual({ id: 2, text: 'Task B' });
  });

  it('should extract tasks from a plain Map', () => {
    const tasksMap = new Map([
      [1, { id: 1, text: 'Task A' }],
      [2, { id: 2, text: 'Task B' }],
    ]);
    const state = { tasks: tasksMap };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
  });

  it('should handle tasks as a plain array', () => {
    const state = {
      tasks: [
        { id: 1, text: 'Task A' },
        { id: 2, text: 'Task B' },
      ],
    };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Task A');
  });

  it('should handle tasks as a plain object (fallback)', () => {
    const state = {
      tasks: {
        1: { id: 1, text: 'Task A' },
        2: { id: 2, text: 'Task B' },
      },
    };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
  });

  it('should filter out null/undefined entries', () => {
    const state = {
      tasks: [{ id: 1, text: 'Task A' }, null, undefined, { id: 2, text: 'Task B' }],
    };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
  });

  it('should filter out null values from _pool Map', () => {
    const pool = new Map([
      [1, { id: 1, text: 'Task A' }],
      [2, null],
      [3, { id: 3, text: 'Task C' }],
    ]);
    const state = { tasks: { _pool: pool } };

    const result = getTasksFromState(state);

    expect(result).toHaveLength(2);
  });

  it('should return empty array when state is null', () => {
    expect(getTasksFromState(null)).toEqual([]);
  });

  it('should return empty array when state is undefined', () => {
    expect(getTasksFromState(undefined)).toEqual([]);
  });

  it('should return empty array when state.tasks is missing', () => {
    expect(getTasksFromState({})).toEqual([]);
  });

  it('should return empty array when _pool is empty', () => {
    const state = { tasks: { _pool: new Map() } };
    expect(getTasksFromState(state)).toEqual([]);
  });
});

// ============================================================================
// getChildrenForTask
// ============================================================================

describe('getChildrenForTask', () => {
  const hierarchy = [
    { id: 1, parent: 0, text: 'Milestone 1' },
    { id: 2, parent: 1, text: 'Issue A' },
    { id: 3, parent: 1, text: 'Issue B' },
    { id: 4, parent: 2, text: 'Task A1' },
    { id: 5, parent: 2, text: 'Task A2' },
    { id: 6, parent: 3, text: 'Task B1' },
    { id: 7, parent: 0, text: 'Milestone 2' },
    { id: 8, parent: 7, text: 'Issue C' },
  ];

  it('should find direct children of a task', () => {
    const children = getChildrenForTask(1, hierarchy);

    const childIds = children.map((c) => c.id);
    expect(childIds).toContain(2);
    expect(childIds).toContain(3);
  });

  it('should find all descendants recursively', () => {
    const children = getChildrenForTask(1, hierarchy);

    // Milestone 1 has: Issue A (2), Issue B (3), Task A1 (4), Task A2 (5), Task B1 (6)
    expect(children).toHaveLength(5);
    const childIds = children.map((c) => c.id);
    expect(childIds).toContain(4);
    expect(childIds).toContain(5);
    expect(childIds).toContain(6);
  });

  it('should return empty array for leaf tasks', () => {
    const children = getChildrenForTask(4, hierarchy);
    expect(children).toHaveLength(0);
  });

  it('should return empty array for nonexistent task ID', () => {
    const children = getChildrenForTask(999, hierarchy);
    expect(children).toHaveLength(0);
  });

  it('should handle single-level children (no grandchildren)', () => {
    const children = getChildrenForTask(7, hierarchy);

    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(8);
  });

  it('should not include siblings', () => {
    const children = getChildrenForTask(2, hierarchy);

    const childIds = children.map((c) => c.id);
    // Should have Task A1 and Task A2, but NOT Issue B or Task B1
    expect(childIds).toEqual([4, 5]);
    expect(childIds).not.toContain(3);
    expect(childIds).not.toContain(6);
  });

  it('should handle string task IDs', () => {
    const tasks = [
      { id: 'm-1', parent: 0, text: 'Milestone' },
      { id: 10, parent: 'm-1', text: 'Issue' },
    ];

    const children = getChildrenForTask('m-1', tasks);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(10);
  });
});

// ============================================================================
// sortByDeletionOrder
// ============================================================================

describe('sortByDeletionOrder', () => {
  const hierarchy = [
    { id: 1, parent: 0, text: 'Milestone' },
    { id: 2, parent: 1, text: 'Issue' },
    { id: 3, parent: 2, text: 'Task' },
    { id: 4, parent: 0, text: 'Root Issue' },
  ];

  it('should sort children before parents (deepest first)', () => {
    const sorted = sortByDeletionOrder([1, 2, 3], hierarchy);

    // Task (depth 2) should be first, then Issue (depth 1), then Milestone (depth 0)
    expect(sorted).toEqual([3, 2, 1]);
  });

  it('should handle root-level items (depth 0)', () => {
    const sorted = sortByDeletionOrder([1, 4], hierarchy);

    // Both are depth 0, order doesn't matter but both should be present
    expect(sorted).toHaveLength(2);
    expect(sorted).toContain(1);
    expect(sorted).toContain(4);
  });

  it('should handle a single item', () => {
    const sorted = sortByDeletionOrder([3], hierarchy);
    expect(sorted).toEqual([3]);
  });

  it('should handle empty array', () => {
    const sorted = sortByDeletionOrder([], hierarchy);
    expect(sorted).toEqual([]);
  });

  it('should skip unknown task IDs gracefully', () => {
    const sorted = sortByDeletionOrder([999, 2], hierarchy);

    // 999 is unknown (depth 0), 2 is depth 1
    // 2 should come first (deeper)
    expect(sorted[0]).toBe(2);
  });

  it('should handle tasks with broken parent chain', () => {
    const tasksWithBrokenChain = [
      { id: 1, parent: 0, text: 'Root' },
      { id: 2, parent: 99, text: 'Orphan' }, // parent 99 doesn't exist
    ];

    // Should not throw - broken chain stops depth calculation
    const sorted = sortByDeletionOrder([1, 2], tasksWithBrokenChain);
    expect(sorted).toHaveLength(2);
  });

  it('should not mutate the input array', () => {
    const input = [1, 2, 3];
    const original = [...input];
    sortByDeletionOrder(input, hierarchy);
    expect(input).toEqual(original);
  });

  it('should handle mixed depth correctly', () => {
    const tasks = [
      { id: 'a', parent: 0 },
      { id: 'b', parent: 'a' },
      { id: 'c', parent: 'b' },
      { id: 'd', parent: 'b' },
    ];

    const sorted = sortByDeletionOrder(['a', 'b', 'c', 'd'], tasks);

    // c and d (depth 2) should come before b (depth 1), which comes before a (depth 0)
    expect(sorted.indexOf('a')).toBeGreaterThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeGreaterThan(sorted.indexOf('c'));
    expect(sorted.indexOf('b')).toBeGreaterThan(sorted.indexOf('d'));
  });
});
