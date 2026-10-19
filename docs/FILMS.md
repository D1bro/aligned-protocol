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

Until a film exists, its page shows a short text fallback instead of a player. Nothing autoplays, players always have controls, and captions are a separate English track.

## For each film you need three files

Use the same base name for all three, ending in a version, e.g. `f01-welcome-v1`:

1. **The video:** `f01-welcome-v1.mp4`. Upload it to the Supabase Storage bucket `audit-media` (the folder in `NEXT_PUBLIC_AUDIT_VIDEO_BASE_URL`).
2. **The poster** (the still shown before play): `f01-welcome-v1.jpg`. Put it in `public/media/audit/posters/`.
3. **The captions:** `f01-welcome-v1.vtt`. Put it in `public/media/audit/captions/`.

## Switching a new position on (F01, F03–F05, L, M)

In `lib/audit-guides.ts`, find the line in `FILMS` and set the file name (without the version) and the version:

```ts
F01: film({ file: "f01-welcome", version: "v1", title: "Welcome from Duane", label: "A welcome from Duane", durationSeconds: 95 }),
```

Commit, open a pull request, check the preview, then merge.

## Replacing an existing audit film (A00–A10, F02)

Upload the new files with the next version number (for example `-v8` instead of `-v7`), then change `MEDIA_VERSION` in `lib/audit-guides.ts` to match. The new version number stops browsers showing a cached older film.
