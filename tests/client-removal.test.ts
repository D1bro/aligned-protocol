import { test } from "node:test";
import assert from "node:assert/strict";
import { emailMatches, removalBlock } from "../lib/client-removal.ts";

const me = "admin-1";
const client = { id: "c-1", role: "client", email: "sam@example.com" };

test("an ordinary client with no billing can be removed", () => {
  assert.equal(removalBlock(client, me, false), null);
});

test("yourself, staff, guests and anyone with billing are blocked", () => {
  assert.equal(removalBlock({ ...client, id: me }, me, false), "self");
  assert.equal(removalBlock({ ...client, role: "coach" }, me, false), "staff");
  assert.equal(removalBlock({ ...client, role: "admin" }, me, false), "staff");
  assert.equal(removalBlock({ ...client, email: null }, me, false), "guest");
  assert.equal(removalBlock(client, me, true), "billing");
});

test("the typed email must match, ignoring case and spaces", () => {
  assert.equal(emailMatches("  Sam@Example.com ", "sam@example.com"), true);
  assert.equal(emailMatches("sam@example.co", "sam@example.com"), false);
  assert.equal(emailMatches("", "sam@example.com"), false);
  assert.equal(emailMatches("", null), false);
});
