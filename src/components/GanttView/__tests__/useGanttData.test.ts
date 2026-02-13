/**
 * useGanttData Hook Tests
 * Tests for memoized data computations: label maps, assignee options,
 * workdays enrichment, scales, and markers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGanttData } from '../useGanttData';

function makeTask(overrides = {}) {
  return {
    id: 1,
    text: 'Task 1',
    start: new Date('2025-01-06'),
    end: new Date('2025-01-10'),
    labels: '',
    parent: 0,
    ...overrides,
  };
}

function renderGanttData(overrides = {}) {
  const defaults = {
    allTasks: [],
    filterOptions: {},
    serverFilterOptions: null,
    countWorkdays: vi.fn((start, end) => {
      // Simple weekday count mock
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      return Math.max(1, days);
    }),
    lengthUnit: 'day',
    groupBy: 'none',
    collapsedGroups: new Set(),
    api: null,
  };
  return renderHook(() => useGanttData({ ...defaults, ...overrides }));
}

describe('useGanttData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Label maps
  // =========================================================================

  describe('labelPriorityMap', () => {
    it('should build priority map from server filter options', () => {
      const { result } = renderGanttData({
        serverFilterOptions: {
          labels: [
            { title: 'P0-Critical', priority: 0 },
            { title: 'P1-High', priority: 1 },
            { title: 'P2-Medium', priority: 2 },
          ],
        },
      });

      expect(result.current.labelPriorityMap.get('P0-Critical')).toBe(0);
      expect(result.current.labelPriorityMap.get('P1-High')).toBe(1);
      expect(result.current.labelPriorityMap.get('P2-Medium')).toBe(2);
    });

    it('should skip labels without priority', () => {
      const { result } = renderGanttData({
        serverFilterOptions: {
          labels: [
            { title: 'bug', color: '#ff0000' },
            { title: 'P0', priority: 0 },
          ],
        },
      });

      expect(result.current.labelPriorityMap.has('bug')).toBe(false);
      expect(result.current.labelPriorityMap.has('P0')).toBe(true);
    });

    it('should return empty map when no server filter options', () => {
      const { result } = renderGanttData({ serverFilterOptions: null });

      expect(result.current.labelPriorityMap.size).toBe(0);
    });
  });

  describe('labelColorMap', () => {
    it('should build color map from server filter options', () => {
      const { result } = renderGanttData({
        serverFilterOptions: {
          labels: [
            { title: 'bug', color: '#ff0000' },
            { title: 'feature', color: '#00ff00' },
          ],
        },
      });

      expect(result.current.labelColorMap.get('bug')).toBe('#ff0000');
      expect(result.current.labelColorMap.get('feature')).toBe('#00ff00');
    });

    it('should skip labels without color', () => {
      const { result } = renderGanttData({
        serverFilterOptions: {
          labels: [
            { title: 'no-color', priority: 1 },
            { title: 'has-color', color: '#123456' },
          ],
        },
      });

      expect(result.current.labelColorMap.has('no-color')).toBe(false);
      expect(result.current.labelColorMap.has('has-color')).toBe(true);
    });
  });

  // =========================================================================
  // Assignee options
  // =========================================================================

  describe('assigneeOptions', () => {
    it('should build sorted assignee options from server members', () => {
      const { result } = renderGanttData({
        serverFilterOptions: {
          members: [
            { name: 'Charlie', username: 'charlie' },
            { name: 'Alice', username: 'alice' },
            { name: 'Bob', username: 'bob' },
          ],
        },
      });

      const options = result.current.assigneeOptions;
      expect(options).toHaveLength(3);
      // Should be sorted alphabetically
      expect(options[0].label).toBe('Alice');
      expect(options[1].label).toBe('Bob');
      expect(options[2].label).toBe('Charlie');
      // Should have correct structure
      expect(options[0]).toEqual({
        value: 'Alice',
        label: 'Alice',
        subtitle: '@alice',
        username: 'alice',
      });
    });

    it('should return empty array when no members', () => {
      const { result } = renderGanttData({ serverFilterOptions: null });
      expect(result.current.assigneeOptions).toEqual([]);
    });
  });

  // =========================================================================
  // Tasks with workdays
  // =========================================================================

  describe('tasksWithWorkdays', () => {
    it('should add workdays count to each task', () => {
      const countWorkdays = vi.fn().mockReturnValue(5);

      const { result } = renderGanttData({
        allTasks: [makeTask({ id: 1 })],
        countWorkdays,
      });

      expect(result.current.tasksWithWorkdays[0].workdays).toBe(5);
      expect(countWorkdays).toHaveBeenCalled();
    });

    it('should set workdays to 0 when start or end is missing', () => {
      const { result } = renderGanttData({
        allTasks: [makeTask({ id: 1, start: null, end: null })],
      });

      expect(result.current.tasksWithWorkdays[0].workdays).toBe(0);
    });

    it('should add labelPriority from label priority map', () => {
      const { result } = renderGanttData({
        allTasks: [makeTask({ id: 1, labels: 'P0-Critical, feature' })],
        serverFilterOptions: {
          labels: [
            { title: 'P0-Critical', priority: 0 },
            { title: 'feature', priority: 5 },
          ],
        },
      });

      // Should pick the lowest priority (highest importance)
      expect(result.current.tasksWithWorkdays[0].labelPriority).toBe(0);
    });

    it('should use MAX_SAFE_INTEGER for tasks without priority labels', () => {
      const { result } = renderGanttData({
        allTasks: [makeTask({ id: 1, labels: 'some-label' })],
        serverFilterOptions: { labels: [] },
      });

      expect(result.current.tasksWithWorkdays[0].labelPriority).toBe(
        Number.MAX_SAFE_INTEGER,
      );
    });
  });

  // =========================================================================
  // Scales
  // =========================================================================

  describe('scales', () => {
    it('should return hour scales', () => {
      const { result } = renderGanttData({ lengthUnit: 'hour' });
      expect(result.current.scales).toHaveLength(2);
      expect(result.current.scales[1].unit).toBe('hour');
    });

    it('should return day scales with year/month/day', () => {
      const { result } = renderGanttData({ lengthUnit: 'day' });
      expect(result.current.scales).toHaveLength(3);
      expect(result.current.scales[0].unit).toBe('year');
      expect(result.current.scales[1].unit).toBe('month');
      expect(result.current.scales[2].unit).toBe('day');
    });

    it('should return week scales', () => {
      const { result } = renderGanttData({ lengthUnit: 'week' });
      expect(result.current.scales).toHaveLength(2);
      expect(result.current.scales[1].unit).toBe('week');
    });

    it('should return month scales', () => {
      const { result } = renderGanttData({ lengthUnit: 'month' });
      expect(result.current.scales).toHaveLength(2);
      expect(result.current.scales[1].unit).toBe('month');
    });

    it('should return quarter scales', () => {
      const { result } = renderGanttData({ lengthUnit: 'quarter' });
      expect(result.current.scales).toHaveLength(2);
      expect(result.current.scales[1].unit).toBe('quarter');
    });

    it('should return day scales for unknown unit (default)', () => {
      const { result } = renderGanttData({ lengthUnit: 'unknown' });
      expect(result.current.scales).toHaveLength(3);
      expect(result.current.scales[2].unit).toBe('day');
    });
  });

  // =========================================================================
  // Markers
  // =========================================================================

  describe('markers', () => {
    it('should return today marker', () => {
      const { result } = renderGanttData();

      expect(result.current.markers).toHaveLength(1);
      expect(result.current.markers[0].css).toBe('today-marker');
      expect(result.current.markers[0].start).toBeInstanceOf(Date);
    });

    it('should have today marker at midnight (no time component)', () => {
      const { result } = renderGanttData();
      const marker = result.current.markers[0].start;

      expect(marker.getHours()).toBe(0);
      expect(marker.getMinutes()).toBe(0);
      expect(marker.getSeconds()).toBe(0);
    });
  });

  // =========================================================================
  // Stats
  // =========================================================================

  describe('stats', () => {
    it('should calculate stats from filtered tasks', () => {
      const { result } = renderGanttData({
        allTasks: [
          makeTask({ id: 1, progress: 100 }),
          makeTask({ id: 2, progress: 50 }),
          makeTask({ id: 3, progress: 0 }),
        ],
      });

      expect(result.current.stats.total).toBe(3);
    });
  });
});
