const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const WEATHER_MAX_AGE_MS = 3 * HOUR_MS;
export const MARKET_MAX_AGE_MS = 7 * DAY_MS;

const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ZONED_LOCAL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const ZONED_FORMATTERS = new Map();

function zoneFormatter(timeZone) {
  if (typeof timeZone !== "string" || timeZone === "") {
    return null;
  }

  const cached = ZONED_FORMATTERS.get(timeZone);

  if (cached !== undefined) {
    return cached;
  }

  let formatter;

  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return null;
  }

  ZONED_FORMATTERS.set(timeZone, formatter);

  return formatter;
}

function zoneFields(utcMs, timeZone) {
  const parts = zoneFormatter(timeZone).formatToParts(new Date(utcMs));
  const fields = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      fields[part.type] = Number(part.value);
    }
  }

  return fields;
}

function zoneOffsetMs(utcMs, timeZone) {
  const fields = zoneFields(utcMs, timeZone);
  const asUtc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second
  );

  return asUtc - (utcMs - (utcMs % 1000));
}

export function parseZonedTimestamp(value, timeZone) {
  if (typeof value !== "string") {
    return null;
  }

  const local = ZONED_LOCAL_TIMESTAMP.exec(value);

  if (local === null) {
    const strict = parseTimestamp(value);

    return strict === null ? null : new Date(strict).toISOString();
  }

  const formatter = zoneFormatter(timeZone);

  if (formatter === null) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fraction] = local;
  const wallClockMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
    Number((fraction ?? "0").padEnd(3, "0"))
  );

  if (!Number.isFinite(wallClockMs)) {
    return null;
  }

  const instantMs = wallClockMs - zoneOffsetMs(wallClockMs, timeZone);
  const resolved = zoneFields(instantMs, timeZone);
  const matchesWallClock =
    resolved.year === Number(year) &&
    resolved.month === Number(month) &&
    resolved.day === Number(day) &&
    resolved.hour === Number(hour) &&
    resolved.minute === Number(minute) &&
    resolved.second === Number(second ?? 0);

  return matchesWallClock ? new Date(instantMs).toISOString() : null;
}

export function parseTimestamp(value) {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  if (!ISO_TIMESTAMP.test(value)) {
    return null;
  }

  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function isStale(value, now, maxAgeMs) {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return true;
  }

  return now - Date.parse(timestamp) > maxAgeMs;
}
