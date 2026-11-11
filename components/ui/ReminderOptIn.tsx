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
