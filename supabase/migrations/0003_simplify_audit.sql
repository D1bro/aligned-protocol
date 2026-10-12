-- 0003_simplify_audit.sql
-- The audit now asks one honest 1–10 score per area (plus optional notes),
-- matching the training video. The separate 1–5 importance score is no
-- longer asked, so it becomes optional. Existing answers keep their
-- importance scores; priority_score is simply null for new answers.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the matching app
-- change — until it runs, saving an answer without an importance score fails.
-- (0002 is reserved for the parked diagnostic-engine draft.)

alter table public.audit_responses alter column importance_score drop not null;

-- Shorter area explanations, written to sit beside the per-area video guide.
update public.life_areas set description = 'Your sleep, movement, nutrition, energy levels and overall wellbeing. How well are you looking after your body?' where name = 'Health & Energy';
update public.life_areas set description = 'Your thought patterns, beliefs and self-talk. Notice how your thinking supports you, and where it holds you back.' where name = 'Mindset & Thinking';
update public.life_areas set description = 'How you feel about yourself and your ability to go after what you want. Think about speaking up, being seen and taking the next step.' where name = 'Confidence & Self-Belief';
update public.life_areas set description = 'Your personal, intimate, family and professional relationships. Consider support, honesty, communication and your boundaries.' where name = 'Relationships & Connection';
update public.life_areas set description = 'Your direction, contribution, ambitions and progress. Think about where your working life is taking you.' where name = 'Career, Work & Business';
update public.life_areas set description = 'Your income, spending, saving, debt and future plans. Consider how clear and stable this area feels.' where name = 'Money & Stability';
update public.life_areas set description = 'What matters to you, what gives your life meaning, and whether your direction reflects your values.' where name = 'Purpose & Direction';
update public.life_areas set description = 'Your routines, planning, focus and follow-through. Think about the space you make for what matters.' where name = 'Daily Structure & Discipline';
update public.life_areas set description = 'How you recognise, name and process what you feel. Be honest about how you respond to stress and difficult emotions.' where name = 'Emotional Wellbeing';
update public.life_areas set description = 'Your standards, boundaries, choices and the promises you keep to yourself. Consider what your everyday actions say about who you are.' where name = 'Self-Respect & Identity';
