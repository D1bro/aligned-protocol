// The daily log and the Next Step review checks (Duane, 10 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsForToday, countProgress, dateLabel, daysLabel, formatWhen, moveDate, moveDays, moveLog, movesForToday, moveTime, timeLabel, todayHint, whenLabel, type LogMove } from "../lib/daily-log.ts";
import { reviewChanges, reviewFlags, twoInOne, forMember } from "../lib/next-step-review.ts";

const day = (iso: string) => iso.slice(0, 10);

test("reading when a move happens", () => {
  assert.deepEqual(moveDays("Monday and Thursday"), [0, 3]);
  assert.deepEqual(moveDays("Monday, Thursday and Friday"), [0, 3, 4]);
  assert.deepEqual(moveDays("Mon & Thu evenings"), [0, 3]);
  assert.deepEqual(moveDays("Sundays"), [6]);
  assert.deepEqual(moveDays("Sunday"), [6]);
  assert.deepEqual(moveDays("Every day"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(moveDays("daily, before 11pm"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(moveDays("Weekdays"), [0, 1, 2, 3, 4]);
  assert.deepEqual(moveDays("Thursday 7pm"), [3]);
  assert.deepEqual(moveDays("Sunday, by 8pm"), [6]);
  // One-offs
  assert.deepEqual(moveDays("By Friday"), []);
  assert.deepEqual(moveDays("This Saturday"), []);
  assert.deepEqual(moveDays("Friday 14th"), []);
  assert.deepEqual(moveDays("When I'm paid"), []);
  assert.deepEqual(moveDays(""), []);
  assert.deepEqual(moveDays("Every Friday, starting this Friday"), [4]);
  assert.equal(daysLabel([0, 3]), "Monday and Thursday");
  assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6]), "Every day");
});

const moves: LogMove[] = [
  { id: "spin", goal_id: "g", body: "Spin class", when_text: "Monday and Thursday", done_at: null },
  { id: "off", goal_id: "g", body: "Phone off by 11", when_text: "Every day", done_at: null },
  { id: "book", goal_id: "g", body: "Book the classes", when_text: "Sundays", done_at: null },
  { id: "kit", goal_id: "g", body: "Buy gym shoes", when_text: "By Friday", done_at: null },
  { id: "old", goal_id: "g", body: "Join the gym", when_text: null, done_at: "2026-11-20T10:00:00Z" },
];

test("Today shows every move due that day, each with its own tick", () => {
  const ticks = [{ move_id: "spin", action_date: "2026-11-30", done_at: "2026-11-30T07:40:00Z" }];
  const monday = movesForToday(moves, ticks, "2026-11-30", day);
  assert.deepEqual(monday.map((m) => [m.moveId, m.kind, m.done]), [["spin", "repeat", true], ["off", "repeat", false], ["kit", "once", false]]);
  const sunday = movesForToday(moves, [], "2026-11-29", day);
  assert.deepEqual(sunday.map((m) => m.moveId), ["off", "book", "kit"]);
  // A one-off ticked today stays, ticked; done on an earlier day, it's gone.
  const doneToday = movesForToday([{ ...moves[3], done_at: "2026-11-30T09:00:00Z" }], [], "2026-11-30", day);
  assert.deepEqual(doneToday.map((m) => m.done), [true]);
  assert.equal(movesForToday([moves[4]], [], "2026-11-30", day).length, 0);
});

test("a move's log over a fortnight, and done when counted", () => {
  const ticks = [
    { move_id: "spin", action_date: "2026-11-23", done_at: "x" },
    { move_id: "spin", action_date: "2026-11-28", done_at: "x" },
    { move_id: "spin", action_date: "2026-11-30", done_at: "x" },
    { move_id: "spin", action_date: "2026-11-19", done_at: "x" },
    { move_id: "off", action_date: "2026-11-30", done_at: null },
  ];
  const log = moveLog(moves[0], ticks, "2026-11-23", 14, "2026-12-01", day);
  assert.equal(log.length, 14);
  assert.deepEqual(log.filter((d) => d.planned).map((d) => d.date), ["2026-11-23", "2026-11-26", "2026-11-30", "2026-12-03"]);
  assert.deepEqual(log.filter((d) => d.done).map((d) => d.date), ["2026-11-23", "2026-11-28", "2026-11-30"]);
  assert.equal(log.find((d) => d.date === "2026-12-01")!.today, true);
  assert.equal(log.find((d) => d.date === "2026-12-02")!.future, true);
  assert.deepEqual(countProgress({ count_target: 8, count_move_id: "spin" }, ticks, "2026-11-23"), { done: 3, target: 8 });
  // A move added part way through is only planned from that day.
  const late = moveLog({ ...moves[1], created_at: "2026-11-30T09:00:00Z" }, [], "2026-11-23", 14, "2026-12-01", day);
  assert.equal(late.filter((d) => d.planned)[0].date, "2026-11-30");
  assert.equal(countProgress({ count_target: null, count_move_id: "spin" }, ticks, null), null);
});

test("session actions in Today: linked to a Next Step, or due", () => {
  const actions = [
    { id: "a", summary_id: "s", owner: "client", body: "Tell your coach once booked", due_date: null, status: "open", goal_id: "g" },
    { id: "b", summary_id: "s", owner: "client", body: "Breathing practice", due_date: "2026-11-30", status: "open", goal_id: null },
    { id: "c", summary_id: "s", owner: "client", body: "Wednesday group", due_date: "2026-12-02", status: "open", goal_id: null },
    { id: "d", summary_id: "s", owner: "client", body: "Map the chapters", due_date: null, status: "open", goal_id: null },
    { id: "e", summary_id: "s", owner: "coach", body: "Send the article", due_date: "2026-11-30", status: "open", goal_id: null },
    { id: "f", summary_id: "s", owner: "client", body: "Old", due_date: "2026-11-20", status: "dropped", goal_id: null },
    { id: "g2", summary_id: "s", owner: "client", body: "Late one", due_date: "2026-11-27", status: "open", goal_id: null },
  ];
  const updates = [
    { commitment_id: "b", progress: "done", created_at: "2026-11-30T08:00:00Z" },
    { commitment_id: "g2", progress: "partly", created_at: "2026-11-28T08:00:00Z" },
  ];
  const today = actionsForToday(actions, updates, ["g"], "2026-11-30", day);
  assert.deepEqual(today.map((a) => [a.id, a.linked, a.done, a.late]), [["a", true, false, false], ["b", false, true, false], ["g2", false, false, true]]);
  // Done yesterday: off the list.
  assert.equal(actionsForToday(actions, updates, ["g"], "2026-12-01", day).some((a) => a.id === "b"), false);
});

test("the review checks: what to sharpen and what to ask", () => {
  const flags = reviewFlags({
    title: "Keep going to the gym and eat healthily on gym days",
    why: "Feeling shame and disappointment at not looking after my health.",
    done: "Feel brighter and more energised",
    countTarget: null,
    start: 6,
    aim: 9,
    inTheWay: "When I'm tired I reach for the console or YouTube and stay up late.",
    moves: [{ body: "Keep attending the gym. Go for a morning walk.", when_text: "Monday, Thursday and Friday" }],
  });
  assert.deepEqual(flags.map((f) => f.part), ["why", "step", "done", "aim", "moves", "way"]);
  assert.ok(flags.every((f) => f.ask.endsWith("?")));

  const sharp = reviewFlags({
    title: "Back to the gym twice a week",
    why: "I want to walk home from the gym feeling taller.",
    done: "8 gym sessions in 4 weeks",
    countTarget: 8,
    start: 6,
    aim: 7,
    inTheWay: "When I'm tired I end up on my phone late.",
    moves: [
      { body: "Spin class", when_text: "Monday and Thursday" },
      { body: "Phone off by 11", when_text: "Every day" },
    ],
  });
  assert.deepEqual(sharp, []);
});

test("a move with two things in it", () => {
  assert.equal(twoInOne("Keep attending the gym. Go for a morning walk."), true);
  assert.equal(twoInOne("Go to the gym and eat well"), true);
  assert.equal(twoInOne("Book Monday and Thursday spin"), false);
  assert.equal(twoInOne("Spin class."), false);
});

test("keeping a review: what changes, and the AI read stays with the coach", () => {
  const content = {
    why: "I want to walk home feeling taller.",
    done: "8 gym sessions in 4 weeks",
    countTarget: 8,
    countMove: 0,
    aim: 7,
    moves: [{ id: "spin", body: "Spin class", when: "Monday and Thursday" }],
    ai: { flags: [], worked: [], opening: "", at: "x" },
  };
  const changes = reviewChanges(content, {
    title: "Back to the gym",
    name: null,
    why: "Shame.",
    done: "Feel better",
    aim: 9,
    countTarget: null,
    moves: [{ id: "spin", body: "Gym. Walk.", when_text: "Mon, Thu, Fri" }],
  });
  assert.deepEqual(changes.map((c) => c.label), ["Why", "Done when", "Counted", "How far", "Moves"]);
  assert.equal("ai" in forMember(content), false);
  // Counting the same move the same number of times isn't a change.
  const same = reviewChanges({ countTarget: 8, countMove: 0, moves: [{ id: "spin", body: "Spin class", when: "Tuesday" }] }, {
    title: "x", name: null, why: null, done: null, aim: null, countTarget: 8, countMoveId: "spin", moves: [{ id: "spin", body: "Spin class", when_text: "Tuesday" }],
  });
  assert.deepEqual(same, []);
});

test("when a move happens, picked: one form everywhere", () => {
  assert.equal(moveTime("Weekdays · 8:55am"), "08:55");
  assert.equal(moveTime("Thursday 7pm"), "19:00");
  assert.equal(moveTime("12pm"), "12:00");
  assert.equal(moveTime("12am"), "00:00");
  assert.equal(moveTime("Mondays at 19:30"), "19:30");
  assert.equal(moveTime("Friday 14th"), null);
  assert.equal(timeLabel("08:55"), "8:55am");
  assert.equal(timeLabel("19:00"), "7pm");
  assert.equal(timeLabel("00:00"), "12am");

  const weekdays = formatWhen({ days: [4, 0, 1, 2, 3], time: "08:55", date: null });
  assert.equal(weekdays, "Weekdays · 8:55am");
  assert.deepEqual(moveDays(weekdays), [0, 1, 2, 3, 4]);
  assert.equal(moveTime(weekdays), "08:55");
  assert.equal(formatWhen({ days: [0, 3], time: null, date: null }), "Monday and Thursday");
  assert.equal(formatWhen({ days: [6], time: "18:00", date: null }), "Sunday · 6pm");
  assert.deepEqual(moveDays("Sunday · 6pm"), [6]);

  // A one-off by a date reads back as a one-off, with its date.
  const once = formatWhen({ days: [], time: null, date: "2026-11-14" });
  assert.equal(once, "By Sat 14 Nov");
  assert.deepEqual(moveDays(once), []);
  assert.equal(moveDate(once, "2026-11-11"), "2026-11-14");
  assert.equal(moveDate("By 3 Jan", "2026-12-20"), "2027-01-03");
  assert.equal(dateLabel("2026-11-13"), "Fri 13 Nov");
  assert.equal(formatWhen({ days: [], time: null, date: null }), "");

  // Shown the same way, whatever was written before.
  assert.equal(whenLabel("Mon & Thu 7pm"), "Monday and Thursday · 7pm");
  assert.equal(whenLabel("weekdays"), "Weekdays");
  assert.equal(whenLabel("When I'm paid"), "When I'm paid");
  assert.equal(whenLabel(null), "");
});

test("the line under a move as it's set", () => {
  assert.equal(todayHint("Weekdays · 8:55am"), "This will appear in Today every weekday, ready to tick off.");
  assert.equal(todayHint("Every day"), "This will appear in Today every day, ready to tick off.");
  assert.equal(todayHint("Monday and Thursday"), "This will appear in Today every Monday and Thursday, ready to tick off.");
  assert.equal(todayHint("Weekends"), "This will appear in Today every Saturday and Sunday, ready to tick off.");
  assert.equal(todayHint("By Sat 14 Nov"), "This will appear in Today until you tick it off.");
});
