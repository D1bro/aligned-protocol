# Aligned Diagnostic Engine — Content & Schema Spec

**Status: approved for V1 implementation.** Schema not yet applied to the database.
Areas pressure-tested so far: Money & Stability, Relationships & Connection, Confidence & Self-Belief — Stabilise band (1–3) only.

## Why this exists

Every one of the ten life areas needs the same underlying capability: turn a low score into something more useful than a generic tip. Rather than hand-author ten separate systems, we pressure-tested the idea against three deliberately different areas — one that reduces to arithmetic (Money), one that's driven by external situations (Relationships), and one that's internal and self-reported (Confidence) — until a single model held for all three. This document is that model, written down so the remaining seven areas can be authored against it instead of reinvented.

## The governing principle

> Aligned should not rush to explain the user to themselves. It should help the user gather enough information to understand themselves more accurately.

Money proved you shouldn't prescribe before establishing facts. Relationships proved the same score can mean completely different problems. Confidence proved that even the person's own explanation of their problem can be incomplete. Every part of the model below exists to protect this principle.

## The core rule

This is the compressed logic the schema exists to implement — worth reading before anything else:

> **Priority** decides where Aligned focuses. **Band** decides the posture once that area is selected. **Diagnostic** identifies what may be happening. **Evidence** increases or decreases confidence in that interpretation. **Interpretation** determines the next appropriate intervention. **Behaviour and review** update the interpretation.

Note the correction baked into that sentence: it's the *priority score* (importance × distance from full alignment) that decides which area gets attention, not the raw satisfaction score. The raw score only sets the band — the level of support appropriate once an area has already been selected.

## The engine loop

1. **Score** — the client's satisfaction rating for the area, out of 10.
2. **Priority** — `priority_score` decides *which* area becomes the focus.
3. **Band** — the score sorts into one of five severity bands — decides *what kind* of help is appropriate.
4. **Pattern sentence** — a generic, non-judgemental description of what this band+area combination typically feels like. Shown immediately after the Audit, before any diagnosis.
5. **Diagnostic** — a short structured "Reality Check" that starts finding out what's actually going on.
6. **Reported pattern** — what the client says is happening, captured as raw answers. Evidence, not a fact.
7. **Evidence → interpretation** — each answer supports or contradicts one or more candidate interpretations, by weight. The interpretation with the strongest support becomes the client's *working* interpretation, carrying a confidence level (low / medium / high).
8. **Personalised insight** — the working interpretation rendered as client-facing copy, distinct from the generic band pattern sentence. This is where the system demonstrates it learned something specific about this client.
9. **Confirm** — "Does that feel accurate?" (Yes / Partly / No). The answer is itself a new piece of evidence. A "no" doesn't get argued with — it triggers more clarifying questions rather than a recommendation.
10. **Clarifying questions / observation** — a further pass, sometimes immediate, sometimes played out over days, run when confidence is still low or the client pushed back at step 9.
11. **Recommended action** — the specific next thing, chosen by the interpretation rather than the raw score, carrying a routing level and (where relevant) a flag that it involves another person.
12. **Client response** — Accept / Personalise / Choose another / Discuss with coach. Only once accepted (in some form) does it become a **Goal** — a distinct object the client has committed to, not the recommendation itself.
13. **Behaviour** — the client does it.
14. **Review** — what happened, what worked, what didn't.
15. **Update interpretation** — the old working interpretation is marked superseded, not overwritten; a new one takes over as active. The loop continues with a sharper starting point next time.

## Severity bands

| Band | Score range | Posture |
|---|---|---|
| Stabilise | 1–3 | Diagnose before prescribing. Establish facts and context before recommending any change. |
| Establish | 4–5 | Build a basic structure or habit where essentially none exists yet. |
| Improve | 6–7 | Sharpen and add consistency to a foundation that's already there. |
| Optimise | 8–9 | Refine, add nuance, remove friction. |
| Maintain / Expand | 10 | Protect what's working; look outward from this area to others. |

