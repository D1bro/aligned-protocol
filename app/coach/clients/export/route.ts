import { NextResponse, type NextRequest } from "next/server";
import { requireStaff, getClientSummaries } from "@/lib/actions/admin";
import { buildView, filterPeople, personName, stageOf, type ViewKey } from "@/lib/console-views";
import { formatDate } from "@/lib/audit-schedule";

const VIEWS: ViewKey[] = ["audits", "plans", "checkins", "lessons"];

// CSV of whatever list is on screen (same filters), for a spreadsheet.
export async function GET(request: NextRequest) {
  const me = await requireStaff();
  const p = request.nextUrl.searchParams;
  const all = await getClientSummaries();
  if (!all) return NextResponse.json({ error: "Run migration 0011 first" }, { status: 409 });

  const view = VIEWS.includes(p.get("view") as ViewKey) ? (p.get("view") as ViewKey) : null;
  const q = (p.get("q") ?? "").trim().toLowerCase();
  let header: string[];
  let rows: string[][];
  let name: string;

  if (view) {
    const v = await buildView(view, { includeGuests: !!p.get("guests") || view === "audits", status: p.get("status") ?? undefined, didIt: !!p.get("did") }, all);
    header = v.columns;
    rows = v.rows.filter((r) => !q || r.cells[0].toLowerCase().includes(q)).map((r) => r.cells);
    name = v.title;
  } else {
    const people = filterPeople(all, { q, coach: p.get("coach") ?? "all", stage: p.get("stage") ?? "", guests: !!p.get("guests") }, me.id);
    header = ["Name", "Email", "Joined", "Coach", "Stage", "Main goal area", "Main goal", "Latest audit", "Audit date", "Goal check-ins", "Goals done", "Lessons done", "Last active"];
    rows = people.map((c) => [
      personName(c),
      c.email ?? "",
      formatDate(c.created_at),
      c.coach_name ?? "",
      stageOf(c),
      c.main_goal_area ?? "",
      c.main_goal ?? "",
      c.last_audit_score !== null ? `${c.last_audit_score}` : "",
      c.last_audit_at ? formatDate(c.last_audit_at) : "",
      `${c.checkins}`,
      `${c.goals_done}`,
      `${c.lessons_done}`,
      c.last_active_at ? formatDate(c.last_active_at) : "",
    ]);
    name = "Clients";
  }

  // Quote every cell; neutralise spreadsheet formulas.
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const file = `aligned-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"` },
  });
}
