import type { GigSource } from '../knowledge/types.js';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function formatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values = Object.fromEntries(
    formatter(timeZone).formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAYS.indexOf(values.weekday as typeof WEEKDAYS[number]);
  if (weekday < 0) throw new Error(`Unable to parse weekday for timezone ${timeZone}`);
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(localAsUtc);
  for (let i = 0; i < 4; i += 1) {
    const offset = timezoneOffsetMs(candidate, timeZone);
    const next = new Date(localAsUtc - offset);
    if (next.getTime() === candidate.getTime()) break;
    candidate = next;
  }

  const check = zonedParts(candidate, timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    throw new Error(`Local time ${year}-${month}-${day} ${hour}:${minute} does not exist in ${timeZone}`);
  }
  return candidate;
}

function localDatePlusDays(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay() };
}

function parseLocalTime(localTime: string): { hour: number; minute: number } {
  const [hourText, minuteText] = localTime.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid localTime: ${localTime}`);
  }
  return { hour, minute };
}

function twiceDailySlots(localTime: string): Array<{ hour: number; minute: number; dayOffset: number }> {
  const first = parseLocalTime(localTime);
  const total = first.hour * 60 + first.minute + 12 * 60;
  return [
    { ...first, dayOffset: 0 },
    { hour: Math.floor((total % 1440) / 60), minute: total % 60, dayOffset: Math.floor(total / 1440) },
  ];
}

export function nextScheduledAt(source: GigSource, after: Date): string | undefined {
  if (source.cadence === 'manual') return undefined;
  const afterLocal = zonedParts(after, source.timezone);
  const first = parseLocalTime(source.localTime);
  const weeklyAnchor = source.cadence === 'weekly' && source.nextScanAt
    ? zonedParts(new Date(source.nextScanAt), source.timezone).weekday
    : afterLocal.weekday;

  for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
    const localDate = localDatePlusDays(afterLocal, dayOffset);
    if (source.cadence === 'weekly' && localDate.weekday !== weeklyAnchor) continue;

    const slots = source.cadence === 'twice-daily'
      ? twiceDailySlots(source.localTime)
      : [{ ...first, dayOffset: 0 }];

    for (const slot of slots) {
      const slotDate = localDatePlusDays(localDate, slot.dayOffset);
      const candidate = zonedDateTimeToUtc(
        slotDate.year,
        slotDate.month,
        slotDate.day,
        slot.hour,
        slot.minute,
        source.timezone,
      );
      if (candidate.getTime() > after.getTime()) return candidate.toISOString();
    }
  }

  throw new Error(`Unable to calculate next schedule for ${source.id}`);
}