Only the Stabilise band has been designed in depth (via the three worked examples below). The postures for Establish through Maintain/Expand are a working hypothesis and should get the same pressure-testing treatment before content is written for them.

## Evidence-based interpretation, not answer-based branching

The earlier draft of this spec had `diagnostic_outcomes` mapping one answer straight to one action. That works for Money (`shortfall → close-the-gap action`) but breaks down as soon as an outcome depends on several answers together — which the Confidence pressure test proved is the normal case, not the exception. "Low confidence + unfamiliar situation + little experience + confidence improves with preparation" doesn't come from any single answer; it comes from several answers all pointing the same direction.

So the model is: **answers → evidence → interpretation → route**, not answer → route.

- **Reported pattern** — what the client says is happening (their raw answers).
- **Interpretation** — a named entry in the content library describing one possible meaning of a pattern (e.g. `exposure_practice_gap`). Interpretations are content, authored per area and band, the same way actions are.
- **Evidence rule** — a small, explicit weight connecting one answer to one interpretation, as `supports` or `contradicts`. Several rules accumulate into a score per candidate interpretation; the highest-scoring one becomes the client's working interpretation. This needs no inference engine or LLM in V1 — it's arithmetic over authored weights.
- **Confidence** belongs to the *client's specific interpretation instance*, not the library entry. The library says "exposure/practice gap is a possible Confidence interpretation"; the client's record says "for this client, we currently think this is the most likely explanation, with medium confidence." When new evidence contradicts it, the old interpretation is marked **superseded**, not deleted — the system keeps a genuine history of how its read of someone changed, rather than silently overwriting it.

## Confirming the interpretation

Because the working interpretation is explicitly a hypothesis, the client gets asked whether it lands: **Yes, that feels accurate** / **Partly** / **No, that doesn't feel right**. This is itself a structured evidence point, not just a UX nicety — a "no" should route back into clarifying questions rather than being pushed past. This keeps the system honest to its own governing principle: it doesn't get to insist it's right.

## Action types

Not every next step is a checklist. Eight distinct shapes have shown up so far:

| Type | What it asks of the client | Example |
|---|---|---|
| Immediate diagnostic | Answer a short structured question set, once | Money Reality Check |
| Structured reflection | Answer a small set of open reflection questions | Relationship Reality Check |
| Behavioural action | Do one defined thing | Have one intentional conversation |
| Observation task | Notice and log something over a set window | Notice self-doubt triggers for 7 days |
| Repeated practice | Do a small thing several times | Three graduated exposure actions |
| Tracking task | Log a simple measure daily | Record sleep for 7 days |
| Decision task | Choose between named options | Choose your primary financial priority |
| Review | Look back and re-interpret | Review what changed after 30 days |

An observation task needs more structure than the others — it doesn't resolve immediately, and what it resolves *to* depends on what gets logged:

```
duration_days:     7
prompt:            "Notice when self-doubt appears."
capture_fields:    [situation, thought, feeling, behaviour, what_happened_next]
min_observations:  3
completion_rule:   duration elapsed OR minimum observations reached
resolution:        analyse logged observations, assign the next diagnostic branch
```

No new type is needed for actions that involve another person — a coach conversation, contacting a creditor, arranging a health check. Rather than a ninth type, any action can carry `requires_external_person = true`. It stays a behavioural action; the flag is what changes the UX around it.

## Routing and safety

Some interpretations shouldn't lead to an ordinary self-guided next step — an undiagnosed health issue, debt that threatens essentials, or anything that reads as more than reflection-and-behaviour-change territory. Every action carries a `routing_level`, referencing a small content table rather than a hardcoded enum, so the copy and behaviour at each level stay editable:

- `normal` — the default. An ordinary recommended action.
- `support_recommended` — the action itself nudges toward outside help without alarm.
- `professional_support` — the app should be explicit that this is better handled with a professional.
- `urgent_support` — reserved for anything that shouldn't wait on the ordinary loop at all.

