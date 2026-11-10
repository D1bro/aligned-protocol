import { redirect } from "next/navigation";

// My Plan became The Next Step (10 Nov 2026). Old links and emails land on
// the new page; a coach's suggested area carries across.
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ choose?: string; suggested?: string; new?: string }> }) {
  const { choose, suggested, new: fresh } = await searchParams;
  if (choose || suggested || fresh) {
    redirect(`/next-step?choose=1${suggested ? `&suggested=${encodeURIComponent(suggested)}` : ""}`);
  }
  redirect("/next-step");
}
