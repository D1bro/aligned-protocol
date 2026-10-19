// "Your details": which fields a member may edit, and how each is checked.
// Kept free of server-only imports so the rules can be tested directly.
// Everything except the full name is optional; blank means "clear it".

export type DetailsInput = {
  fullName: string;
  preferredName: string;
  phone: string;
  town: string;
  country: string;
  timezone: string;
  billingName: string;
  billingAddress: string;
};

export type DetailsValues = {
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  town: string | null;
  country: string | null;
  timezone: string | null;
  billing_name: string | null;
  billing_address: string | null;
};

export type DetailsCheck = { ok: true; values: DetailsValues } | { ok: false; field: keyof DetailsInput; message: string };

const LIMITS: Record<keyof DetailsInput, number> = {
  fullName: 120,
  preferredName: 80,
  phone: 40,
  town: 120,
  country: 80,
  timezone: 64,
  billingName: 200,
  billingAddress: 600,
};

const oneLine = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
// Addresses keep their line breaks exactly as typed (any country's format).
const lines = (s: unknown) =>
  typeof s === "string" ? s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join("\n") : "";

export function isTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz === "UTC" || tz.includes("/");
  } catch {
    return false;
  }
}

// A phone number with its international dialling code, e.g. +44 7700 900123.
export function checkPhone(phone: string): string | null {
  if (!phone) return null;
  if (!/^\+?[0-9 ()\-.]+$/.test(phone)) return "Use digits, spaces and an optional + only.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "That doesn’t look like a full phone number.";
  if (!phone.startsWith("+") && !phone.startsWith("00")) return "Start with your country code, for example +44 7700 900123.";
  return null;
}

export function checkDetails(raw: Partial<Record<keyof DetailsInput, unknown>>): DetailsCheck {
  const v = {
    fullName: oneLine(raw.fullName),
    preferredName: oneLine(raw.preferredName),
    phone: oneLine(raw.phone),
    town: oneLine(raw.town),
    country: oneLine(raw.country),
    timezone: oneLine(raw.timezone),
    billingName: oneLine(raw.billingName),
    billingAddress: lines(raw.billingAddress),
  };
  for (const k of Object.keys(LIMITS) as (keyof DetailsInput)[]) {
    if (v[k].length > LIMITS[k]) return { ok: false, field: k, message: `That’s too long (up to ${LIMITS[k]} characters).` };
  }
  if (!v.fullName) return { ok: false, field: "fullName", message: "Add your full name." };
  const phoneProblem = checkPhone(v.phone);
  if (phoneProblem) return { ok: false, field: "phone", message: phoneProblem };
  if (v.timezone && !isTimeZone(v.timezone)) return { ok: false, field: "timezone", message: "Choose a time zone from the list." };
  const orNull = (s: string) => s || null;
  return {
    ok: true,
    values: {
      full_name: v.fullName,
      preferred_name: orNull(v.preferredName),
      phone: orNull(v.phone),
      town: orNull(v.town),
      country: orNull(v.country),
      timezone: orNull(v.timezone),
      billing_name: orNull(v.billingName),
      billing_address: orNull(v.billingAddress),
    },
  };
}

// The name to greet someone by: their preferred name, else the first word of
// their full name.
export function greetingName(p: { preferred_name?: string | null; full_name?: string | null }): string | null {
  return p.preferred_name?.trim() || p.full_name?.trim().split(/\s+/)[0] || null;
}

// The current time in someone's time zone, labelled, e.g. "14:05 (Europe/Lisbon)".
export function localTimeLabel(tz: string | null, now = new Date()): string | null {
  if (!tz || !isTimeZone(tz)) return null;
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  return `${t} (${tz.replace(/_/g, " ")})`;
}
