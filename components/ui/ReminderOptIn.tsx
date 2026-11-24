// The weekly check-in email, chosen at sign-up rather than switched on
// silently (Duane, 11 Nov 2026). Unticked until they tick it; posts
// reminders_email=on with the form.
export function ReminderOptIn() {
  return (
    <label className="opt-in">
      <input type="checkbox" name="reminders_email" />
      <span>
        Email me when a weekly check-in is due
        <small>At most one email a week. You can turn it off any time.</small>
      </span>
    </label>
  );
}

// The follow-up emails after the audit (Duane, 24 Nov 2026): their own
// choice, unticked until they tick it; posts followups_email=on.
export function FollowupOptIn() {
  return (
    <label className="opt-in">
      <input type="checkbox" name="followups_email" />
      <span>
        Send me a few short emails from Duane to help with my Next Step
        <small>Four over ten days. You can stop them any time.</small>
      </span>
    </label>
  );
}
