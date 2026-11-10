import { test } from "node:test";
import assert from "node:assert/strict";
import { alreadyInNote } from "../lib/summary-content.ts";

const block = "Check in on:\n- Did he book the gym?\n- How was the art group?";

test("a block already in the coach's note is spotted, whatever the spacing", () => {
  assert.equal(alreadyInNote(`Earlier note.\n\n${block}`, block), true);
  assert.equal(alreadyInNote("Earlier note.\n\nCheck in on:  - Did he book the gym?\n\n- How was the art group?", block), true);
});

test("new text gets through", () => {
  assert.equal(alreadyInNote("Earlier note.", block), false);
  assert.equal(alreadyInNote(block, "Check in on:\n- Something new"), false);
});

test("empty text is never treated as already there", () => {
  assert.equal(alreadyInNote("Anything", "   "), false);
});
