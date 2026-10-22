"use client";

import { AlignmentWorkspace, type AlignmentService } from "./AlignmentWorkspace";
import { deleteDailyAlignment, deleteWeeklyAlignment, exportAlignmentData, getAlignmentData, saveDailyAlignment, saveWeeklyAlignment } from "@/lib/actions/alignment";

const service: AlignmentService = {
  read: getAlignmentData,
  saveDaily: saveDailyAlignment,
  saveWeekly: saveWeeklyAlignment,
  deleteDaily: deleteDailyAlignment,
  deleteWeekly: deleteWeeklyAlignment,
  exportData: exportAlignmentData,
};

export function AlignmentLive({ initialDate, initialTimezone, initialView }: { initialDate?: string; initialTimezone?: string; initialView?: "today" | "week" | "privacy" }) {
  return <AlignmentWorkspace service={service} initialDate={initialDate} initialTimezone={initialTimezone} initialView={initialView} />;
}
