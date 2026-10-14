// Session times: stored in UTC with a named timezone (Europe/London by
// default), entered and shown in that timezone. Handles the clocks changing
// (GMT <-> BST) without a date library.

export const BUSINESS_TZ = "Europe/London";

// The offset (minutes ahead of UTC) a timezone has at a given instant.
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

// "2026-10-25" + "09:30" in Europe/London -> the UTC instant. Returns null for
// a malformed date/time, or for a local time that doesn't exist (the hour
// skipped when the clocks go forward).
export function localToUtc(date: string, time: string, timeZone = BUSINESS_TZ): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, da, h, mi);
  // Two passes settle the offset either side of a clock change.
  let guess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  guess = new Date(naive - offsetMinutes(guess, timeZone) * 60_000);
  const back = toLocalParts(guess, timeZone);
  if (back.date !== date || back.time !== time) return null;
  return guess;
}

// A UTC instant as local date ("2026-10-25") and time ("09:30") strings,
// e.g. to pre-fill a reschedule form.
export function toLocalParts(instant: Date | string, timeZone = BUSINESS_TZ): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// "Tue 3 Nov 2026, 18:00 GMT" — always labelled with the zone in force.
export function formatSessionTime(instant: Date | string, timeZone = BUSINESS_TZ): string {
  const d = new Date(instant);
  const day = d.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const zone =
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${day}, ${time} ${zone === "GMT+1" ? "BST" : zone}`;
}
