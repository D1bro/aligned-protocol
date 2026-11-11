import { requireAdmin } from "@/lib/actions/admin";
import { getFilmLinks } from "@/lib/film-links";
import { FILM_SLOTS } from "@/lib/films";
import { FilmsEditor } from "./FilmsEditor";

export const dynamic = "force-dynamic";

// Console → Films (Duane, 11 Nov 2026): paste a link for each film and audio
// slot. A slot without a link shows nothing on the site.
export default async function FilmsPage() {
  await requireAdmin();
  const links = await getFilmLinks();
  const groups = [...new Set(FILM_SLOTS.map((s) => s.group))];
  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Films</div>
      <h1>Films and audio</h1>
      <p className="lead">
        Paste a link for each one once it&rsquo;s recorded. YouTube (unlisted is fine), Vimeo and Loom links play in their own player; for
        audio, link to the .mp3 file. Until a slot has a link, the page shows nothing in its place.
      </p>
      {groups.map((g) => (
        <section key={g} aria-labelledby={`films-${g}`}>
          <h2 className="sec-head" id={`films-${g}`}>{g}</h2>
          <FilmsEditor slots={FILM_SLOTS.filter((s) => s.group === g)} links={links} />
        </section>
      ))}
    </div>
  );
}
