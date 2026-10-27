import { test } from "node:test";
import assert from "node:assert/strict";
import { actionHint, frequencyOf, goalSentence, parseWhen, whenPhrase } from "../lib/plan-action.ts";

test("the action is written as one sentence, for them", () => {
  assert.equal(whenPhrase(["Sun"], "18:00", "after dinner"), "Every Sunday at 6pm, after dinner");
  assert.equal(
    goalSentence(["Sun"], "18:00", "After dinner.", "Spend ten minutes on my spending sheet"),
    "Every Sunday at 6pm, after dinner, I’ll spend ten minutes on my spending sheet."
  );
  assert.equal(goalSentence(["Mon", "Thu"], "07:30", "", "I'll go for a 20-minute walk."), "Every Monday and Thursday at 7:30am, I’ll go for a 20-minute walk.");
  assert.equal(whenPhrase(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "", ""), "Every day");
  assert.equal(frequencyOf(["Sun"]), "Weekly");
  assert.equal(frequencyOf(["Mon", "Thu"]), "A few times a week");
});

test("a saved action reads back into the fields", () => {
  assert.deepEqual(parseWhen("Every Sunday at 6pm, after dinner"), { days: ["Sun"], time: "18:00", after: "after dinner" });
  assert.deepEqual(parseWhen("Every Monday and Thursday at 7:30am"), { days: ["Mon", "Thu"], time: "07:30", after: "" });
  assert.deepEqual(parseWhen(null), { days: [], time: "", after: "" });
});

test("vague actions are flagged until someone watching could tell", () => {
  assert.match(actionHint("exercise more", ["Sun"], "18:00") ?? "", /“more” is hard to tick off/);
  assert.match(actionHint("budget", ["Sun"], "18:00") ?? "", /exactly what you’ll do/);
  assert.match(actionHint("spend ten minutes on my spending sheet", [], "") ?? "", /Choose the day/);
  assert.match(actionHint("spend ten minutes on my spending sheet", ["Sun"], "") ?? "", /Add a time/);
  assert.equal(actionHint("spend ten minutes on my spending sheet", ["Sun"], "18:00"), null);
  // "before" isn't "be".
  assert.equal(actionHint("write my list before bed", ["Mon"], "21:00"), null);
});
