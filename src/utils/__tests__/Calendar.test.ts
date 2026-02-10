import { describe, it, expect, beforeEach } from 'vitest';
import { Calendar } from '../Calendar';

describe('Calendar', () => {
  let calendar: Calendar;

  beforeEach(() => {
    calendar = new Calendar();
  });

  describe('constructor', () => {
    it('should create calendar with default week hours (Mon-Fri = 8h, Sat-Sun = 0h)', () => {
      expect(calendar.getHours(0)).toBe(0);
      expect(calendar.getHours(1)).toBe(8);
      expect(calendar.getHours(2)).toBe(8);
      expect(calendar.getHours(3)).toBe(8);
      expect(calendar.getHours(4)).toBe(8);
      expect(calendar.getHours(5)).toBe(8);
      expect(calendar.getHours(6)).toBe(0);
    });

    it('should accept custom week hours', () => {
      const customCalendar = new Calendar({
        weekHours: {
          monday: 4,
          tuesday: 4,
          wednesday: 4,
          thursday: 4,
          friday: 4,
          saturday: 0,
          sunday: 0,
        },
      });
      expect(customCalendar.getHours(1)).toBe(4);
    });

    it('should accept holidays array', () => {
      const calendarWithHolidays = new Calendar({
        holidays: ['2024-01-01', '2024-12-25'],
      });
      expect(calendarWithHolidays.isHoliday(new Date('2024-01-01'))).toBe(true);
      expect(calendarWithHolidays.isHoliday(new Date('2024-12-25'))).toBe(true);
    });

    it('should accept holidays Set', () => {
      const calendarWithHolidays = new Calendar({
        holidays: new Set(['2024-01-01']),
      });
      expect(calendarWithHolidays.isHoliday(new Date('2024-01-01'))).toBe(true);
    });
  });

  describe('isWorkingDay', () => {
    it('should return true for Monday-Friday', () => {
      expect(calendar.isWorkingDay(1)).toBe(true);
      expect(calendar.isWorkingDay(2)).toBe(true);
      expect(calendar.isWorkingDay(3)).toBe(true);
      expect(calendar.isWorkingDay(4)).toBe(true);
      expect(calendar.isWorkingDay(5)).toBe(true);
    });

    it('should return false for Saturday and Sunday', () => {
      expect(calendar.isWorkingDay(0)).toBe(false);
      expect(calendar.isWorkingDay(6)).toBe(false);
    });
  });

  describe('isWeekend', () => {
    it('should identify Saturday and Sunday as weekends', () => {
      const saturday = new Date('2024-01-06');
      const sunday = new Date('2024-01-07');
      expect(calendar.isWeekend(saturday)).toBe(true);
      expect(calendar.isWeekend(sunday)).toBe(true);
    });

    it('should identify Monday-Friday as non-weekends', () => {
      const monday = new Date('2024-01-01');
      const friday = new Date('2024-01-05');
      expect(calendar.isWeekend(monday)).toBe(false);
      expect(calendar.isWeekend(friday)).toBe(false);
    });
  });

  describe('holidays', () => {
    it('should identify holidays as non-working days', () => {
      const holidayCalendar = new Calendar({
        holidays: ['2024-01-01'],
      });
      const newYear = new Date('2024-01-01');
      expect(holidayCalendar.isHoliday(newYear)).toBe(true);
      expect(holidayCalendar.isNonWorkday(newYear)).toBe(true);
    });
  });

  describe('workday exceptions', () => {
    it('should allow weekend days to be marked as workdays', () => {
      const saturday = new Date('2024-01-06');
      expect(calendar.isNonWorkday(saturday)).toBe(true);

      calendar.addWorkdayException('2024-01-06');
      expect(calendar.isExceptionWorkday(saturday)).toBe(true);
      expect(calendar.isNonWorkday(saturday)).toBe(false);
    });

    it('should remove workday exceptions', () => {
      calendar.addWorkdayException('2024-01-06');
      expect(calendar.isExceptionWorkday(new Date('2024-01-06'))).toBe(true);

      calendar.removeWorkdayException('2024-01-06');
      expect(calendar.isExceptionWorkday(new Date('2024-01-06'))).toBe(false);
    });
  });

  describe('countWorkdays', () => {
    it('should count 1 for a single workday', () => {
      const monday = new Date('2024-01-01');
      expect(calendar.countWorkdays(monday, monday)).toBe(1);
    });

    it('should count 0 for a single non-workday', () => {
      const saturday = new Date('2024-01-06');
      expect(calendar.countWorkdays(saturday, saturday)).toBe(0);
    });

    it('should count 5 workdays for a full week (Mon-Fri)', () => {
      const monday = new Date('2024-01-01');
      const sunday = new Date('2024-01-07');
      expect(calendar.countWorkdays(monday, sunday)).toBe(5);
    });

    it('should count 0 if start > end', () => {
      const monday = new Date('2024-01-01');
      const sunday = new Date('2024-01-07');
      expect(calendar.countWorkdays(sunday, monday)).toBe(0);
    });

    it('should return 0 for null dates', () => {
      expect(calendar.countWorkdays(null as any, new Date())).toBe(0);
      expect(calendar.countWorkdays(new Date(), null as any)).toBe(0);
    });

    it('should skip holidays when counting workdays', () => {
      const holidayCalendar = new Calendar({
        holidays: ['2024-01-01', '2024-01-02'],
      });
      const monday = new Date('2024-01-01');
      const friday = new Date('2024-01-05');
      expect(holidayCalendar.countWorkdays(monday, friday)).toBe(3);
    });
  });

  describe('calculateEndDateByWorkdays', () => {
    it('should return same day for 1 workday', () => {
      const monday = new Date('2024-01-01');
      const result = calendar.calculateEndDateByWorkdays(monday, 1);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });

    it('should return Wednesday for 3 workdays starting Monday', () => {
      const monday = new Date('2024-01-01');
      const result = calendar.calculateEndDateByWorkdays(monday, 3);
      expect(result.getDay()).toBe(3);
      expect(result.getDate()).toBe(3);
    });

    it('should skip weekend when calculating from Friday', () => {
      const friday = new Date('2024-01-05');
      const result = calendar.calculateEndDateByWorkdays(friday, 3);
      expect(result.getDay()).toBe(2);
      expect(result.getDate()).toBe(9);
    });

    it('should skip to Monday when starting from Saturday', () => {
      const saturday = new Date('2024-01-06');
      const result = calendar.calculateEndDateByWorkdays(saturday, 1);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(8);
    });

    it('should skip holidays when calculating end date', () => {
      const holidayCalendar = new Calendar({
        holidays: ['2024-01-02'],
      });
      const monday = new Date('2024-01-01');
      const result = holidayCalendar.calculateEndDateByWorkdays(monday, 3);
      expect(result.getDate()).toBe(4);
    });
  });

  describe('5-day task spanning weekend = 7 calendar days', () => {
    it('should correctly calculate that 5 workdays spanning a weekend = 7 calendar days', () => {
      const thursday = new Date('2024-01-04');
      const result = calendar.calculateEndDateByWorkdays(thursday, 5);
      expect(result.getDay()).toBe(3);
      expect(result.getDate()).toBe(10);

      const calendarDays = calendar.calculateCalendarDays(thursday, 5);
      expect(calendarDays).toBe(7);
    });

    it('should count exactly 5 workdays in that 7-day span', () => {
      const thursday = new Date('2024-01-04');
      const wednesday = calendar.calculateEndDateByWorkdays(thursday, 5);
      expect(calendar.countWorkdays(thursday, wednesday)).toBe(5);
    });

    it('should demonstrate weekend days are not counted as workdays', () => {
      const thursday = new Date('2024-01-04');
      const saturday = new Date('2024-01-06');
      const sunday = new Date('2024-01-07');

      expect(calendar.isNonWorkday(saturday)).toBe(true);
      expect(calendar.isNonWorkday(sunday)).toBe(true);

      const wednesday = new Date('2024-01-10');
      expect(calendar.countWorkdays(thursday, wednesday)).toBe(5);
    });
  });

  describe('getNextWorkday', () => {
    it('should return same day if already a workday', () => {
      const monday = new Date('2024-01-01');
      const result = calendar.getNextWorkday(monday);
      expect(result.getDate()).toBe(1);
    });

    it('should skip to Monday from Saturday', () => {
      const saturday = new Date('2024-01-06');
      const result = calendar.getNextWorkday(saturday);
      expect(result.getDay()).toBe(1);
    });

    it('should skip to Monday from Sunday', () => {
      const sunday = new Date('2024-01-07');
      const result = calendar.getNextWorkday(sunday);
      expect(result.getDay()).toBe(1);
    });

    it('should skip holidays', () => {
      const holidayCalendar = new Calendar({
        holidays: ['2024-01-01'],
      });
      const newYear = new Date('2024-01-01');
      const result = holidayCalendar.getNextWorkday(newYear);
      expect(result.getDate()).toBe(2);
    });
  });

  describe('snapToWorkday', () => {
    it('should snap Saturday to Monday', () => {
      const saturday = new Date('2024-01-06');
      const result = calendar.snapToWorkday(saturday);
      expect(result.getDay()).toBe(1);
    });
  });

  describe('formatWorkdays', () => {
    it('should format workdays with wd suffix', () => {
      expect(Calendar.formatWorkdays(5)).toBe('5wd');
      expect(Calendar.formatWorkdays(1)).toBe('1wd');
      expect(Calendar.formatWorkdays(0)).toBe('0wd');
    });
  });

  describe('addHoliday / removeHoliday', () => {
    it('should add and remove holidays dynamically', () => {
      const date = '2024-02-14';
      expect(calendar.isHoliday(new Date(date))).toBe(false);

      calendar.addHoliday(date);
      expect(calendar.isHoliday(new Date(date))).toBe(true);

      calendar.removeHoliday(date);
      expect(calendar.isHoliday(new Date(date))).toBe(false);
    });
  });

  describe('getWeekHours', () => {
    it('should return a copy of week hours', () => {
      const hours = calendar.getWeekHours();
      expect(hours.monday).toBe(8);
      expect(hours.saturday).toBe(0);
    });
  });

  describe('static factory methods', () => {
    it('should create default calendar', () => {
      const cal = Calendar.createDefault();
      expect(cal.getWeekHours().monday).toBe(8);
    });

    it('should create calendar with custom week hours', () => {
      const cal = Calendar.withWeekHours({ monday: 4, friday: 4 });
      expect(cal.getHours(1)).toBe(4);
      expect(cal.getHours(5)).toBe(4);
      expect(cal.getHours(2)).toBe(8);
    });

    it('should create calendar with holidays', () => {
      const cal = Calendar.withHolidays(['2024-01-01']);
      expect(cal.isHoliday(new Date('2024-01-01'))).toBe(true);
    });
  });
});
