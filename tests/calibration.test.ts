import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAreas, progress, shift } from "../lib/calibration.ts";

test("a calibrated chart keeps one entry per known area, in order, with valid scores only", () => {
  const areas = cleanAreas(
    [
      { life_area_id: "health", alone: 2, agreed: 6, definition: "  A 10 is training four times a week.  ", focus: true },
      { life_area_id: "money", alone: 4, agreed: 11, definition: 7, focus: "yes" },
      { life_area_id: "unknown", alone: 5, agreed: 5 },
    ],
    ["money", "health", "career"]
  );
  assert.deepEqual(areas.map((a) => a.life_area_id), ["money", "health", "career"]);
  assert.deepEqual(areas[1], { life_area_id: "health", alone: 2, agreed: 6, definition: "A 10 is training four times a week.", focus: true });
  assert.equal(areas[0].agreed, null, "11 isn't a score");
  assert.equal(areas[0].focus, false);
  assert.equal(areas[2].alone, null);
  assert.deepEqual(progress(areas), { agreed: 1, defined: 1, focus: 1 });
});

test("the shift reads from alone to agreed", () => {
  assert.equal(shift({ alone: 2, agreed: 6 }), "+4");
  assert.equal(shift({ alone: 6, agreed: 5 }), "−1");
  assert.equal(shift({ alone: 5, agreed: 5 }), "same");
  assert.equal(shift({ alone: 5, agreed: null }), "");
});
