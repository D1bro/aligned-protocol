// Which Stripe mode the site is in, decided from the key and two settings.
// Kept free of server-only imports so it can be tested directly.
//
//   live key  -> only with STRIPE_ALLOW_LIVE=true (a deliberate switch)
//   test key  -> anywhere except the live site (VERCEL_ENV=production), so a
//                client can never "pay" a real invoice with a test card
//   anything else -> off

export type StripeMode = { ready: true; live: boolean } | { ready: false; reason: string };

export function stripeMode(key: string, opts: { allowLive: boolean; production: boolean }): StripeMode {
  if (!key) return { ready: false, reason: "Card payments aren’t set up yet (no Stripe key)." };
  if (/^(sk|rk)_live_/.test(key)) {
    return opts.allowLive ? { ready: true, live: true } : { ready: false, reason: "Live Stripe keys are switched off until STRIPE_ALLOW_LIVE is set." };
  }
  if (/^(sk|rk)_test_/.test(key)) {
    return opts.production ? { ready: false, reason: "Stripe test keys aren’t used on the live site." } : { ready: true, live: false };
  }
  return { ready: false, reason: "That isn’t a Stripe secret key." };
}

// A Stripe event only counts if it's from the same mode as the key in use.
export function eventMatchesMode(eventLivemode: boolean | undefined, mode: StripeMode): boolean {
  return mode.ready && Boolean(eventLivemode) === mode.live;
}
