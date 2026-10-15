import Link from "next/link";
import { redirect } from "next/navigation";
import { canBill, getBillingSettings } from "@/lib/actions/billing";
import { requireAdmin } from "@/lib/actions/admin";
import { settingsGaps } from "@/lib/billing-status";
import { SettingsForm } from "./SettingsForm";

// The business details printed on invoices. Nothing here is pre-filled with
// guesses: legal name, address and bank details come only from you.
export default async function BillingSettingsPage() {
  await requireAdmin();
  if (!(await canBill())) redirect("/coach/billing");
  const s = await getBillingSettings();
  const gaps = settingsGaps(s);
  return (
    <div className="page admin-page">
      <Link href="/coach/billing" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>← Invoices</Link>
      <div className="eyebrow"><span className="eydot" /> Billing settings</div>
      <h1>What goes on your invoices</h1>
      <p className="lead">
        Changes apply to invoices issued from now on. Ones already issued keep the details they were issued with.
      </p>
      {gaps.length ? <p className="bl-warn">Still needed before the first invoice can be issued: {gaps.join(", ")}.</p> : null}
      {s ? <SettingsForm s={s} /> : <p className="plan-note">Billing settings need database update 0014.</p>}
    </div>
  );
}
