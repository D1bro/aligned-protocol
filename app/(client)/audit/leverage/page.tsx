import { redirect } from "next/navigation";

// The end-of-audit focus question has been removed: the last area now goes
// straight to the snapshot. Kept as a redirect so old links still work.
export default function LeveragePage() {
  redirect("/audit");
}
