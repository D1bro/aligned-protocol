"use client";

// A lightweight, honest strength read on a password as the person types it.
// No score is sent anywhere — this is purely a client-side hint to help
// someone pick something better than the 8-character minimum before they
// find out later (the hard way) that it was too weak.
function scorePassword(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let points = 0;
  if (pw.length >= 8) points++;
  if (pw.length >= 12) points++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) points++;
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) points++;
  if (points <= 1) return 1; // weak
  if (points <= 2) return 2; // fair
  return 3; // strong
}

const LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "",
  1: "Weak — try adding a number or a longer phrase",
  2: "Fair",
  3: "Strong",
};

const TONE: Record<0 | 1 | 2 | 3, string> = { 0: "", 1: "on-weak", 2: "on-fair", 3: "on-strong" };

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);

  return (
    <div>
      <div className="pw-meter">
        {[1, 2, 3].map((seg) => (
          <div key={seg} className={`pw-seg ${seg <= score ? TONE[score] : ""}`} />
        ))}
      </div>
      <div className="pw-label">{LABELS[score]}</div>
    </div>
  );
}
