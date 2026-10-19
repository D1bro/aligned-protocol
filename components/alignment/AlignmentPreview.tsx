"use client";

import { useMemo } from "react";
import { AlignmentWorkspace, browserDay, shiftDay, type AlignmentService } from "./AlignmentWorkspace";
import { weekStart, type AlignmentDaily, type AlignmentWeekly, type DailyAlignmentInput, type WeeklyAlignmentInput } from "@/lib/alignment";

// This adapter has no live actions or browser persistence. Its fictional rows
// exist only in this component's memory, and disappear when the page reloads.
function fictionalService(): AlignmentService {
  const daily = new Map<string, AlignmentDaily>();
  const weekly = new Map<string, AlignmentWeekly>();
  let seeded = false;
  const stamp = () => new Date().toISOString();
  function dayRow(input: DailyAlignmentInput): AlignmentDaily {
    return { id: `fictional-day-${input.entry_date}`, client_id: "fictional-person", created_at: stamp(), updated_at: stamp(), presence_done: null, priority: null, goal_id: null, value: null, wellbeing_action: null, evening_note: null, wellbeing: null, meaningful_action: null, participation: null, values_choice: null, ...input };
  }
  function weekRow(input: WeeklyAlignmentInput): AlignmentWeekly {
    return { id: `fictional-week-${input.week_start}`, client_id: "fictional-person", created_at: stamp(), updated_at: stamp(), helped: null, adjustment: null, next_priority: null, ...input };
  }
  return {
    async read({ date, timezone }) {
      if (!seeded) {
        seeded = true;
        // Previous-week examples make the review inspectable even on Monday.
        // Deliberate gaps and blank answers demonstrate that nothing is scored
        // as a failure when the fictional person did not record an answer.
        const start = shiftDay(weekStart(browserDay()), -7);
        for (let index = 0; index < 3; index++) {
          const entryDate = shiftDay(start, index * 2);
          daily.set(entryDate, dayRow({ entry_date: entryDate, timezone, presence_done: true, priority: "Spend twenty focused minutes on the workshop outline.", value: "Courage", wellbeing_action: "Take a walk at lunchtime.", evening_note: "Starting with a small step made it easier to begin.", wellbeing: index === 1 ? "partly" : "yes", meaningful_action: "yes", participation: index === 2 ? "partly" : "yes", values_choice: index === 1 ? "not_needed" : "partly" }));
        }
        weekly.set(start, weekRow({ week_start: start, timezone, helped: "A smaller starting point and a walk before opening my laptop.", adjustment: "Give the outline a clear stopping point, so there is room for people too.", next_priority: "Finish a useful first draft of the workshop." }));
        daily.set(browserDay(), dayRow({ entry_date: browserDay(), timezone, priority: "Write the opening page of the workshop outline.", value: "Courage", wellbeing_action: "A phone-free walk after lunch." }));
      }
      const start = weekStart(date);
      return { available: true, daily: daily.get(date) ?? null, days: [...daily.values()].filter((entry) => weekStart(entry.entry_date) === start), weekly: weekly.get(start) ?? null, date, week_start: start, timezone, goals: [{ id: "fictional-goal", goal_title: "Create a workshop that helps people take their next step." }] };
    },
    async saveDaily(input) { const entry = dayRow(input); daily.set(input.entry_date, entry); return { ok: true, entry }; },
    async saveWeekly(input) { const entry = weekRow(input); weekly.set(input.week_start, entry); return { ok: true, entry }; },
    async deleteDaily(date) { daily.delete(date); return { ok: true }; },
    async deleteWeekly(date) { weekly.delete(date); return { ok: true }; },
    async exportData() { return { ok: true, data: { fictional_preview: true, daily: [...daily.values()], weekly: [...weekly.values()], exported_at: stamp() } }; },
  };
}

export function AlignmentPreview() {
  const service = useMemo(fictionalService, []);
  return <AlignmentWorkspace service={service} preview />;
}