This exists so the engine doesn't have to be retrofitted the first time a client's answer clearly falls outside "helping with reflection and behaviour change" and into something Aligned shouldn't pretend to diagnose or treat.

## Worked examples (Stabilise band, condensed)

**Money & Stability — 2/10.** Not measurable by feeling, so it's diagnosed by arithmetic. First action: a 30-Day Money Reality Check — available cash, confirmed 30-day income, essential 30-day outgoings, resulting surplus or shortfall. The result classifies directly (surplus → organise it; small shortfall → close the gap; serious shortfall → protect essentials and create income; debt/arrears → protect essentials first, `routing_level: support_recommended`) — a rare case where the evidence is arithmetic rather than another question.

**Relationships & Connection — 2/10.** Diagnosed by situation. First question sorts into one of several reported patterns (not enough connection, connection without depth, one difficult relationship, withdrawal/avoidance, repeating unhealthy patterns, neglect through lack of time, unclear what's wanted). Each reported pattern gets its own second pass — for "one difficult relationship," that second pass is itself still diagnostic (what's happening, what's needed, has it been communicated, what's being tolerated) before resolving into conversation, boundary, distance, or reconsideration.

**Confidence & Self-Belief — 2/10.** Diagnosed by pattern, but the reported pattern is the client's own theory about themselves and may be incomplete. First question sorts into a reported pattern (general self-doubt, context-dependent, hit by a specific event, imposter feeling, validation-dependent, avoidance, unclear). The context-dependent branch is the one that proved evidence-based resolution is necessary: what actually changes between confident and unconfident situations (experience, preparation, familiarity, who's watching, stakes, expectation of judgement, prior success) accumulates evidence toward `exposure_practice_gap` versus `global_self_belief_deficit` — no single answer decides it.

## Two pattern sentences, not one

The generic **band interpretation** ("Your confidence and self-belief currently feel less secure than you'd like them to be...") is shown immediately after the Audit — it says *we understand the territory*. The **personalised insight**, shown once the diagnostic resolves ("Your confidence appears strongest when you're prepared and experienced, and drops most in unfamiliar or higher-stakes situations...") says *we now understand your particular situation*. That progression matters — it's the moment the system demonstrates it learned something. The two are kept as separate fields (`client_insight` on the generic band pattern, versus an `internal_interpretation` plus rendered client copy on each interpretation) so internal reasoning never accidentally surfaces as clinical-sounding client copy.

## Proposed schema

Follows the existing migration's conventions (`uuid` primary keys via `gen_random_uuid()`, `text` fields with `check (... in (...))` in place of enum types, `timestamptz` audit columns). Split into a **content/library level** — authored once per area/band, the same way `life_areas` already works — and a **client/runtime level**, recording what a specific client actually experienced.

