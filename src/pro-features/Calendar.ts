import type { ICalendar } from './types';

export const DEFAULT_CALENDAR: ICalendar = {
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
  workHours: { start: 9, end: 17 },
};

export function createCalendar(config?: Partial<ICalendar>): ICalendar {
  return {
    ...DEFAULT_CALENDAR,
    ...config,
    holidays: config?.holidays?.map((h) => normalizeDate(h)) || [],
  };
}

export function isWorkday(date: Date, calendar: ICalendar): boolean {
  const dayOfWeek = date.getDay();
  const dateOnly = normalizeDate(date);

  if (
    calendar.holidays.some(
      (h) => normalizeDate(h).getTime() === dateOnly.getTime(),
    )
  ) {
    return false;
  }

  return calendar.workdays.includes(dayOfWeek);
}

export function getWorkdaysInRange(
  start: Date,
  end: Date,
  calendar: ICalendar,
): Date[] {
  const result: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    if (isWorkday(current, calendar)) {
      result.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export function countWorkdays(
  start: Date,
  end: Date,
  calendar: ICalendar,
): number {
  return getWorkdaysInRange(start, end, calendar).length;
}

export function addWorkdays(
  date: Date,
  days: number,
  calendar: ICalendar,
): Date {
  const result = new Date(date);
  let remainingDays = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remainingDays > 0) {
    result.setDate(result.getDate() + direction);
    if (isWorkday(result, calendar)) {
      remainingDays--;
    }
  }

  return result;
}

export function getNextWorkday(date: Date, calendar: ICalendar): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);

  while (!isWorkday(result, calendar)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

export function getPreviousWorkday(date: Date, calendar: ICalendar): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - 1);

  while (!isWorkday(result, calendar)) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

export function calculateDurationWithCalendar(
  start: Date,
  end: Date,
  calendar: ICalendar,
): number {
  return countWorkdays(start, end, calendar);
}

export function adjustTaskDatesToWorkdays(
  start: Date,
  end: Date,
  duration: number,
  calendar: ICalendar,
): { start: Date; end: Date } {
  let adjustedStart = new Date(start);

  if (!isWorkday(adjustedStart, calendar)) {
    adjustedStart = getNextWorkday(adjustedStart, calendar);
  }

  const adjustedEnd = addWorkdays(adjustedStart, duration - 1, calendar);

  return { start: adjustedStart, end: adjustedEnd };
}

function normalizeDate(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getHolidaysForYear(year: number, calendar: ICalendar): Date[] {
  return calendar.holidays.filter((h) => h.getFullYear() === year);
}

export function addHoliday(calendar: ICalendar, date: Date): ICalendar {
  const normalized = normalizeDate(date);
  if (calendar.holidays.some((h) => h.getTime() === normalized.getTime())) {
    return calendar;
  }
  return {
    ...calendar,
    holidays: [...calendar.holidays, normalized].sort(
      (a, b) => a.getTime() - b.getTime(),
    ),
  };
}

export function removeHoliday(calendar: ICalendar, date: Date): ICalendar {
  const normalized = normalizeDate(date);
  return {
    ...calendar,
    holidays: calendar.holidays.filter(
      (h) => h.getTime() !== normalized.getTime(),
    ),
  };
}
