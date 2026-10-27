# Replacing or adding films

Every film position is listed in one file: `lib/audit-guides.ts`. The codes are for production only; visitors never see them.

| Code | Where it appears | In the code |
|---|---|---|
| F01 | Homepage, About Duane section | `FILMS.F01` |
| A00 | Audit welcome page | `INTRO_GUIDE` |
| A01–A10 | Each audit question | `AREA_GUIDES[1]` … `AREA_GUIDES[10]` |
| F02 | Results page, next to the starting point | `CLOSING_GUIDE` (also `FILMS.F02`) |
| F03 | Worked demonstration (not placed yet) | `FILMS.F03` |
| F04–F05 | Profile and check-in guidance (not placed yet) | `FILMS.F04`, `FILMS.F05` |
| L01–L04 | Academy lessons, once published | `FILMS.L01` … `FILMS.L04` |
| M01–M02 | Musings, once published | `FILMS.M01`, `FILMS.M02` |
| P01–P05 | Build your plan, one per step (in the step, under the question) | `PLAN_FILMS.P01` … `PLAN_FILMS.P05` |
| P06 | Your plan is set (what happens next) | `PLAN_FILMS.P06` |
| C01 | Coaching page (what coaching with an Aligned Coach is like) | `FILMS.C01` |
| O01 | Offers page (Practice, Momentum and Focus explained) | `FILMS.O01` |
| D01 | Audio: the daily intention (Daily Alignment, morning) | `AUDIO.D01` |
| D02 | Audio: the evening reflection (Daily Alignment, evening) | `AUDIO.D02` |

Until a film exists, its page shows a short text fallback instead of a player. Nothing autoplays, players always have controls, and captions are a separate English track.

## For each film you need three files

Use the same base name for all three, ending in a version, e.g. `f01-welcome-v1`:

1. **The video:** `f01-welcome-v1.mp4`. Upload it to the Supabase Storage bucket `audit-media` (the folder in `NEXT_PUBLIC_AUDIT_VIDEO_BASE_URL`).
2. **The poster** (the still shown before play): `f01-welcome-v1.jpg`. Put it in `public/media/audit/posters/`.
3. **The captions:** `f01-welcome-v1.vtt`. Put it in `public/media/audit/captions/`.

## Switching a new position on (F01, F03–F05, L, M, P, C, O)

In `lib/audit-guides.ts`, find the line in `FILMS` and set the file name (without the version) and the version:

```ts
F01: film({ file: "f01-welcome", version: "v1", title: "Welcome from Duane", label: "A welcome from Duane", durationSeconds: 95 }),
```

Commit, open a pull request, check the preview, then merge.

## Recording list

What still needs recording, with the question each one answers. Every slot already shows "Video coming soon" or "Audio coming soon" in place, so the site works before they exist.

| Code | Film or audio | What it should cover |
|---|---|---|
| F01 | Film | A welcome from Duane: who he is and what Aligned is for |
| P01 | Film | Your starting point: why one area, and what one honest step up means |
| P02 | Film | What better looks like, and why the reason matters on a hard week |
| P03 | Film | What gets in the way, without needing to explain it |
| P04 | Film | Turning an idea into one clear action: specific, scheduled, small enough |
| P05 | Film | How you'll know it's helping, and the weekly review |
| P06 | Film | Your plan is set: what happens next, and making it smaller if needed |
| F05 | Film | How the weekly and monthly reviews work |
| C01 | Film | Coaching with an Aligned Coach: what it is, and what it isn't |
| O01 | Film | Practice, Momentum and Focus: who each one is for |
| D01 | Audio, a few minutes | The daily intention: arrive, breathe, choose what matters today |
| D02 | Audio, a few minutes | The evening reflection: noticing the day without grading it |

## Audio (D01, D02)

One file each, an MP3: for example `d01-intention-v1.mp3`. Upload it to the same Supabase Storage bucket as the films, then set `file` (and `version`) on the line in `AUDIO` in `lib/audit-guides.ts`:

```ts
D01: audio({ file: "d01-intention", version: "v1", title: "Your daily intention", label: "Daily intention · a few minutes with Duane" }),
```

## Replacing an existing audit film (A00–A10, F02)

Upload the new files with the next version number (for example `-v8` instead of `-v7`), then change `MEDIA_VERSION` in `lib/audit-guides.ts` to match. The new version number stops browsers showing a cached older film.
