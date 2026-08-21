# Aligned Diagnostic Engine — Content & Schema Spec

Status: design accepted, schema not yet implemented.
Areas pressure-tested so far: Money & Stability, Relationships & Connection, Confidence & Self-Belief — Stabilise band (1–3) only.

## Why this exists

Every one of the ten life areas needs the same underlying capability: turn a low score into something more useful than a generic tip. Rather than hand-author ten separate systems, we pressure-tested the idea against three deliberately different areas — one that reduces to arithmetic (Money), one that's driven by external situations (Relationships), and one that's internal and self-reported (Confidence) — until a single model held for all three. This document is that model, written down so the remaining seven areas can be authored against it instead of reinvented.

## The governing principle

> Aligned should not rush to explain the user to themselves. It should help the user gather enough information to understand themselves more accurately.

Money proved you shouldn't prescribe before establishing facts. Relationships proved the same score can mean completely different problems. Confidence proved that even the person's own explanation of their problem can be incomplete. Every part of the model below exists to protect this principle.

## The engine loop

1. **Score** — the client's satisfaction rating for the area, out of 10.
2. **Priority** — `priority_score` (importance × distance from full alignment) decides *which* area becomes their focus.
3. **Band** — the score sorts into one of five severity bands, which decides *what kind* of help is appropriate.
4. **Pattern sentence** — a non-judgemental, non-assuming description of what that band+area combination typically feels like.
5. **Diagnostic** — a short structured experience (the "Reality Check") that starts finding out what's actually going on.
6. **Reported pattern** — what the client says is happening. Treated as a hypothesis, not a fact.
7. **Clarifying questions / observation** — a second pass, sometimes immediate, sometimes played out over days, that tests the reported pattern rather than accepting it.
8. **Working interpretation** — Aligned's current best read, carrying a confidence level, not a verdict.
9. **Appropriate action** — the specific next thing, chosen by the interpretation rather than the raw score.
10. **Behaviour** — the client actually does it.
11. **Review** — what happened, what worked, what didn't.
12. **Update interpretation** — the working interpretation gets sharper for next time, and the loop continues.

## Severity bands

| Band | Score range | Posture |
|---|---|---|
| Stabilise | 1–3 | Diagnose before prescribing. Establish facts and context before recommending any change. |
| Establish | 4–5 | Build a basic structure or habit where essentially none exists yet. |
| Improve | 6–7 | Sharpen and add consistency to a foundation that's already there. |
| Optimise | 8–9 | Refine, add nuance, remove friction. |
| Maintain / Expand | 10 | Protect what's working; look outward from this area to others. |

Only the Stabilise band has been designed in depth (via the three worked examples below). The postures for Establish through Maintain/Expand are a working hypothesis and should get the same pressure-testing treatment before content is written for them.

## The four-part interpretation model

This is the single most important discovery from the Confidence pressure test: a client's own explanation of their problem is data, not a diagnosis.

- **Reported pattern** — what the client says is happening (their answer to the first diagnostic question).
- **Working hypothesis** — what Aligned provisionally thinks may be causing it. Never shown to the client as settled fact.
- **Observed evidence** — what later questions, or logged behaviour over time, actually support or contradict the hypothesis.
- **Intervention route** — what Aligned recommends next, given all three of the above.

Alongside this, every working interpretation carries a **diagnostic certainty** — low, medium, or high. A single multiple-choice answer produces a low-certainty hypothesis. An observation task that plays out over several days can raise it to high. This doesn't need to be shown to the client as a number, but the system must never treat one answer as a permanent classification of who they are.

## Two-layer branching

- **Layer 1 — initial classification.** The Audit score sets the band; the Reality Check's first question sorts the client into a broad category (e.g. "context-dependent confidence").
- **Layer 2 — cause clarification.** A further question, or an observation task, tests that category and produces something specific and actionable (e.g. "confidence holds up when prepared and experienced, drops in unfamiliar situations — likely an exposure/practice gap, not a general self-belief problem").

Only after Layer 2 resolves does Aligned prescribe an action. Some Layer 2 outcomes are themselves still diagnostic rather than behavioural — the model has to allow a "next step" to be another diagnostic, not assume everything resolves in one hop.

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

