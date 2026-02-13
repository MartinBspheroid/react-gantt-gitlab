/**
 * useHighlightTime Hook
 * Shared hook for weekend/holiday highlighting logic
 */

import { useCallback, useMemo, useRef } from 'react';

/**
 * Simple LRU Cache implementation
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

interface Holiday {
  date: string;
  name?: string;
}

interface UseHighlightTimeOptions {
  holidays: (string | Holiday)[];
  workdays: (string | Holiday)[];
}

interface UseHighlightTimeReturn {
  isWeekend: (date: Date) => boolean;
  isHoliday: (date: Date) => boolean;
  isNonWorkday: (date: Date) => boolean;
  highlightTime: (date: Date, unit: string) => string;
  formatLocalDate: (date: Date) => string;
  normalizeDateString: (dateStr: string) => string;
  countWorkdays: (startDate: Date, endDate: Date) => number;
  calculateEndDateByWorkdays: (startDate: Date, workdays: number) => Date;
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Supports both YYYY-MM-DD and YYYY/M/D formats
 */
function normalizeDateString(dateStr: string): string {
  dateStr = dateStr.trim();

  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useHighlightTime({
  holidays,
  workdays,
}: UseHighlightTimeOptions): UseHighlightTimeReturn {
  // Pre-compute normalized date sets for efficient lookup
  // Use JSON.stringify to create stable dependency
  const holidaysKey = useMemo(
    () =>
      JSON.stringify(holidays.map((h) => (typeof h === 'string' ? h : h.date))),
    [holidays],
  );

  const workdaysKey = useMemo(
    () =>
      JSON.stringify(workdays.map((w) => (typeof w === 'string' ? w : w.date))),
    [workdays],
  );

  // LRU cache for workday counting results
  // Cache key: startDate + endDate + holidaysKey + workdaysKey
  const workdayCacheRef = useRef<LRUCache<string, number>>(new LRUCache(1000));

  // Clear cache when holidays or workdays change
  useMemo(() => {
    workdayCacheRef.current.clear();
  }, [holidaysKey, workdaysKey]);

  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    for (const holiday of holidays) {
      const dateStr = typeof holiday === 'string' ? holiday : holiday.date;
      set.add(normalizeDateString(dateStr));
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidaysKey]);

  const workdaySet = useMemo(() => {
    const set = new Set<string>();
    for (const wd of workdays) {
      const dateStr = typeof wd === 'string' ? wd : wd.date;
      set.add(normalizeDateString(dateStr));
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workdaysKey]);

  // Check if a date is a weekend
  const isWeekend = useCallback(
    (date: Date): boolean => {
      const day = date.getDay();
      const dateStr = formatLocalDate(date);

      // Check if this weekend day is marked as a workday
      if (workdaySet.has(dateStr)) {
        return false; // It's a workday despite being weekend
      }

      return day === 0 || day === 6; // Sunday or Saturday
    },
    [workdaySet],
  );

  // Check if a date is a holiday
  const isHoliday = useCallback(
    (date: Date): boolean => {
      const dateStr = formatLocalDate(date);
      return holidaySet.has(dateStr);
    },
    [holidaySet],
  );

  // Check if a date is a non-workday (weekend or holiday)
  const isNonWorkday = useCallback(
    (date: Date): boolean => {
      return isWeekend(date) || isHoliday(date);
    },
    [isWeekend, isHoliday],
  );

  // Highlight time function for Gantt/Chart components
  const highlightTime = useCallback(
    (date: Date, unit: string): string => {
      if (unit === 'day' && isNonWorkday(date)) {
        return 'wx-weekend';
      }
      return '';
    },
    [isNonWorkday],
  );

  // Count workdays between two dates (inclusive of both start and end)
  const countWorkdays = useCallback(
    (startDate: Date, endDate: Date): number => {
      if (!startDate || !endDate) return 0;

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      if (start > end) return 0;

      // Generate cache key
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(end);
      const cacheKey = `${startStr}|${endStr}|${holidaysKey}|${workdaysKey}`;

      // Check cache first
      const cached = workdayCacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      let count = 0;
      const current = new Date(start);

      while (current <= end) {
        if (!isNonWorkday(current)) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }

      // Store in cache
      workdayCacheRef.current.set(cacheKey, count);

      return count;
    },
    [isNonWorkday, holidaysKey, workdaysKey],
  );

  /**
   * Calculate end date given start date and workdays count.
   *
   * @param startDate - The first day of the task (will be counted as workday 1 if it's a workday)
   * @param workdays - Number of workdays the task spans (inclusive, minimum 1)
   * @returns The date of the last workday
   *
   * Examples (assuming Mon-Fri are workdays):
   * - startDate=Mon, workdays=1 → returns Mon (same day)
   * - startDate=Mon, workdays=3 → returns Wed
   * - startDate=Fri, workdays=3 → returns Tue (skips Sat/Sun)
   * - startDate=Sat, workdays=1 → returns Mon (skips to next workday)
   *
   * Note: Uses noon (12:00) for time to avoid timezone edge cases where
   * midnight dates might shift to adjacent days during conversion.
   */
  const calculateEndDateByWorkdays = useCallback(
    (startDate: Date, workdays: number): Date => {
      if (!startDate || workdays <= 0) {
        return new Date(startDate);
      }

      const current = new Date(startDate);
      current.setHours(12, 0, 0, 0); // Use noon to avoid timezone issues
      let remainingWorkdays = workdays;

      // Iterate through days, counting only workdays
      // Stop when we've counted the required number of workdays
      while (remainingWorkdays > 0) {
        if (!isNonWorkday(current)) {
          remainingWorkdays--;
          if (remainingWorkdays === 0) {
            // Found the last workday - return a new Date to avoid reference issues
            return new Date(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
              12,
              0,
              0,
              0,
            );
          }
        }
        current.setDate(current.getDate() + 1);
      }

      // Fallback (shouldn't reach here with valid inputs)
      return new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        12,
        0,
        0,
        0,
      );
    },
    [isNonWorkday],
  );

  return {
    isWeekend,
    isHoliday,
    isNonWorkday,
    highlightTime,
    formatLocalDate,
    normalizeDateString,
    countWorkdays,
    calculateEndDateByWorkdays,
  };
}
