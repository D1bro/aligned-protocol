import { test } from "node:test";
import assert from "node:assert/strict";
import { linkType, safeNext } from "../lib/auth-links.ts";

test("only known link types are accepted", () => {
  assert.equal(linkType("recovery"), "recovery");
  assert.equal(linkType("email_change"), "email_change");
  assert.equal(linkType("admin"), null);
  assert.equal(linkType(null), null);
});

test("next stays on this site", () => {
  assert.equal(safeNext("/reset-password/confirm?welcome=1"), "/reset-password/confirm?welcome=1");
  assert.equal(safeNext("/"), "/");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext("https://evil.example/x"), "/");
  assert.equal(safeNext("//evil.example/x"), "/");
  assert.equal(safeNext("/\\evil.example"), "/");
  assert.equal(safeNext("javascript:alert(1)"), "/");
});
