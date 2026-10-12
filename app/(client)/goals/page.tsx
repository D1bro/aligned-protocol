import { redirect } from "next/navigation";

// Goals now live in My plan (/clear): the current goal with its check-ins,
// and past goals underneath. Kept as a redirect so old links still work.
export default function GoalsPage() {
  redirect("/clear");
}
