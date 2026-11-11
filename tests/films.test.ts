// Console → Films: links as pasted (Duane, 11 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FILM_SLOTS, filmSource, linkProblem } from "../lib/films.ts";

test("a pasted link plays in the right player", () => {
  const yt = { kind: "embed", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" };
  assert.deepEqual(filmSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s"), yt);
  assert.deepEqual(filmSource("https://youtu.be/dQw4w9WgXcQ?si=abc"), yt);
  assert.deepEqual(filmSource("https://youtube.com/shorts/dQw4w9WgXcQ"), yt);
  assert.deepEqual(filmSource("https://vimeo.com/123456789"), { kind: "embed", src: "https://player.vimeo.com/video/123456789" });
  assert.deepEqual(filmSource("https://vimeo.com/123456789/abcdef1234"), { kind: "embed", src: "https://player.vimeo.com/video/123456789?h=abcdef1234" });
  assert.deepEqual(filmSource("https://www.loom.com/share/0123456789abcdef0123456789abcdef"), { kind: "embed", src: "https://www.loom.com/embed/0123456789abcdef0123456789abcdef" });
  assert.deepEqual(filmSource("https://files.example.com/intention.mp3"), { kind: "file", src: "https://files.example.com/intention.mp3" });
  assert.equal(filmSource("http://example.com/film.mp4"), null);
  assert.equal(filmSource("youtube.com/watch?v=x"), null);
  assert.equal(filmSource(""), null);
  assert.equal(filmSource(null), null);
});

test("what's wrong with a link, in plain words", () => {
  assert.equal(linkProblem("", "film"), null);
  assert.equal(linkProblem("https://youtu.be/dQw4w9WgXcQ", "film"), null);
  assert.match(linkProblem("not a link", "film")!, /https:/);
  assert.match(linkProblem("https://youtu.be/dQw4w9WgXcQ", "audio")!, /mp3/);
  assert.equal(linkProblem("https://files.example.com/a.mp3", "audio"), null);
});

test("every slot has its own id", () => {
  const ids = FILM_SLOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[A-Za-z0-9-]{2,40}$/.test(id)));
});
