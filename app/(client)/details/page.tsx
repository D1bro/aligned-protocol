import type { Metadata } from "next";
import Link from "next/link";
import { getMyDetails } from "@/lib/actions/details";
import { SITE } from "@/lib/site-copy";
import { DetailsForm } from "./DetailsForm";

export const metadata: Metadata = { title: "Your details" };

// Optional contact, location and billing details, editable any time.
// Never required to take the audit, build a plan or use coaching.
export default async function DetailsPage() {
  const d = await getMyDetails();
  const zones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="page au-page details-page">
      <Link href="/" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>← My profile</Link>
      <div className="eyebrow"><span className="eydot" /> Your details</div>
      <h1 className="au-latest-h">Your <em>details</em></h1>
      <p className="lead">
        Everything here is optional apart from your name. Add what&rsquo;s useful, change or clear it whenever you like.
      </p>

      {d.available ? (
        <DetailsForm
          initial={{
            fullName: d.full_name ?? "",
            preferredName: d.preferred_name ?? "",
            phone: d.phone ?? "",
            town: d.town ?? "",
            country: d.country ?? "",
            timezone: d.timezone ?? "",
            billingName: d.billing_name ?? "",
            billingAddress: d.billing_address ?? "",
          }}
          email={d.email}
          hasCoach={d.hasCoach}
          zones={zones}
          contactEmail={SITE.contactEmail}
        />
      ) : (
        <p className="clear-err">This page isn&rsquo;t switched on yet (it needs database update 0016).</p>
      )}
    </div>
  );
}
