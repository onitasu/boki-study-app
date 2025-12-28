import { format } from 'date-fns';

export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getDateStringInTimeZone(timeZone: string, date = new Date()): string {
  // `en-CA` produces YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getTodayJST(): string {
  return getDateStringInTimeZone('Asia/Tokyo');
}