```sql
-- ============================================================================
-- CONTENT / LIBRARY LEVEL — authored per area and band, editable without a
-- redeploy, same spirit as the existing life_areas table.
-- ============================================================================

create table public.bands (
  key           text primary key check (key in ('stabilise','establish','improve','optimise','maintain_expand')),
  label         text not null,
  score_min     int not null,
  score_max     int not null,
  posture       text not null,
  sort_order    int not null
);

-- One row per (life_area, band): the entry diagnostic experience.
create table public.interventions (
  id                 uuid primary key default gen_random_uuid(),
  life_area_id       uuid not null references public.life_areas(id),
  band_key           text not null references public.bands(key),
  intervention_type  text not null default 'diagnostic' check (intervention_type in ('diagnostic','direct')),
  title              text not null,
  purpose            text not null,
  pattern_sentence   text not null,          -- the generic "band interpretation"
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  unique (life_area_id, band_key)
);

create table public.intervention_questions (
  id                     uuid primary key default gen_random_uuid(),
  intervention_id        uuid not null references public.interventions(id) on delete cascade,
  prompt                 text not null,
  answer_type            text not null check (answer_type in ('single_select','multi_select','number','scale','text')),
  depends_on_question_id uuid references public.intervention_questions(id),
  depends_on_option_key  text,
  sort_order             int not null default 0
);

create table public.intervention_question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.intervention_questions(id) on delete cascade,
  option_key    text not null,
  label         text not null,
  sort_order    int not null default 0,
  unique (question_id, option_key)
);

-- Content table for routing copy/behaviour, referenced by actions.routing_key.
create table public.routing_rules (
  key                 text primary key check (key in ('normal','support_recommended','professional_support','urgent_support')),
  label               text not null,
  client_facing_note  text,                  -- extra message shown when this level applies; null for 'normal'
  sort_order          int not null
);

-- The library of possible meanings for a reported pattern. This is the piece
-- that replaces one-answer-to-one-action branching.
create table public.interpretations (
  id                     uuid primary key default gen_random_uuid(),
  life_area_id           uuid not null references public.life_areas(id),
  band_key               text not null references public.bands(key),
  code                   text not null unique,       -- e.g. exposure_practice_gap
  title                  text not null,
  client_insight         text not null,              -- the personalised, client-facing copy
  internal_interpretation text not null,             -- private reasoning, never shown to the client
  default_confidence     text not null default 'low' check (default_confidence in ('low','medium','high')),
  next_action_id         uuid,                       -- fk added below, after actions exists
  next_intervention_id   uuid references public.interventions(id),
  created_at             timestamptz not null default now()
);

create table public.actions (
  id                     uuid primary key default gen_random_uuid(),
  life_area_id           uuid not null references public.life_areas(id),
  action_key             text not null unique,       -- e.g. REL_STAB_002
  action_type            text not null check (action_type in
                            ('immediate_diagnostic','structured_reflection','behavioural',
                             'observation','repeated_practice','tracking','decision','review')),
  title                  text not null,
  purpose                text not null,
  config                 jsonb not null default '{}',
  completion_outcome     text not null,
  requires_external_person boolean not null default false,
  routing_key            text not null default 'normal' references public.routing_rules(key),
  created_at             timestamptz not null default now()
);

alter table public.interpretations
  add constraint interpretations_next_action_fk foreign key (next_action_id) references public.actions(id);

-- Weighted links from one answer to one interpretation. Several rules
-- accumulate into a score per candidate interpretation for a given client;
-- the highest-scoring one becomes their working interpretation. Plain
-- arithmetic over authored weights — no inference engine needed for V1.
create table public.evidence_rules (
  id                  uuid primary key default gen_random_uuid(),
  question_option_id  uuid not null references public.intervention_question_options(id) on delete cascade,
  interpretation_id   uuid not null references public.interpretations(id) on delete cascade,
  effect              text not null check (effect in ('supports','contradicts')),
  weight              int not null default 1
);


-- ============================================================================
-- CLIENT / RUNTIME LEVEL — what a specific client actually experienced.
-- ============================================================================

-- One pass through an intervention. Groups a client's responses together and
-- allows a client to redo a Reality Check later without losing history.
create table public.client_diagnostic_sessions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  clear_plan_id    uuid references public.clear_plans(id),
  intervention_id  uuid not null references public.interventions(id),
  status           text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table public.client_diagnostic_responses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.client_diagnostic_sessions(id) on delete cascade,
  question_id   uuid not null references public.intervention_questions(id),
  option_key    text,
  value         jsonb,                       -- for number/scale/text answers
  created_at    timestamptz not null default now()
);

-- "For this client, we currently think X, with this much confidence."
-- Superseded rather than overwritten, so the history of how the read of
-- someone changed over time is never lost.
create table public.client_interpretations (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.profiles(id) on delete cascade,
  clear_plan_id           uuid references public.clear_plans(id),
  life_area_id            uuid not null references public.life_areas(id),
  interpretation_id       uuid not null references public.interpretations(id),
  confidence_level        text not null default 'low' check (confidence_level in ('low','medium','high')),
  status                  text not null default 'active' check (status in ('active','superseded','resolved')),
  working_hypothesis_text text,              -- optional personalised expansion of interpretations.client_insight
  confirmed               text check (confirmed in ('accurate','partly','not_accurate')),
  superseded_by           uuid references public.client_interpretations(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.client_observations (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid not null references public.profiles(id) on delete cascade,
  client_action_instance_id uuid not null,   -- fk added below, after client_action_instances exists
  occurred_at               timestamptz not null default now(),
  payload                   jsonb not null
);

-- A recommended action, presented to a specific client, and their response
-- to it. Deliberately NOT the same object as a goal — see below.
create table public.client_action_instances (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  clear_plan_id      uuid references public.clear_plans(id),
  action_id          uuid not null references public.actions(id),
  interpretation_id  uuid references public.client_interpretations(id),
  client_response    text not null default 'pending' check (client_response in
                        ('pending','accepted','personalised','chose_another','discuss_with_coach')),
  status             text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz
);

alter table public.client_observations
  add constraint client_observations_instance_fk foreign key (client_action_instance_id)
  references public.client_action_instances(id) on delete cascade;

-- goals — extended, not repurposed. source_action_id records "this goal
-- emerged from this action," not "this action is the goal": a recommended
-- action and a committed goal stay distinct objects, since accepting a
-- recommendation and personalising it into a specific commitment are
-- different steps (e.g. "map your confidence across five situations" →
-- "deliver one presentation each week for four weeks").
alter table public.goals add column source_action_id uuid references public.actions(id);

-- Lightweight review record for the "what happened, what worked" step.
create table public.reviews (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid not null references public.profiles(id) on delete cascade,
  goal_id                   uuid references public.goals(id),
  client_action_instance_id uuid references public.client_action_instances(id),
  went_well                 text,
  got_in_the_way            text,
  review_text               text,
  created_at                timestamptz not null default now()
);
```

