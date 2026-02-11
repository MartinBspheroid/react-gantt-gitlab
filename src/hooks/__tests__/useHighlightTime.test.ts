import { renderHook } from '@testing-library/react';
import { useHighlightTime } from '../useHighlightTime';

// Helper: create a Date for a given YYYY-MM-DD
function d(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper: get day of week name
function dayName(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

describe('useHighlightTime', () => {
  describe('normalizeDateString', () => {
    it('should return the hook with all expected functions', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );

      expect(result.current.isWeekend).toBeTypeOf('function');
      expect(result.current.isHoliday).toBeTypeOf('function');
      expect(result.current.isNonWorkday).toBeTypeOf('function');
      expect(result.current.highlightTime).toBeTypeOf('function');
      expect(result.current.formatLocalDate).toBeTypeOf('function');
      expect(result.current.normalizeDateString).toBeTypeOf('function');
      expect(result.current.countWorkdays).toBeTypeOf('function');
      expect(result.current.calculateEndDateByWorkdays).toBeTypeOf('function');
    });

    it('should normalize YYYY/M/D to YYYY-MM-DD', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.normalizeDateString('2025/1/5')).toBe('2025-01-05');
    });

    it('should pass through YYYY-MM-DD unchanged', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.normalizeDateString('2025-01-05')).toBe(
        '2025-01-05',
      );
    });

    it('should trim whitespace', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.normalizeDateString('  2025-01-05  ')).toBe(
        '2025-01-05',
      );
    });
  });

  describe('formatLocalDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.formatLocalDate(d('2025-03-15'))).toBe(
        '2025-03-15',
      );
    });

    it('should zero-pad single-digit months and days', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.formatLocalDate(d('2025-01-05'))).toBe(
        '2025-01-05',
      );
    });
  });

  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // 2025-01-04 is a Saturday
      const sat = d('2025-01-04');
      expect(dayName(sat)).toBe('Sat');
      expect(result.current.isWeekend(sat)).toBe(true);
    });

    it('should return true for Sunday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // 2025-01-05 is a Sunday
      const sun = d('2025-01-05');
      expect(dayName(sun)).toBe('Sun');
      expect(result.current.isWeekend(sun)).toBe(true);
    });

    it('should return false for weekdays', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // 2025-01-06 is a Monday
      const mon = d('2025-01-06');
      expect(dayName(mon)).toBe('Mon');
      expect(result.current.isWeekend(mon)).toBe(false);
    });

    it('should return false for Saturday when marked as workday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: ['2025-01-04'] }),
      );
      const sat = d('2025-01-04');
      expect(dayName(sat)).toBe('Sat');
      expect(result.current.isWeekend(sat)).toBe(false);
    });

    it('should handle workdays as Holiday objects', () => {
      const { result } = renderHook(() =>
        useHighlightTime({
          holidays: [],
          workdays: [{ date: '2025-01-04', name: 'Makeup day' }],
        }),
      );
      const sat = d('2025-01-04');
      expect(result.current.isWeekend(sat)).toBe(false);
    });
  });

  describe('isHoliday', () => {
    it('should return true for dates in the holiday list', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-01'], workdays: [] }),
      );
      expect(result.current.isHoliday(d('2025-01-01'))).toBe(true);
    });

    it('should return false for dates not in the holiday list', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-01'], workdays: [] }),
      );
      expect(result.current.isHoliday(d('2025-01-02'))).toBe(false);
    });

    it('should handle Holiday objects', () => {
      const { result } = renderHook(() =>
        useHighlightTime({
          holidays: [{ date: '2025-12-25', name: 'Christmas' }],
          workdays: [],
        }),
      );
      expect(result.current.isHoliday(d('2025-12-25'))).toBe(true);
    });

    it('should normalize holiday date formats (YYYY/M/D)', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025/1/1'], workdays: [] }),
      );
      expect(result.current.isHoliday(d('2025-01-01'))).toBe(true);
    });
  });

  describe('isNonWorkday', () => {
    it('should return true for weekends', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.isNonWorkday(d('2025-01-04'))).toBe(true); // Saturday
    });

    it('should return true for holidays on weekdays', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-01'], workdays: [] }),
      );
      // 2025-01-01 is a Wednesday
      expect(dayName(d('2025-01-01'))).toBe('Wed');
      expect(result.current.isNonWorkday(d('2025-01-01'))).toBe(true);
    });

    it('should return false for regular workdays', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.isNonWorkday(d('2025-01-06'))).toBe(false); // Monday
    });

    it('should return false for weekends marked as workdays', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: ['2025-01-04'] }),
      );
      expect(result.current.isNonWorkday(d('2025-01-04'))).toBe(false);
    });
  });

  describe('highlightTime', () => {
    it('should return "wx-weekend" for non-workday with day unit', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.highlightTime(d('2025-01-04'), 'day')).toBe(
        'wx-weekend',
      );
    });

    it('should return empty string for workday with day unit', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.highlightTime(d('2025-01-06'), 'day')).toBe('');
    });

    it('should return empty string for non-day units', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Weekend date but week unit — should NOT highlight
      expect(result.current.highlightTime(d('2025-01-04'), 'week')).toBe('');
      expect(result.current.highlightTime(d('2025-01-04'), 'month')).toBe('');
    });

    it('should highlight holidays as wx-weekend', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-01'], workdays: [] }),
      );
      expect(result.current.highlightTime(d('2025-01-01'), 'day')).toBe(
        'wx-weekend',
      );
    });
  });

  describe('countWorkdays', () => {
    it('should count workdays in a Mon-Fri week', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Mon Jan 6 to Fri Jan 10 (inclusive) = 5 workdays
      expect(
        result.current.countWorkdays(d('2025-01-06'), d('2025-01-10')),
      ).toBe(5);
    });

    it('should count workdays across a full week (Mon-Sun)', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Mon Jan 6 to Sun Jan 12 = 5 workdays (Sat+Sun excluded)
      expect(
        result.current.countWorkdays(d('2025-01-06'), d('2025-01-12')),
      ).toBe(5);
    });

    it('should count 1 for a single workday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(
        result.current.countWorkdays(d('2025-01-06'), d('2025-01-06')),
      ).toBe(1);
    });

    it('should count 0 for a single weekend day', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(
        result.current.countWorkdays(d('2025-01-04'), d('2025-01-04')),
      ).toBe(0);
    });

    it('should return 0 when start is after end', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(
        result.current.countWorkdays(d('2025-01-10'), d('2025-01-06')),
      ).toBe(0);
    });

    it('should exclude holidays from workday count', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-08'], workdays: [] }),
      );
      // Mon-Fri but Wed is holiday = 4 workdays
      expect(
        result.current.countWorkdays(d('2025-01-06'), d('2025-01-10')),
      ).toBe(4);
    });

    it('should include weekend workdays in count', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: ['2025-01-04'] }),
      );
      // Just the Saturday that's marked as workday
      expect(
        result.current.countWorkdays(d('2025-01-04'), d('2025-01-04')),
      ).toBe(1);
    });

    it('should count across two full weeks correctly', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Mon Jan 6 to Fri Jan 17 = 10 workdays
      expect(
        result.current.countWorkdays(d('2025-01-06'), d('2025-01-17')),
      ).toBe(10);
    });

    it('should handle null/undefined dates gracefully', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      expect(result.current.countWorkdays(null as any, d('2025-01-10'))).toBe(
        0,
      );
      expect(result.current.countWorkdays(d('2025-01-06'), null as any)).toBe(
        0,
      );
    });
  });

  describe('calculateEndDateByWorkdays', () => {
    it('should return the same date for 1 workday starting on Monday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-06'),
        1,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-06');
    });

    it('should return Wednesday for 3 workdays starting Monday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-06'),
        3,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-08');
    });

    it('should skip weekends (Fri + 3 workdays = Tue)', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Fri Jan 10 + 3 workdays = Fri(1), Mon(2), Tue(3) = Jan 14
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-10'),
        3,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-14');
    });

    it('should skip to next workday when starting on Saturday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Start Sat Jan 4, 1 workday → Mon Jan 6
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-04'),
        1,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-06');
    });

    it('should skip to next workday when starting on Sunday', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Start Sun Jan 5, 1 workday → Mon Jan 6
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-05'),
        1,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-06');
    });

    it('should skip holidays', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-07'], workdays: [] }),
      );
      // Mon(1), skip Tue(holiday), Wed(2), Thu(3) = Jan 9
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-06'),
        3,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-09');
    });

    it('should handle 5 workdays spanning a week', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Mon Jan 6, 5 workdays = Mon-Fri = Jan 10
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-06'),
        5,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-10');
    });

    it('should handle 10 workdays spanning two weeks', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      // Mon Jan 6, 10 workdays = 2 full weeks = Jan 17 (Fri)
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-06'),
        10,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-17');
    });

    it('should return the start date for workdays=0 or negative', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: [] }),
      );
      const start = d('2025-01-06');
      const endZero = result.current.calculateEndDateByWorkdays(start, 0);
      expect(result.current.formatLocalDate(endZero)).toBe('2025-01-06');

      const endNeg = result.current.calculateEndDateByWorkdays(start, -1);
      expect(result.current.formatLocalDate(endNeg)).toBe('2025-01-06');
    });

    it('should count Saturday as workday when in workdays list', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: [], workdays: ['2025-01-11'] }),
      );
      // Fri Jan 10, 2 workdays → Fri(1), Sat(2 - marked as workday) = Jan 11
      const endDate = result.current.calculateEndDateByWorkdays(
        d('2025-01-10'),
        2,
      );
      expect(result.current.formatLocalDate(endDate)).toBe('2025-01-11');
    });
  });

  describe('countWorkdays and calculateEndDateByWorkdays round-trip', () => {
    it('should be consistent: countWorkdays(start, calcEnd(start, n)) === n', () => {
      const { result } = renderHook(() =>
        useHighlightTime({ holidays: ['2025-01-15'], workdays: [] }),
      );

      for (const n of [1, 3, 5, 7, 10, 15]) {
        const start = d('2025-01-06');
        const endDate = result.current.calculateEndDateByWorkdays(start, n);
        const counted = result.current.countWorkdays(start, endDate);
        expect(counted).toBe(n);
      }
    });
  });
});