## Worked examples (Stabilise band, condensed)

**Money & Stability — 2/10.** Not measurable by feeling, so it's diagnosed by arithmetic. First action: a 30-Day Money Reality Check — available cash, confirmed 30-day income, essential 30-day outgoings, resulting surplus or shortfall. The result classifies directly (surplus → organise it; small shortfall → close the gap; serious shortfall → protect essentials and create income; debt/arrears → protect essentials first) — a rare case where Layer 2 is arithmetic rather than another question.

**Relationships & Connection — 2/10.** Diagnosed by situation. First question sorts into one of several reported patterns (not enough connection, connection without depth, one difficult relationship, withdrawal/avoidance, repeating unhealthy patterns, neglect through lack of time, unclear what's wanted). Each reported pattern gets its own Layer 2 — for "one difficult relationship," Layer 2 is itself still diagnostic (what's happening, what's needed, has it been communicated, what's being tolerated) before resolving into conversation, boundary, distance, or reconsideration.

**Confidence & Self-Belief — 2/10.** Diagnosed by pattern, but the reported pattern is the client's own theory about themselves and may be incomplete. First question sorts into a reported pattern (general self-doubt, context-dependent, hit by a specific event, imposter feeling, validation-dependent, avoidance, unclear). The context-dependent branch is the important one: Layer 2 asks what actually changes between confident and unconfident situations (experience, preparation, familiarity, who's watching, stakes, expectation of judgement, prior success) — which can separate a genuine self-belief problem from an exposure-and-practice gap wearing the same 2/10.

## Proposed schema

Follows the existing migration's conventions (`uuid` primary keys via `gen_random_uuid()`, `text` fields with `check (... in (...))` in place of enum types, `timestamptz` audit columns).

