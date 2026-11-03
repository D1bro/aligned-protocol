import Link from "next/link";
import { getJournal } from "@/lib/actions/journal";
import { Icon } from "@/components/ui/Icon";

const day = (ymd: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${ymd}T12:00:00Z`));

// Quick access to the one journal (the same entries as /journal), with the
// opening of the latest entry. Private: only the writer sees My Space.
export async function JournalCard() {
  const { entries } = await getJournal(1).catch(() => ({ entries: [] }));
  const latest = entries[0] ?? null;
  const opening = latest?.body.trim().split("\n")[0] ?? "";
  return (
    <section className="pf-tile ms-card" aria-labelledby="ms-journal-h">
      <div className="ms-head">
        <Icon name="pen" size={18} />
        <h2 id="ms-journal-h">My Journal</h2>
      </div>
      {latest ? (
        <>
          <p className="profile-card-k">Latest entry · {day(latest.entry_date)}</p>
          <p className="ms-journal-line">{opening.length > 140 ? `${opening.slice(0, 140).trimEnd()}…` : opening}</p>
        </>
      ) : (
        <p className="pf-sub">Write freely, or use a prompt if you&rsquo;d like one. Only you can read it.</p>
      )}
      <Link href="/journal" className="btn btn-g">{latest ? "Open my journal →" : "Write my first entry →"}</Link>
    </section>
  );
}
