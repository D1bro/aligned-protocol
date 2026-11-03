// The connected journal (migration 0025): an entry can link to the writer's
// own goal, carry one https video link and up to four images from their own
// folder of the private 'journal' bucket. Nobody else can link, read or add.
// Fictional people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asOwner, makeUser, val, errorOf } from "./db-harness.ts";

let db: Awaited<ReturnType<typeof freshDb>>;
let sam: string, robin: string, samGoal: string, robinGoal: string;

before(async () => {
  db = await freshDb();
  sam = await makeUser(db, "sam@example.com", "client", "Sam Fictional");
  robin = await makeUser(db, "robin@example.com", "client", "Robin Unrelated");
  await asOwner(db);
  await db.query(
    `insert into public.memberships (client_id, tier, status, stripe_subscription_id, stripe_customer_id, price_pence, current_period_end)
     values ($1, 'practice', 'active', 'sub_test_sam', 'cus_test_sam', 900, now() + interval '20 days'),
            ($2, 'practice', 'active', 'sub_test_robin', 'cus_test_robin', 900, now() + interval '20 days')`,
    [sam, robin]
  );
  await asUser(db, sam);
  samGoal = await val<string>(db, `insert into public.goals (client_id, goal_title) values ($1, 'Check my spending') returning id`, [sam]);
  await asUser(db, robin);
  robinGoal = await val<string>(db, `insert into public.goals (client_id, goal_title) values ($1, 'Walk at lunch') returning id`, [robin]);
});

const entry = (goal: string | null, video: string | null, images: string[]) =>
  [`insert into public.journal_entries (client_id, entry_date, body, goal_id, video_url, images) values ($1, '2026-11-03', 'A good day', $2, $3, $4)`, [sam, goal, video, images]] as const;

test("an entry links to their own goal, an https video and their own images", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, ...entry(samGoal, "https://www.youtube.com/watch?v=abc", [`${sam}/e1/a.jpg`, `${sam}/e1/b.jpg`])), null);
  assert.equal(await errorOf(db, ...entry(null, null, [])), null, "all optional");
});

test("nothing that isn't theirs, and no more than four images", async () => {
  await asUser(db, sam);
  assert.ok(await errorOf(db, ...entry(robinGoal, null, [])), "someone else's goal");
  assert.ok(await errorOf(db, ...entry(null, null, [`${robin}/e1/a.jpg`])), "someone else's image");
  assert.ok(await errorOf(db, ...entry(null, "http://example.com/video", [])), "https only");
  assert.ok(await errorOf(db, ...entry(null, null, [1, 2, 3, 4, 5].map((n) => `${sam}/e1/${n}.jpg`))), "four at most");
});

test("the journal folder is private to each member", async () => {
  await asUser(db, sam);
  assert.equal(await errorOf(db, `insert into storage.objects (bucket_id, name) values ('journal', $1)`, [`${sam}/e1/a.jpg`]), null);
  assert.ok(await errorOf(db, `insert into storage.objects (bucket_id, name) values ('journal', $1)`, [`${robin}/e1/a.jpg`]));
  await asUser(db, robin);
  assert.equal(await val(db, `select count(*)::int from storage.objects where bucket_id = 'journal'`), 0);
  assert.equal(await val(db, `select public from storage.buckets where id = 'journal'`), false);
});
