import { describe, it, expect } from 'vitest';
import {
  deriveBoundariesFromTasks,
  resolveProjectBoundaries,
  isWithinProjectBoundaries,
  enforceProjectStartBoundary,
  enforceProjectEndBoundary,
  calculateSlackTime,
  formatBoundaryDate,
} from '../ProjectBoundaryUtils';

describe('ProjectBoundaryUtils', () => {
  describe('deriveBoundariesFromTasks', () => {
    it('should return null boundaries for empty tasks array', () => {
      const result = deriveBoundariesFromTasks([]);
      expect(result.projectStart).toBeNull();
      expect(result.projectEnd).toBeNull();
    });

    it('should derive boundaries from single task', () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');
      const tasks = [{ start: startDate, end: endDate }];

      const result = deriveBoundariesFromTasks(tasks);

      expect(result.projectStart).toEqual(startDate);
      expect(result.projectEnd).toEqual(endDate);
    });

    it('should derive earliest start and latest end from multiple tasks', () => {
      const tasks = [
        { start: new Date('2024-01-15'), end: new Date('2024-01-25') },
        { start: new Date('2024-01-10'), end: new Date('2024-01-30') },
        { start: new Date('2024-01-20'), end: new Date('2024-01-22') },
      ];

      const result = deriveBoundariesFromTasks(tasks);

      expect(result.projectStart).toEqual(new Date('2024-01-10'));
      expect(result.projectEnd).toEqual(new Date('2024-01-30'));
    });

    it('should handle tasks with only start date', () => {
      const tasks = [{ start: new Date('2024-01-10') }];

      const result = deriveBoundariesFromTasks(tasks);

      expect(result.projectStart).toEqual(new Date('2024-01-10'));
      expect(result.projectEnd).toBeNull();
    });

    it('should handle tasks with only end date', () => {
      const tasks = [{ end: new Date('2024-01-20') }];

      const result = deriveBoundariesFromTasks(tasks);

      expect(result.projectStart).toBeNull();
      expect(result.projectEnd).toEqual(new Date('2024-01-20'));
    });

    it('should handle tasks with null dates', () => {
      const tasks = [
        { start: null, end: null },
        { start: new Date('2024-01-10'), end: new Date('2024-01-20') },
      ];

      const result = deriveBoundariesFromTasks(tasks);

      expect(result.projectStart).toEqual(new Date('2024-01-10'));
      expect(result.projectEnd).toEqual(new Date('2024-01-20'));
    });
  });

  describe('resolveProjectBoundaries', () => {
    it('should use explicit boundaries when provided', () => {
      const explicitStart = new Date('2024-01-01');
      const explicitEnd = new Date('2024-12-31');
      const tasks = [
        { start: new Date('2024-02-01'), end: new Date('2024-11-30') },
      ];

      const result = resolveProjectBoundaries(
        explicitStart,
        explicitEnd,
        tasks,
      );

      expect(result.projectStart).toEqual(explicitStart);
      expect(result.projectEnd).toEqual(explicitEnd);
    });

    it('should derive boundaries when explicit ones are null', () => {
      const tasks = [
        { start: new Date('2024-02-01'), end: new Date('2024-11-30') },
      ];

      const result = resolveProjectBoundaries(null, null, tasks);

      expect(result.projectStart).toEqual(new Date('2024-02-01'));
      expect(result.projectEnd).toEqual(new Date('2024-11-30'));
    });

    it('should use explicit start but derive end', () => {
      const explicitStart = new Date('2024-01-01');
      const tasks = [
        { start: new Date('2024-02-01'), end: new Date('2024-11-30') },
      ];

      const result = resolveProjectBoundaries(explicitStart, null, tasks);

      expect(result.projectStart).toEqual(explicitStart);
      expect(result.projectEnd).toEqual(new Date('2024-11-30'));
    });

    it('should derive start but use explicit end', () => {
      const explicitEnd = new Date('2024-12-31');
      const tasks = [
        { start: new Date('2024-02-01'), end: new Date('2024-11-30') },
      ];

      const result = resolveProjectBoundaries(null, explicitEnd, tasks);

      expect(result.projectStart).toEqual(new Date('2024-02-01'));
      expect(result.projectEnd).toEqual(explicitEnd);
    });
  });

  describe('isWithinProjectBoundaries', () => {
    const boundaries = {
      projectStart: new Date('2024-01-10'),
      projectEnd: new Date('2024-01-20'),
    };

    it('should return true for date within boundaries', () => {
      const date = new Date('2024-01-15');
      expect(isWithinProjectBoundaries(date, boundaries)).toBe(true);
    });

    it('should return true for date equal to start boundary', () => {
      const date = new Date('2024-01-10');
      expect(isWithinProjectBoundaries(date, boundaries)).toBe(true);
    });

    it('should return true for date equal to end boundary', () => {
      const date = new Date('2024-01-20');
      expect(isWithinProjectBoundaries(date, boundaries)).toBe(true);
    });

    it('should return false for date before start boundary', () => {
      const date = new Date('2024-01-05');
      expect(isWithinProjectBoundaries(date, boundaries)).toBe(false);
    });

    it('should return false for date after end boundary', () => {
      const date = new Date('2024-01-25');
      expect(isWithinProjectBoundaries(date, boundaries)).toBe(false);
    });

    it('should handle null start boundary', () => {
      const noStartBoundaries = {
        projectStart: null,
        projectEnd: new Date('2024-01-20'),
      };
      const date = new Date('2024-01-01');
      expect(isWithinProjectBoundaries(date, noStartBoundaries)).toBe(true);
    });

    it('should handle null end boundary', () => {
      const noEndBoundaries = {
        projectStart: new Date('2024-01-10'),
        projectEnd: null,
      };
      const date = new Date('2024-01-30');
      expect(isWithinProjectBoundaries(date, noEndBoundaries)).toBe(true);
    });

    it('should respect includeEnd parameter', () => {
      const date = new Date('2024-01-20');
      expect(isWithinProjectBoundaries(date, boundaries, true)).toBe(true);
      expect(isWithinProjectBoundaries(date, boundaries, false)).toBe(false);
    });
  });

  describe('enforceProjectStartBoundary', () => {
    const projectStart = new Date('2024-01-10');

    it('should return task start if after project start', () => {
      const taskStart = new Date('2024-01-15');
      const result = enforceProjectStartBoundary(taskStart, projectStart);
      expect(result).toEqual(taskStart);
    });

    it('should return project start if task start is before', () => {
      const taskStart = new Date('2024-01-05');
      const result = enforceProjectStartBoundary(taskStart, projectStart);
      expect(result).toEqual(projectStart);
    });

    it('should return task start if equal to project start', () => {
      const taskStart = new Date('2024-01-10');
      const result = enforceProjectStartBoundary(taskStart, projectStart);
      expect(result).toEqual(projectStart);
    });

    it('should return task start if no project start boundary', () => {
      const taskStart = new Date('2024-01-05');
      const result = enforceProjectStartBoundary(taskStart, null);
      expect(result).toEqual(taskStart);
    });
  });

  describe('enforceProjectEndBoundary', () => {
    const projectEnd = new Date('2024-01-20');

    it('should return task end if before project end', () => {
      const taskEnd = new Date('2024-01-15');
      const result = enforceProjectEndBoundary(taskEnd, projectEnd);
      expect(result).toEqual(taskEnd);
    });

    it('should return project end if task end is after', () => {
      const taskEnd = new Date('2024-01-25');
      const result = enforceProjectEndBoundary(taskEnd, projectEnd);
      expect(result).toEqual(projectEnd);
    });

    it('should return task end if equal to project end', () => {
      const taskEnd = new Date('2024-01-20');
      const result = enforceProjectEndBoundary(taskEnd, projectEnd);
      expect(result).toEqual(projectEnd);
    });

    it('should return task end if no project end boundary', () => {
      const taskEnd = new Date('2024-01-25');
      const result = enforceProjectEndBoundary(taskEnd, null);
      expect(result).toEqual(taskEnd);
    });
  });

  describe('calculateSlackTime', () => {
    const projectEnd = new Date('2024-01-20T00:00:00Z');

    it('should calculate positive slack for task ending before project end', () => {
      const taskEnd = new Date('2024-01-15T00:00:00Z');
      const slack = calculateSlackTime(taskEnd, projectEnd);
      const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
      expect(slack).toBe(fiveDaysInMs);
    });

    it('should return 0 slack for task ending at project end', () => {
      const taskEnd = new Date('2024-01-20T00:00:00Z');
      const slack = calculateSlackTime(taskEnd, projectEnd);
      expect(slack).toBe(0);
    });

    it('should return 0 slack for task ending after project end', () => {
      const taskEnd = new Date('2024-01-25T00:00:00Z');
      const slack = calculateSlackTime(taskEnd, projectEnd);
      expect(slack).toBe(0);
    });

    it('should return 0 slack if no project end boundary', () => {
      const taskEnd = new Date('2024-01-15T00:00:00Z');
      const slack = calculateSlackTime(taskEnd, null);
      expect(slack).toBe(0);
    });
  });

  describe('formatBoundaryDate', () => {
    it('should format a valid date', () => {
      const date = new Date('2024-01-15');
      const formatted = formatBoundaryDate(date);
      expect(formatted).toBe('Jan 15, 2024');
    });

    it('should return "Not set" for null', () => {
      expect(formatBoundaryDate(null)).toBe('Not set');
    });

    it('should return "Not set" for undefined', () => {
      expect(formatBoundaryDate(undefined)).toBe('Not set');
    });
  });
});
