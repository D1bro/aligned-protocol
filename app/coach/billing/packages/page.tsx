import Link from "next/link";
import { redirect } from "next/navigation";
import { canBill } from "@/lib/actions/billing";
import { requireAdmin } from "@/lib/actions/admin";
import { getAllPackages } from "@/lib/actions/packages";
import { getMyClients } from "@/lib/actions/coach";
import { PackagesEditor } from "./PackagesEditor";

// Session packages and deals: what clients can buy, at what price, how many
// sessions, how long they last, and who sees each one.
export default async function PackagesPage() {
  await requireAdmin();
  if (!(await canBill())) redirect("/coach/billing");
  const [packages, clients] = await Promise.all([getAllPackages(), getMyClients()]);
  return (
    <div className="page admin-page">
      <Link href="/coach/billing" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>← Invoices</Link>
      <div className="eyebrow"><span className="eydot" /> Billing · Packages</div>
      <h1>Packages and deals</h1>
      <p className="lead">
        What clients can buy in their Coaching page. Buying issues them an invoice, paid by card or bank transfer; the sessions are
        added once it&rsquo;s paid in full. Price changes apply to new purchases only.
      </p>
      {packages ? (
        <PackagesEditor packages={packages} clients={clients.map((c) => ({ id: c.id, name: c.full_name || c.email || "Client" }))} />
      ) : (
        <p className="plan-note">Packages need database update 0018 (supabase/migrations/0018_packages.sql).</p>
      )}
    </div>
  );
}
