import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LoginForms } from "./LoginForms";

export const metadata = { title: "Sign in", robots: { index: false, follow: true } };

// A guest arriving from their results: has the audit finished, and has their
// starting point actually been saved? (Only then does the page say "saved".)
async function guestWork(): Promise<{ hasSnapshot: boolean; startingPointSaved: boolean }> {
  const none = { hasSnapshot: false, startingPointSaved: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.is_anonymous) return none;
  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("client_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audit) return none;
  const { data: plan } = await supabase.from("clear_plans").select("id").eq("audit_id", audit.id).maybeSingle();
  return { hasSnapshot: true, startingPointSaved: !!plan };
}

export default async function LoginPage() {
  const work = await guestWork();
  return (
    <div className="center-page auth-bg">
      <Suspense fallback={null}>
        <LoginForms hasSnapshot={work.hasSnapshot} startingPointSaved={work.startingPointSaved} />
      </Suspense>
    </div>
  );
}
