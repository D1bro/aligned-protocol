import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoachBasics } from "@/lib/actions/staff-profiles";

export const metadata: Metadata = { title: "Coach profile" };

// An admin's view of a coach's basics (Settings → Team). Their private
// approach, learning areas and client notes are never shown here.
export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getCoachBasics(id);
  if (!b.fullName && !b.email) notFound();
  return (
    <div className="page admin-page cpf-page">
      <Link href="/coach/settings" className="au-text-link">← Team and access</Link>
      <div className="eyebrow"><span className="eydot" /> Coach profile</div>
      <div className="cpf-photo">
        {b.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the coach's own uploaded photo
          <img src={b.photoUrl} alt="" />
        ) : (
          <span className="cpf-photo-empty" aria-hidden="true">{b.fullName.trim().charAt(0).toUpperCase() || "?"}</span>
        )}
        <h1>{b.fullName || "No name yet"}</h1>
      </div>
      <section className="admin-card">
        <dl className="cpf-facts">
          <div><dt>Email</dt><dd>{b.email ?? "—"}</dd></div>
          <div><dt>Phone</dt><dd>{b.phone ? <a href={`tel:${b.phone.replace(/[^+\d]/g, "")}`}>{b.phone}</a> : "—"}</dd></div>
          <div><dt>Time zone</dt><dd>{b.timezone || "—"}</dd></div>
          <div><dt>Usual meeting link</dt><dd>{b.meetingLink || "—"}</dd></div>
          <div><dt>Usual session length</dt><dd>{b.defaultMinutes} minutes</dd></div>
        </dl>
      </section>
      <section className="admin-card">
        <h2>Bio</h2>
        <p className="cpf-pre">{b.bio || "Not written yet."}</p>
        <h2>Credentials</h2>
        <p className="cpf-pre">{b.credentials || "Not added yet."}</p>
      </section>
      <p className="admin-hint">Their coaching approach, learning areas and notes about clients are private to them and aren&rsquo;t shown here.</p>
    </div>
  );
}
