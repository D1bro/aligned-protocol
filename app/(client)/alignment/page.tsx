import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/session";
import { AlignmentLive } from "@/components/alignment/AlignmentLive";
import { createClient } from "@/lib/supabase/server";
import { canUseDailyAlignment } from "@/lib/alignment";
import { getMyAccess, joiningOpen } from "@/lib/actions/membership";
import { PracticeNav } from "@/components/membership/PracticeNav";
import { JoinPractice } from "@/components/membership/JoinPractice";

export const metadata: Metadata = { title: "Daily practice", robots: { index: false, follow: false } };

export default async function AlignmentPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.isAnonymous) redirect("/login");
  const access = await getMyAccess();
  if (!canUseDailyAlignment(profile.role, access.tier)) {
    return (
      <div className="page au-page">
        <PracticeNav on="daily" />
        <JoinPractice open={await joiningOpen()} what="The daily intention and reflection" />
      </div>
    );
  }
  // The details migration may not yet be present. Read this optional column
  // separately so older profiles still have a clear device/UTC fallback.
  const supabase = await createClient();
  const { data: details, error } = await supabase.from("profiles").select("timezone").eq("id", profile.id).maybeSingle();
  if (error && error.code !== "42703" && error.code !== "PGRST204") {
    throw new Error("Your time zone couldn’t be loaded. Please try again.");
  }
  const initialTimezone = typeof details?.timezone === "string" ? details.timezone : undefined;
  const query = await searchParams;
  const initialView = query.view === "week" || query.view === "privacy" ? query.view : "today";
  // The workspace draws its own tabs, Journal among them.
  return <AlignmentLive initialDate={query.date} initialTimezone={initialTimezone} initialView={initialView} />;
}