```sql
-- ----------------------------------------------------------------------------
-- bands — content table, same spirit as life_areas: editable without a
-- redeploy. Score ranges are fixed (1-3/4-5/6-7/8-9/10) but the label and
-- description text are content, not code.
-- ----------------------------------------------------------------------------
create table public.bands (
  key           text primary key check (key in ('stabilise','establish','improve','optimise','maintain_expand')),
  label         text not null,
  score_min     int not null,
  score_max     int not null,
  posture       text not null,
  sort_order    int not null
);

-- ----------------------------------------------------------------------------
-- interventions — one row per (life_area, band): the entry diagnostic
-- experience for that combination. "direct" type interventions (used at
-- higher bands where no diagnosis is needed) may have no questions at all.
-- ----------------------------------------------------------------------------
create table public.interventions (
  id                 uuid primary key default gen_random_uuid(),
  life_area_id       uuid not null references public.life_areas(id),
  band_key           text not null references public.bands(key),
  intervention_type  text not null default 'diagnostic' check (intervention_type in ('diagnostic','direct')),
  title              text not null,
  purpose            text not null,
  pattern_sentence   text not null,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  unique (life_area_id, band_key)
);

-- ----------------------------------------------------------------------------
-- intervention_questions — ordered questions belonging to an intervention.
-- depends_on_* supports "this question only appears after that answer",
-- i.e. Layer 2 questions that only show up for one reported pattern.
-- ----------------------------------------------------------------------------
create table public.intervention_questions (
  id                    uuid primary key default gen_random_uuid(),
  intervention_id       uuid not null references public.interventions(id) on delete cascade,
  prompt                text not null,
  answer_type           text not null check (answer_type in ('single_select','multi_select','number','scale','text')),
  depends_on_question_id uuid references public.intervention_questions(id),
  depends_on_option_key  text,
  sort_order            int not null default 0
);

create table public.intervention_question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.intervention_questions(id) on delete cascade,
  option_key    text not null,
  label         text not null,
  sort_order    int not null default 0,
  unique (question_id, option_key)
);

-- ----------------------------------------------------------------------------
-- actions — the recommend-next content. `config` is jsonb because its shape
-- depends on action_type (a checklist for behavioural, duration/capture
-- fields for observation, etc. — see "Action types" above).
-- ----------------------------------------------------------------------------
create table public.actions (
  id                     uuid primary key default gen_random_uuid(),
  life_area_id           uuid not null references public.life_areas(id),
  action_key             text not null unique,          -- e.g. REL_STAB_002
  action_type            text not null check (action_type in
                            ('immediate_diagnostic','structured_reflection','behavioural',
                             'observation','repeated_practice','tracking','decision','review')),
  title                  text not null,
  purpose                text not null,
  config                 jsonb not null default '{}',
  completion_outcome     text not null,
  created_at             timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- diagnostic_outcomes — maps one answer (on one question) to what happens
-- next. resolves_to is polymorphic on purpose: either another intervention
-- (the branch is itself still diagnostic — see the Relationships "one
-- difficult relationship" case) or an action (the branch is ready to act).
-- ----------------------------------------------------------------------------
create table public.diagnostic_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  question_id           uuid not null references public.intervention_questions(id) on delete cascade,
  option_key            text not null,
  outcome_key           text not null,                  -- e.g. context_dependent_confidence
  resolves_to_intervention_id uuid references public.interventions(id),
  resolves_to_action_id       uuid references public.actions(id),
  check (
    (resolves_to_intervention_id is not null and resolves_to_action_id is null) or
    (resolves_to_intervention_id is null and resolves_to_action_id is not null)
  )
);

-- ----------------------------------------------------------------------------
-- client_diagnostic_responses — what a specific client actually answered.
-- Ties back to the clear_plan so both the client's own view and the coach
-- portal can show not just the resulting action but what led to it.
-- ----------------------------------------------------------------------------
create table public.client_diagnostic_responses (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  clear_plan_id    uuid references public.clear_plans(id),
  intervention_id  uuid not null references public.interventions(id),
  question_id      uuid not null references public.intervention_questions(id),
  option_key       text,
  value            jsonb,                                -- for number/scale/text answers
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- client_observations — one row per logged occurrence for an observation
-- task (see "Action types"). payload shape matches the action's
-- config.capture_fields.
-- ----------------------------------------------------------------------------
create table public.client_observations (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  action_id     uuid not null references public.actions(id),
  occurred_at   timestamptz not null default now(),
  payload       jsonb not null
);

-- ----------------------------------------------------------------------------
-- client_action_progress — the client's live instance of a resolved action,
-- carrying the working interpretation and its confidence level so the
-- system (and the coach) can see the reasoning, not just the conclusion.
-- ----------------------------------------------------------------------------
create table public.client_action_progress (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.profiles(id) on delete cascade,
  action_id             uuid not null references public.actions(id),
  working_hypothesis    text,
  pattern_confidence    text not null default 'low' check (pattern_confidence in ('low','medium','high')),
  status                text not null default 'active' check (status in ('active','completed','abandoned')),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz
);

-- ----------------------------------------------------------------------------
-- goals — extended, not replaced. The resolved action seeds the default
-- title/text; the existing free-text fields stay so the client or coach can
-- personalise or fully override it. The engine suggests, it doesn't dictate.
-- ----------------------------------------------------------------------------
alter table public.goals add column resolved_action_id uuid references public.actions(id);
```

## Open decisions before implementation

1. **Suggestion vs. auto-assign.** When a diagnostic resolves to an action, does it become the client's goal automatically, or does it show as a suggestion the client (or Duane, reviewing as coach) can accept, edit, or replace? Leaning toward suggestion-with-override, since the CLEAR wizard's whole premise is the client arriving at their own goal — but this is a product call, not an engineering one.
2. **Content authoring for v1.** Hand-author rows directly for the three designed areas (via SQL or the Supabase table editor) to get something live quickly, or build a small content-editor UI first? Hand-authoring is faster to ship but harder to review; a UI is the right long-term answer but is itself a build.
3. **How dynamic is the pattern sentence?** Fixed per band right now. Once Layer 2 resolves, should the client-facing copy update to reflect the specific finding (e.g. "likely an exposure gap, not a confidence problem") rather than staying generic? That reuses `working_hypothesis` as display copy, not just internal state.

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
