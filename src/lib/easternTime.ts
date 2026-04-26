// Eastern Time (America/Toronto) date helpers used by the Admin lead table.
// Extracted so they can be unit-tested in isolation.

export const EASTERN_TZ = "America/Toronto";

/** Returns the wall-clock parts of `date` rendered in Eastern Time. */
export function getEasternParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Builds a UTC Date that corresponds to the given Eastern wall-clock time. */
export function easternWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = getEasternParts(new Date(utcGuess));
  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const actualAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offset = actualAsUtc - wantedAsUtc;
  return new Date(utcGuess - offset);
}

export function easternStartOfDay(date: Date): Date {
  const p = getEasternParts(date);
  return easternWallClockToUtc(p.year, p.month, p.day, 0, 0, 0);
}
export function easternEndOfDay(date: Date): Date {
  const p = getEasternParts(date);
  return new Date(
    easternWallClockToUtc(p.year, p.month, p.day, 23, 59, 59).getTime() + 999,
  );
}
export function easternStartOfMonth(date: Date): Date {
  const p = getEasternParts(date);
  return easternWallClockToUtc(p.year, p.month, 1, 0, 0, 0);
}
export function easternStartOfYear(date: Date): Date {
  const p = getEasternParts(date);
  return easternWallClockToUtc(p.year, 1, 1, 0, 0, 0);
}
/** Start of week (Monday) in Eastern Time. */
export function easternStartOfWeek(date: Date): Date {
  const startToday = easternStartOfDay(date);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd] ?? 1;
  const daysSinceMonday = (dow + 6) % 7;
  return new Date(startToday.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}
