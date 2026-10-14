import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const DEFAULT_TZ = "Asia/Kolkata";

/**
 * Convert a user's local date + time (e.g. "2026-03-15", "09:00") in their
 * timezone to a proper UTC Date object.
 *
 * Example: localTimeToUTC("2026-03-15", "09:00", "Asia/Kolkata")
 *   --> Date representing 09:00 IST = 03:30 UTC
 */
export function localTimeToUTC(
  dateStr: string,
  timeStr: string,
  timezone: string = DEFAULT_TZ
): Date {
  // Construct a Date as if it were in the user's timezone
  const localDatetime = new Date(`${dateStr}T${timeStr}:00`);
  // fromZonedTime interprets localDatetime as being in `timezone`
  // and returns the equivalent UTC Date
  return fromZonedTime(localDatetime, timezone);
}

/**
 * Format a UTC Date for display in a specific timezone.
 * Returns formatted string like "Mar 15, 2026 09:00 AM".
 */
export function utcToLocalTime(
  utcDate: Date | string,
  timezone: string = DEFAULT_TZ,
  formatStr: string = "MMM d, yyyy hh:mm a"
): string {
  return formatInTimeZone(new Date(utcDate), timezone, formatStr);
}

/**
 * The calendar day a UTC instant falls on *in the user's timezone*, as
 * "yyyy-MM-dd" - the key used to mark a day as already holding a post.
 */
export function toZonedDayKey(
  date: Date | string,
  timezone: string = DEFAULT_TZ
): string {
  return formatInTimeZone(new Date(date), timezone, "yyyy-MM-dd");
}

/**
 * Given a user's posting schedule and timezone, compute posting slots
 * for a given week as proper UTC Dates.
 *
 * @param weekStart - The Monday of the target week
 * @param days - Array of day names, e.g. ["Monday", "Wednesday", "Friday"]
 * @param time - Time string "HH:MM" in user's local timezone
 * @param timezone - IANA timezone string
 * @returns Array of UTC Dates for each posting slot
 */
/**
 * Compute posting slots for the next N weekdays (Mon-Fri) starting from a given date.
 * Skips Saturday and Sunday.
 *
 * @param startDate - The date to start from (typically today)
 * @param count - Number of weekday slots to generate (e.g. 5)
 * @param time - Time string "HH:MM" in user's local timezone
 * @param timezone - IANA timezone string
 * @returns Array of UTC Dates for each posting slot
 */
export function getNextWeekdaySlots(
  startDate: Date,
  count: number,
  time: string,
  timezone: string = DEFAULT_TZ
): Date[] {
  const slots: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (slots.length < count) {
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Weekday - create a slot
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      slots.push(localTimeToUTC(dateStr, time, timezone));
    }
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

const DAY_NAME_TO_JS_DAY: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Compute the next batch of posting slots starting from `startDate`, only on
 * the days the user has chosen in their posting schedule.
 *
 * Example: startDate = Mar 16 (Mon), days = ["Monday", "Wednesday", "Friday"]
 *   --> Returns slots for Mar 16 (Mon), Mar 18 (Wed), Mar 20 (Fri)
 *
 * If startDate falls mid-week (e.g. Wednesday), only Wed and Fri slots
 * are returned for that first week, then Mon/Wed/Fri of the next week, etc.
 *
 * @param startDate - The date to start scanning from
 * @param days - Array of day names from the user's posting schedule
 * @param time - Time string "HH:MM" in user's local timezone
 * @param timezone - IANA timezone string
 * @param maxSlots - Maximum number of slots to return (defaults to days.length)
 * @param occupiedDayKeys - "yyyy-MM-dd" keys (in `timezone`) that already hold a
 *   post; those days are skipped so a new batch never doubles up on a day that is
 *   already taken. Build them with `toZonedDayKey`.
 * @returns Array of UTC Dates for each posting slot
 */
export function getNextScheduledSlots(
  fromTime: Date,
  days: string[],
  time: string,
  timezone: string = DEFAULT_TZ,
  maxSlots?: number,
  occupiedDayKeys?: Iterable<string>,
): Date[] {
  let targetDays = new Set<number>(
    days.map((d) => DAY_NAME_TO_JS_DAY[d]).filter((d): d is number => d !== undefined)
  );
  // Fallback: if no valid days were given, schedule on weekdays (Mon-Fri).
  if (targetDays.size === 0) targetDays = new Set<number>([1, 2, 3, 4, 5]);

  // No. of posts
  const limit = maxSlots ?? targetDays.size; // default: one post per selected day
  const nowMs = fromTime.getTime();
  const taken = new Set(occupiedDayKeys ?? []);
  const slots: Date[] = [];

  // Walk calendar days in the USER'S timezone, starting from "today" there, and
  // collect each upcoming scheduled day's slot whose time is still in the future.
  // All date math is done on UTC-midnight keys so it never drifts with the server's
  // own timezone (e.g. UTC on Vercel) - that drift was scheduling posts in the past.
  let dayKey = formatInTimeZone(fromTime, timezone, "yyyy-MM-dd"); // today, in the user's tz
  let scanned = 0;

  // Scan up to a year ahead: a 30-post batch on a single weekday spans ~30 weeks,
  // and days that already hold a post are skipped, pushing the end date further out.
  while (slots.length < limit && scanned < 366) {
    // Day-of-week of this calendar date (a yyyy-MM-dd date has the same weekday in
    // every timezone, so reading it at UTC midnight is correct).
    const dow = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
    // Skip days that already hold a scheduled post, so a new batch fills the next
    // FREE matching days instead of doubling up on days that are already taken.
    if (targetDays.has(dow) && !taken.has(dayKey)) {
      const slot = localTimeToUTC(dayKey, time, timezone);
      if (slot.getTime() > nowMs) slots.push(slot); // never schedule in the past
    }
    // Advance one calendar day.
    const nextMs = new Date(`${dayKey}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;
    dayKey = new Date(nextMs).toISOString().slice(0, 10);
    scanned++;
  }

  return slots;
}

export function getPostingSlots(
  weekStart: Date,
  days: string[],
  time: string,
  timezone: string = DEFAULT_TZ
): Date[] {
  const dayNameToOffset: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };

  const slots: Date[] = [];

  for (const dayName of days) {
    const offset = dayNameToOffset[dayName];
    if (offset === undefined) continue;

    // Calculate the date for this day of the week
    const slotDate = new Date(weekStart);
    slotDate.setDate(weekStart.getDate() + offset);
    // Extract YYYY-MM-DD for the local date
    const year = slotDate.getFullYear();
    const month = String(slotDate.getMonth() + 1).padStart(2, "0");
    const day = String(slotDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // Convert the user's local time on that date to UTC
    slots.push(localTimeToUTC(dateStr, time, timezone));
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}
