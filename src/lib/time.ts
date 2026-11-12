// PressCompass shows and takes times in Western Indonesia Time (WIB, Asia/Jakarta, UTC+7, no daylight saving).
// The database stores UTC.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Reads the value of an `<input type="datetime-local">` as WIB. Returns null when it is not a real date-time. */
export function parseWibInput(value: string): Date | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc - WIB_OFFSET_MS);
}

/** The value for an `<input type="datetime-local">` showing this moment in WIB. */
export function toWibInput(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

type Style = 'datetime' | 'date' | 'time' | 'short';

/** `13 Nov 2026, 21:40` (datetime), `13 Nov 2026` (date), `21:40` (time) or `13 Nov · 21:40` (short), in WIB. */
export function formatWib(value: Date | string, style: Style = 'datetime'): string {
  const wib = new Date(new Date(value).getTime() + WIB_OFFSET_MS);
  const day = wib.getUTCDate();
  const month = MONTHS[wib.getUTCMonth()];
  const year = wib.getUTCFullYear();
  const time = `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
  if (style === 'date') return `${day} ${month} ${year}`;
  if (style === 'time') return time;
  if (style === 'short') return `${day} ${month} · ${time}`;
  return `${day} ${month} ${year}, ${time}`;
}

/** Midnight WIB of the day `now` falls on, as a UTC instant. */
export function wibDayStart(now: Date): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS);
}
