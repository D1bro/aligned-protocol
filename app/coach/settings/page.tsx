import { getTeam } from "@/lib/actions/team";
import { TeamEditor } from "./TeamEditor";

// Console settings: who is on the team and what they can do.
export default async function SettingsPage() {
  const team = await getTeam();
  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Settings</div>
      <h1>Team and access</h1>
      <p className="lead">
        Coaches see the console and their own clients. Admins see every client, the numbers and site settings. Billing access
        (invoices, payments and packages) is given separately, to admins only.
      </p>
      <TeamEditor meId={team.meId} canBill={team.canBill} members={team.members} />
    </div>
  );
}