## V1 build decisions

**1. Recommended actions are suggestions, never auto-assigned goals.** Aligned says *"based on what you've told us, this looks like the most useful next step"* — the client then Accepts, Personalises, Chooses another, or (where coaching applies) Discusses with coach. A recommended action and a committed goal are different database objects (`actions` / `client_action_instances` vs. `goals`, linked by `goals.source_action_id`), because accepting a recommendation and personalising it into a specific commitment are genuinely different steps.

**2. No content editor for V1.** The first library — three areas, one band — isn't enough to know what an authoring UI actually needs to support. Content ships as seeded database rows for now, reviewed directly and updated as needed. Once roughly ten areas × two or three bands exist, the real authoring patterns will be visible, and an editor becomes worth building.

**3. Two pattern sentences, not a rewritten one.** The generic band-level pattern sentence stays fixed and is shown immediately after the Audit. A separate, personalised insight is shown once the diagnostic resolves — see "Two pattern sentences, not one" above.

**4. Evidence-based resolution, not one-answer branching.** See "Evidence-based interpretation, not answer-based branching" above — this is the schema change from `diagnostic_outcomes` to `interpretations` + `evidence_rules`.

## Area coverage

| Area | Stabilise (1–3) | Establish–Maintain (4–10) |
|---|---|---|
| Money & Stability | Designed | Not yet designed |
| Relationships & Connection | Designed | Not yet designed |
| Confidence & Self-Belief | Designed | Not yet designed |
| Health & Energy | Not yet designed | Not yet designed |
| Mindset & Thinking | Not yet designed | Not yet designed |
| Career/Work & Business | Not yet designed | Not yet designed |
| Purpose & Direction | Not yet designed | Not yet designed |
| Daily Structure & Discipline | Not yet designed | Not yet designed |
| Emotional Wellbeing | Not yet designed | Not yet designed |
| Self-Respect & Identity | Not yet designed | Not yet designed |
