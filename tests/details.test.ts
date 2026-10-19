import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDetails, checkPhone, greetingName, isTimeZone, localTimeLabel } from "../lib/details.ts";

const base = { fullName: "Sam Fictional" };

test("only the full name is required; blanks clear optional fields", () => {
  const r = checkDetails({ ...base, preferredName: "  ", phone: "", town: "", country: "", timezone: "", billingName: "", billingAddress: "" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.values, { full_name: "Sam Fictional", preferred_name: null, phone: null, town: null, country: null, timezone: null, billing_name: null, billing_address: null });
  const missing = checkDetails({ fullName: "  " });
  assert.equal(missing.ok, false);
});

test("phone numbers need their country code", () => {
  assert.equal(checkPhone("+44 7700 900123"), null);
  assert.equal(checkPhone("0044 7700 900123"), null);
  assert.equal(checkPhone("+351 912 345 678"), null);
  assert.match(checkPhone("07700 900123")!, /country code/);
  assert.match(checkPhone("+44 77")!, /full phone/);
  assert.match(checkPhone("call me")!, /digits/);
});

test("time zones are real named zones", () => {
  assert.ok(isTimeZone("Europe/London"));
  assert.ok(isTimeZone("America/New_York"));
  assert.ok(isTimeZone("UTC"));
  assert.equal(isTimeZone("Mars/Olympus"), false);
  assert.equal(isTimeZone("GMT+1"), false);
  assert.equal(checkDetails({ ...base, timezone: "Nowhere/City" }).ok, false);
});

test("addresses keep their own lines, in any country's format", () => {
  const r = checkDetails({ ...base, billingAddress: "  Rua Exemplo 12 \r\n\r\n 1200-195 Lisboa\nPortugal  " });
  assert.ok(r.ok && r.values.billing_address === "Rua Exemplo 12\n1200-195 Lisboa\nPortugal");
});

test("over-long fields are refused with the field named", () => {
  const r = checkDetails({ ...base, town: "x".repeat(121) });
  assert.ok(!r.ok && r.field === "town");
});

test("greeting uses the preferred name, then the first name", () => {
  assert.equal(greetingName({ preferred_name: "Sammy", full_name: "Samantha Fictional" }), "Sammy");
  assert.equal(greetingName({ preferred_name: " ", full_name: "Samantha Fictional" }), "Samantha");
  assert.equal(greetingName({}), null);
});

test("local time is labelled with its zone", () => {
  const at = new Date("2026-10-19T12:00:00Z");
  assert.equal(localTimeLabel("Europe/Lisbon", at), "13:00 (Europe/Lisbon)");
  assert.equal(localTimeLabel("America/New_York", at), "08:00 (America/New York)");
  assert.equal(localTimeLabel(null, at), null);
});
