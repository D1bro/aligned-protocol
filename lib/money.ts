// Money is kept in whole pence everywhere. These are the only two places it
// turns into, or out of, pounds-and-pence text.

// 12345 -> "£123.45"; -500 -> "−£5.00"
export function formatPence(pence: number): string {
  const sign = pence < 0 ? "−" : "";
  const abs = Math.abs(Math.trunc(pence));
  const pounds = Math.floor(abs / 100).toLocaleString("en-GB");
  return `${sign}£${pounds}.${String(abs % 100).padStart(2, "0")}`;
}

// "£1,234.5" / "1234.50" / "75" -> pence. Null for anything that isn't a
// plain positive-or-zero amount with at most two decimal places.
export function parsePounds(input: string): number | null {
  const s = input.trim().replace(/^£/, "").replace(/,/g, "").trim();
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

// Pence as an editable pounds value: 7500 -> "75.00".
export function penceToInput(pence: number): string {
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}`;
}
