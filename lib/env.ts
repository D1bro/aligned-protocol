// Fail fast and clearly if the app is misconfigured — but lazily. These used
// to throw the moment this file was imported, which broke `next build`
// itself: Next statically imports every route module during its "collecting
// page data" step, so an eager throw here failed the whole build before a
// single page ever rendered, even on routes that don't need these values yet.
// Getters mean the check only runs when a value is actually *read*, which
// happens at request time inside createClient(), not at import time.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in .env.local for local dev, ` +
        `and in your Vercel project's Settings -> Environment Variables for deployments.`
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
};

// Only read on the server, only where actually needed (see lib/supabase/admin.ts).
// Never imported by any file that ships to the browser.
export function requireServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
