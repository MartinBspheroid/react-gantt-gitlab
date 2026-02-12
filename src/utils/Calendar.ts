/**
 * Calendar Class
 *
 * Defines working hours and non-working days for all tasks in the Gantt chart.
 * Based on Svar Gantt PRO calendar API design.
 *
 * Features:
 * - weekHours configuration: defines working hours per day of week
 * - Holiday support: Set of dates that are non-working days
 * - Workday exceptions: dates that override weekend settings
 */

export interface WeekHours {
  monday?: number;
  tuesday?: number;
  wednesday?: number;
  thursday?: number;
  friday?: number;
  saturday?: number;
  sunday?: number;
}

export interface CalendarOptions {
  weekHours?: WeekHours;
  holidays?: Set<string> | string[];
  workdays?: Set<string> | string[];
}

const DEFAULT_WEEK_HOURS: Required<WeekHours> = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
};

const DAY_NAMES: (keyof WeekHours)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export class Calendar {
  private weekHours: Required<WeekHours>;
  private holidays: Set<string>;
  private workdays: Set<string>;

  constructor(options: CalendarOptions = {}) {
    this.weekHours = { ...DEFAULT_WEEK_HOURS, ...options.weekHours };
    this.holidays =
      options.holidays instanceof Set
        ? options.holidays
        : new Set(options.holidays || []);
    this.workdays =
      options.workdays instanceof Set
        ? options.workdays
        : new Set(options.workdays || []);
  }

  /**
   * Get working hours for a specific day of week
   * @param dayOfWeek - 0 (Sunday) to 6 (Saturday)
   */
  getHours(dayOfWeek: number): number {
    const dayName = DAY_NAMES[dayOfWeek];
    return this.weekHours[dayName] ?? 0;
  }

  /**
   * Check if a day of week is a working day (has >0 working hours)
   * @param dayOfWeek - 0 (Sunday) to 6 (Saturday)
   */
  isWorkingDay(dayOfWeek: number): boolean {
    return this.getHours(dayOfWeek) > 0;
  }

  /**
   * Format date to YYYY-MM-DD string in local timezone
   */
  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Normalize date string to YYYY-MM-DD format
   * Supports both YYYY-MM-DD and YYYY/M/D formats
   */
  private normalizeDateString(dateStr: string): string {
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
   * Check if a specific date is a holiday
   */
  isHoliday(date: Date): boolean {
    const dateStr = this.formatLocalDate(date);
    return this.holidays.has(dateStr);
  }

  /**
   * Check if a specific date is marked as a workday (exception day)
   * This overrides weekend status
   */
  isExceptionWorkday(date: Date): boolean {
    const dateStr = this.formatLocalDate(date);
    return this.workdays.has(dateStr);
  }

  /**
   * Check if a specific date is a non-working day
   * (weekend or holiday, unless marked as exception workday)
   */
  isNonWorkday(date: Date): boolean {
    if (this.isExceptionWorkday(date)) {
      return false;
    }
    return this.isWeekend(date) || this.isHoliday(date);
  }

  /**
   * Check if a date falls on a weekend (based on weekHours)
   */
  isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return !this.isWorkingDay(dayOfWeek);
  }

  /**
   * Count workdays between two dates (inclusive)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of working days
   */
  countWorkdays(startDate: Date, endDate: Date): number {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (start > end) return 0;

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      if (!this.isNonWorkday(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Calculate end date given start date and workdays count.
   *
   * @param startDate - The first day of the task
   * @param workdays - Number of workdays the task spans (inclusive, minimum 1)
   * @returns The date of the last workday
   *
   * Examples (assuming Mon-Fri are workdays):
   * - startDate=Mon, workdays=1 → returns Mon (same day)
   * - startDate=Mon, workdays=3 → returns Wed
   * - startDate=Fri, workdays=3 → returns Tue (skips Sat/Sun)
   * - startDate=Sat, workdays=1 → returns Mon (skips to next workday)
   */
  calculateEndDateByWorkdays(startDate: Date, workdays: number): Date {
    if (!startDate || workdays <= 0) {
      return new Date(startDate);
    }

    const current = new Date(startDate);
    current.setHours(12, 0, 0, 0);
    let remainingWorkdays = workdays;

    while (remainingWorkdays > 0) {
      if (!this.isNonWorkday(current)) {
        remainingWorkdays--;
        if (remainingWorkdays === 0) {
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

  /**
   * Get the next working day from a given date
   * @param date - Starting date
   * @returns The next working day (may be the same day if it's a workday)
   */
  getNextWorkday(date: Date): Date {
    const current = new Date(date);
    current.setHours(12, 0, 0, 0);

    while (this.isNonWorkday(current)) {
      current.setDate(current.getDate() + 1);
    }

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

  /**
   * Snap a date to the nearest working day boundary
   * If date is a non-working day, moves to the next working day
   * @param date - Date to snap
   * @returns Date snapped to working day boundary
   */
  snapToWorkday(date: Date): Date {
    return this.getNextWorkday(date);
  }

  /**
   * Calculate calendar days spanned by a given number of workdays
   * @param startDate - Start date
   * @param workdays - Number of workdays
   * @returns Total calendar days (inclusive)
   */
  calculateCalendarDays(startDate: Date, workdays: number): number {
    if (!startDate || workdays <= 0) return 0;

    const endDate = this.calculateEndDateByWorkdays(startDate, workdays);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }

  /**
   * Get the weekHours configuration
   */
  getWeekHours(): Required<WeekHours> {
    return { ...this.weekHours };
  }

  /**
   * Get holidays set
   */
  getHolidays(): Set<string> {
    return new Set(this.holidays);
  }

  /**
   * Get workday exceptions set
   */
  getWorkdays(): Set<string> {
    return new Set(this.workdays);
  }

  /**
   * Add a holiday
   * @param dateStr - Date string in YYYY-MM-DD format
   */
  addHoliday(dateStr: string): void {
    this.holidays.add(this.normalizeDateString(dateStr));
  }

  /**
   * Remove a holiday
   * @param dateStr - Date string in YYYY-MM-DD format
   */
  removeHoliday(dateStr: string): void {
    this.holidays.delete(this.normalizeDateString(dateStr));
  }

  /**
   * Add a workday exception (a date that should be a workday despite being weekend)
   * @param dateStr - Date string in YYYY-MM-DD format
   */
  addWorkdayException(dateStr: string): void {
    this.workdays.add(this.normalizeDateString(dateStr));
  }

  /**
   * Remove a workday exception
   * @param dateStr - Date string in YYYY-MM-DD format
   */
  removeWorkdayException(dateStr: string): void {
    this.workdays.delete(this.normalizeDateString(dateStr));
  }

  /**
   * Create a default calendar with standard Monday-Friday work week
   */
  static createDefault(): Calendar {
    return new Calendar();
  }

  /**
   * Create a calendar with custom week hours
   * @param weekHours - Custom working hours per day
   */
  static withWeekHours(weekHours: WeekHours): Calendar {
    return new Calendar({ weekHours });
  }

  /**
   * Create a calendar with holidays
   * @param holidays - Array of holiday date strings
   */
  static withHolidays(holidays: string[]): Calendar {
    return new Calendar({ holidays });
  }

  /**
   * Format duration in working days format
   * @param workdays - Number of workdays
   * @returns Formatted string like "5wd"
   */
  static formatWorkdays(workdays: number): string {
    return `${workdays}wd`;
  }
}

export default Calendar;
