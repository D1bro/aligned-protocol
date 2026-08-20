import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "client" | "coach" | "admin";
  coach_id: string | null;
  isAnonymous: boolean;
};

// Small helper every protected Server Component reaches for: who is this,
// and what's their profile row. middleware.ts already guarantees a logged-out
// visitor never reaches here for a protected route.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, coach_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { ...(profile as Omit<Profile, "isAnonymous">), isAnonymous: user.is_anonymous ?? false };
}
