import { describe, it, expect } from 'vitest';
import {
  createCalendar,
  isWorkday,
  countWorkdays,
  addWorkdays,
  getNextWorkday,
  getPreviousWorkday,
  addHoliday,
  removeHoliday,
  DEFAULT_CALENDAR,
} from '../Calendar';

describe('Calendar', () => {
  describe('createCalendar', () => {
    it('should create calendar with default values', () => {
      const calendar = createCalendar();
      expect(calendar.workdays).toEqual(DEFAULT_CALENDAR.workdays);
      expect(calendar.holidays).toEqual([]);
    });

    it('should merge custom config with defaults', () => {
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });
      expect(calendar.holidays).toHaveLength(1);
      expect(calendar.workdays).toEqual(DEFAULT_CALENDAR.workdays);
    });
  });

  describe('isWorkday', () => {
    it('should return true for weekdays by default', () => {
      const monday = new Date('2024-01-08');
      const friday = new Date('2024-01-12');
      const calendar = createCalendar();

      expect(isWorkday(monday, calendar)).toBe(true);
      expect(isWorkday(friday, calendar)).toBe(true);
    });

    it('should return false for weekends by default', () => {
      const saturday = new Date('2024-01-06');
      const sunday = new Date('2024-01-07');
      const calendar = createCalendar();

      expect(isWorkday(saturday, calendar)).toBe(false);
      expect(isWorkday(sunday, calendar)).toBe(false);
    });

    it('should return false for holidays', () => {
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });

      expect(isWorkday(holiday, calendar)).toBe(false);
    });

    it('should support custom workdays', () => {
      const saturday = new Date('2024-01-06');
      const calendar = createCalendar({ workdays: [0, 1, 2, 3, 4, 5, 6] });

      expect(isWorkday(saturday, calendar)).toBe(true);
    });
  });

  describe('countWorkdays', () => {
    it('should count workdays in a range', () => {
      const start = new Date('2024-01-08');
      const end = new Date('2024-01-12');
      const calendar = createCalendar();

      expect(countWorkdays(start, end, calendar)).toBe(5);
    });

    it('should exclude weekends', () => {
      const start = new Date('2024-01-08');
      const end = new Date('2024-01-14');
      const calendar = createCalendar();

      expect(countWorkdays(start, end, calendar)).toBe(5);
    });

    it('should exclude holidays', () => {
      const start = new Date('2024-12-23');
      const end = new Date('2024-12-27');
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });

      const result = countWorkdays(start, end, calendar);
      expect(result).toBeLessThanOrEqual(4);
      expect(isWorkday(holiday, calendar)).toBe(false);
    });
  });

  describe('addWorkdays', () => {
    it('should add workdays correctly', () => {
      const monday = new Date('2024-01-08');
      const calendar = createCalendar();

      const result = addWorkdays(monday, 5, calendar);
      expect(isWorkday(result, calendar)).toBe(true);
    });

    it('should skip weekends when adding days', () => {
      const friday = new Date('2024-01-12');
      const calendar = createCalendar();

      const result = addWorkdays(friday, 1, calendar);
      expect(result.getDay()).toBe(1);
    });

    it('should handle negative workdays', () => {
      const tuesday = new Date('2024-01-09');
      const calendar = createCalendar();

      const result = addWorkdays(tuesday, -1, calendar);
      expect(isWorkday(result, calendar)).toBe(true);
    });
  });

  describe('getNextWorkday', () => {
    it('should return Monday after Friday', () => {
      const friday = new Date('2024-01-12');
      const calendar = createCalendar();

      const result = getNextWorkday(friday, calendar);
      expect(result.getDay()).toBe(1);
    });

    it('should skip holidays', () => {
      const dayBefore = new Date('2024-12-24');
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });

      const result = getNextWorkday(dayBefore, calendar);
      expect(result.getDate()).toBe(26);
    });
  });

  describe('getPreviousWorkday', () => {
    it('should return Friday before Monday', () => {
      const monday = new Date('2024-01-08');
      const calendar = createCalendar();

      const result = getPreviousWorkday(monday, calendar);
      expect(result.getDay()).toBe(5);
    });
  });

  describe('addHoliday', () => {
    it('should add holiday to calendar', () => {
      const calendar = createCalendar();
      const holiday = new Date('2024-12-25');

      const updated = addHoliday(calendar, holiday);
      expect(updated.holidays).toHaveLength(1);
    });

    it('should not add duplicate holidays', () => {
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });

      const updated = addHoliday(calendar, holiday);
      expect(updated.holidays).toHaveLength(1);
    });
  });

  describe('removeHoliday', () => {
    it('should remove holiday from calendar', () => {
      const holiday = new Date('2024-12-25');
      const calendar = createCalendar({ holidays: [holiday] });

      const updated = removeHoliday(calendar, holiday);
      expect(updated.holidays).toHaveLength(0);
    });
  });
});
