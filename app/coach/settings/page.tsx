import Link from "next/link";
import { getTeam } from "@/lib/actions/team";
import { getAllMemberships, getMomentumDetails } from "@/lib/actions/membership";
import { createClient } from "@/lib/supabase/server";
import { offerFor } from "@/lib/offers";
import { statusWords } from "@/lib/membership";
import { formatDate } from "@/lib/audit-schedule";
import { TeamEditor } from "./TeamEditor";
import { MomentumSettings } from "./MomentumSettings";

// Console settings: who is on the team and what they can do; the Momentum
// session; and who has a membership.
export default async function SettingsPage() {
  const [team, momentum, memberships] = await Promise.all([getTeam(), getMomentumDetails(), getAllMemberships()]);
  const supabase = await createClient();
  const { data: people } = memberships.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", [...new Set(memberships.map((m) => m.client_id))])
    : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email || "A member"]));
  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Settings</div>
      <h1>Team and access</h1>
      <p className="lead">
        Coaches see the console and their own clients. Admins see every client, the numbers and site settings. Billing access
        (invoices, payments and packages) is given separately, to admins only.
      </p>
      <TeamEditor meId={team.meId} canBill={team.canBill} members={team.members} />

      <h2 className="sec-head">Aligned Momentum session</h2>
      <p className="admin-card-sub">What Momentum members see for their weekly live hour.</p>
      <MomentumSettings initial={momentum} />

      <h2 className="sec-head">Memberships</h2>
      {memberships.length ? (
        <ul className="admin-list">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/coach/clients/${m.client_id}`}>{nameOf.get(m.client_id) ?? "A member"}</Link>
              <span className="admin-card-sub">
                {" "}· {offerFor(m.tier).name} · £{(m.price_pence / 100).toFixed(m.price_pence % 100 ? 2 : 0)} a month · {statusWords(m.status, m.cancel_at_period_end)} · since {formatDate(m.started_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-card-sub">No memberships yet. Members join from the offers page once joining is switched on.</p>
      )}
    </div>
  );
}
