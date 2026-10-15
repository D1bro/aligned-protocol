"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { draftFromTranscript } from "@/lib/ai-summary";
import { EMPTY_CONTENT } from "@/lib/summary-content";

// Session summaries: import a transcript, draft (by hand or with AI), edit,
// approve, publish. The database enforces the rules — an edited draft loses
// its approval, a published revision is frozen, and publishing creates the
// commitments exactly once (publish_session_summary, migration 0013).

export type SummaryContent = {
  focus: string;
  summary: string;
  insights: string[];
  client_actions: { text: string; due_date: string; goal_id: string }[];
  coach_actions: { text: string; due_date: string; visible: boolean }[];
  resources: { title: string; url: string }[];
  next_meeting: { text: string };
  points: string[];
};

export type Summary = {
  id: string;
  session_id: string;
  client_id: string;
  revision: number;
  status: "draft" | "approved" | "published" | "superseded";
  content: Partial<SummaryContent>;
  generated_by: "manual" | "ai";
  version: number;
  approved_at: string | null;
  approved_version: number | null;
  published_at: string | null;
  updated_at: string;
};

export type Transcript = {
  id: string;
  session_id: string;
  source: "paste" | "upload";
  file_name: string | null;
  transcript_date: string | null;
  speaker_map: { text?: string } | null;
  consent_confirmed: boolean;
  ai_status: "none" | "processing" | "done" | "failed";
  ai_error: string | null;
  ai_output: { review_flags?: string[]; excerpts?: { text: string; excerpt: string; time: string; uncertain: boolean }[]; model?: string } | null;
  created_at: string;
  length: number;
};


const MAX_TRANSCRIPT_CHARS = 300_000;

function refresh(clientId: string, sessionId: string) {
  revalidatePath(`/coach/clients/${clientId}/sessions/${sessionId}`);
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coaching");
}

// Normalise whatever the browser sent into the stored shape.
function clean(c: Partial<SummaryContent>): SummaryContent {
  const s = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return {
    focus: s(c.focus, 300),
    summary: s(c.summary, 8000),
    insights: (c.insights ?? []).map((x) => s(x, 1000)).filter(Boolean).slice(0, 12),
    client_actions: (c.client_actions ?? [])
      .map((a) => ({ text: s(a.text, 1000), due_date: date(a.due_date), goal_id: s(a.goal_id, 40) }))
      .filter((a) => a.text.trim())
      .slice(0, 20),
    coach_actions: (c.coach_actions ?? [])
      .map((a) => ({ text: s(a.text, 1000), due_date: date(a.due_date), visible: a.visible !== false }))
      .filter((a) => a.text.trim())
      .slice(0, 20),
    resources: (c.resources ?? [])
      .map((r) => ({ title: s(r.title, 200), url: /^https?:\/\//.test(s(r.url)) ? s(r.url, 1000) : "" }))
      .filter((r) => r.title.trim())
      .slice(0, 10),
    next_meeting: { text: s(c.next_meeting?.text, 300) },
    points: (c.points ?? []).map((x) => s(x, 1000)).filter(Boolean).slice(0, 30),
  };
}

export async function getTranscripts(sessionId: string): Promise<Transcript[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_transcripts")
    .select("id, session_id, source, file_name, transcript_date, speaker_map, consent_confirmed, ai_status, ai_error, ai_output, created_at, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(({ content, ...t }) => ({ ...(t as Omit<Transcript, "length">), length: (content as string).length }));
}

// Save a transcript against a session. The client is read from the session
// itself, never from the browser. The same text twice is detected and not
// stored again.
export async function importTranscript(input: {
  sessionId: string;
  source: "paste" | "upload";
  fileName: string | null;
  text: string;
  transcriptDate: string;
  speakerMap: string;
  consent: boolean;
}): Promise<{ ok: true; id: string; duplicate: boolean } | { ok: false; message: string }> {
  const me = await requireStaff();
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, message: "The transcript is empty." };
  if (text.length > MAX_TRANSCRIPT_CHARS) return { ok: false, message: "That transcript is too long (300,000 characters at most)." };
  if (input.fileName && !/\.(txt|vtt|srt|md)$/i.test(input.fileName)) {
    return { ok: false, message: "Upload a text transcript: .txt, .vtt, .srt or .md." };
  }
  if (!input.consent) return { ok: false, message: "Confirm the client agreed to the session being recorded or transcribed." };

  const supabase = await createClient();
  const { data: session } = await supabase.from("coaching_sessions").select("id, client_id").eq("id", input.sessionId).maybeSingle();
  if (!session) return { ok: false, message: "Session not found." };

  const hash = createHash("sha256").update(text).digest("hex");
  const { data: existing } = await supabase
    .from("session_transcripts")
    .select("id")
    .eq("session_id", session.id)
    .eq("content_hash", hash)
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id, duplicate: true };

  const { data, error } = await supabase
    .from("session_transcripts")
    .insert({
      client_id: session.client_id,
      session_id: session.id,
      source: input.source,
      file_name: input.fileName,
      content_hash: hash,
      content: text,
      speaker_map: input.speakerMap.trim() ? { text: input.speakerMap.trim().slice(0, 500) } : null,
      transcript_date: /^\d{4}-\d{2}-\d{2}$/.test(input.transcriptDate) ? input.transcriptDate : null,
      consent_confirmed: true,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "Couldn’t save the transcript — try again." };
  await supabase.from("audit_events").insert({
    actor_id: me.id,
    client_id: session.client_id,
    action: "transcript.imported",
    target_type: "session_transcript",
    target_id: data.id,
  });
  refresh(session.client_id, session.id);
  return { ok: true, id: data.id, duplicate: false };
}

// The session's working draft: the latest unpublished revision, or a new one
// (starting from the last shared wording, so edits after publishing begin
// from what the member already has).
export async function getOrCreateDraft(sessionId: string): Promise<{ ok: true; summary: Summary } | { ok: false; message: string }> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("session_summaries")
    .select("*")
    .eq("session_id", sessionId)
    .order("revision", { ascending: false });
  const open = (all ?? []).find((x) => x.status === "draft" || x.status === "approved");
  if (open) return { ok: true, summary: open as Summary };

  const { data: session } = await supabase.from("coaching_sessions").select("id, client_id").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, message: "Session not found." };
  const latest = (all ?? [])[0];
  const published = (all ?? []).find((x) => x.status === "published");
  const { data, error } = await supabase
    .from("session_summaries")
    .insert({
      session_id: session.id,
      client_id: session.client_id,
      revision: (latest?.revision ?? 0) + 1,
      content: published?.content ?? EMPTY_CONTENT,
      created_by: me.id,
    })
    .select("*")
    .single();
  if (error || !data) {
    // Someone else created it at the same moment: use theirs.
    const { data: again } = await supabase
      .from("session_summaries")
      .select("*")
      .eq("session_id", sessionId)
      .in("status", ["draft", "approved"])
      .maybeSingle();
    if (again) return { ok: true, summary: again as Summary };
    return { ok: false, message: "Couldn’t start a draft — try again." };
  }
  return { ok: true, summary: data as Summary };
}

export type DraftSave = { ok: true; summary: Summary } | { ok: false; conflict?: Summary; message: string };

// Save the draft's wording. Any change clears approval (in the database).
export async function saveDraft(input: { summaryId: string; content: Partial<SummaryContent>; expectedVersion: number }): Promise<DraftSave> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_summaries")
    .update({ content: clean(input.content) })
    .eq("id", input.summaryId)
    .eq("version", input.expectedVersion)
    .in("status", ["draft", "approved"])
    .select("*");
  if (error) return { ok: false, message: "Couldn’t save — your changes are still here. Try again." };
  if (data?.length) {
    const s = data[0] as Summary;
    refresh(s.client_id, s.session_id);
    return { ok: true, summary: s };
  }
  const { data: current } = await supabase.from("session_summaries").select("*").eq("id", input.summaryId).maybeSingle();
  if (current && (current.status === "published" || current.status === "superseded")) {
    return { ok: false, message: "This revision has been shared already. Start a new draft to change it." };
  }
  return {
    ok: false,
    conflict: (current as Summary) ?? undefined,
    message: "The draft was changed elsewhere. Reload to see the latest wording before saving again.",
  };
}

// Approve exactly the wording that's saved now.
export async function approveDraft(summaryId: string, expectedVersion: number): Promise<DraftSave> {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_summaries")
    .update({ status: "approved", approved_by: me.id, approved_at: new Date().toISOString(), approved_version: expectedVersion })
    .eq("id", summaryId)
    .eq("version", expectedVersion)
    .eq("status", "draft")
    .select("*");
  if (error || !data?.length) return { ok: false, message: "Save your latest changes before approving, then try again." };
  const s = data[0] as Summary;
  refresh(s.client_id, s.session_id);
  return { ok: true, summary: s };
}

// Publish the approved revision to the member's portal (one transaction in
// the database). Safe to retry: a second call returns the same revision.
export async function publishSummary(summaryId: string, expectedVersion: number): Promise<{ ok: true; revision: number } | { ok: false; message: string }> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_session_summary", { p_summary_id: summaryId, p_expected_version: expectedVersion });
  if (error) {
    return { ok: false, message: error.message.includes("Approve") ? "Approve the latest wording before sharing." : "Couldn’t share — try again." };
  }
  const { data: s } = await supabase.from("session_summaries").select("client_id, session_id").eq("id", summaryId).maybeSingle();
  if (s) refresh(s.client_id, s.session_id);
  return { ok: true, revision: data as number };
}

// Draft the summary from a transcript with AI (server-side). Fills the
// working draft only when it's empty, unless the coach chose to replace it.
export async function generateDraft(input: { transcriptId: string; replace: boolean }): Promise<DraftSave> {
  await requireStaff();
  const supabase = await createClient();
  const { data: t } = await supabase.from("session_transcripts").select("*").eq("id", input.transcriptId).maybeSingle();
  if (!t) return { ok: false, message: "Transcript not found." };
  if (t.ai_status === "processing" && t.ai_started_at && Date.now() - new Date(t.ai_started_at).getTime() < 5 * 60_000) {
    return { ok: false, message: "A draft is already being generated from this transcript." };
  }

  const draft = await getOrCreateDraft(t.session_id);
  if (!draft.ok) return draft;
  const current = clean(draft.summary.content);
  const hasContent = Boolean(current.summary || current.focus || current.client_actions.length || current.coach_actions.length);
  if (hasContent && !input.replace) {
    return { ok: false, message: "The draft already has wording. Choose “Replace the draft” to overwrite it with an AI draft." };
  }

  await supabase.from("session_transcripts").update({ ai_status: "processing", ai_error: null, ai_started_at: new Date().toISOString() }).eq("id", t.id);

  const [{ data: client }, { data: goals }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", t.client_id).maybeSingle(),
    supabase.from("goals").select("id, goal_title").eq("client_id", t.client_id).eq("status", "active"),
  ]);
  const result = await draftFromTranscript({
    transcript: t.content,
    speakerMap: (t.speaker_map as { text?: string } | null)?.text ?? null,
    transcriptDate: t.transcript_date,
    clientFirstName: ((client?.full_name as string | null) ?? "").split(" ")[0] || "the client",
    goals: (goals ?? []).map((g) => ({ id: g.id as string, title: (g.goal_title as string) ?? "Goal" })),
  });

  if (!result.ok) {
    await supabase.from("session_transcripts").update({ ai_status: "failed", ai_error: result.message }).eq("id", t.id);
    refresh(t.client_id, t.session_id);
    return { ok: false, message: result.message };
  }

  const d = result.draft;
  const content: SummaryContent = {
    ...current,
    focus: d.focus,
    summary: d.summary,
    insights: d.insights,
    client_actions: d.client_actions.map((a) => ({ text: a.text, due_date: a.due_date, goal_id: a.goal_id })),
    coach_actions: d.coach_actions.map((a) => ({ text: a.text, due_date: a.due_date, visible: true })),
    next_meeting: { text: d.next_meeting.mentioned ? d.next_meeting.text : current.next_meeting.text },
  };
  const { data: saved, error } = await supabase
    .from("session_summaries")
    .update({ content, generated_by: "ai", source: { transcript_id: t.id } })
    .eq("id", draft.summary.id)
    .eq("version", draft.summary.version)
    .in("status", ["draft", "approved"])
    .select("*");
  await supabase
    .from("session_transcripts")
    .update({
      ai_status: "done",
      ai_output: {
        model: result.model,
        review_flags: d.review_flags,
        excerpts: [...d.client_actions, ...d.coach_actions].map((a) => ({ text: a.text, excerpt: a.source_excerpt, time: a.source_time, uncertain: a.uncertain })),
        next_meeting_excerpt: d.next_meeting.source_excerpt,
      },
    })
    .eq("id", t.id);
  refresh(t.client_id, t.session_id);
  if (error || !saved?.length) return { ok: false, message: "The draft changed while generating. Reload and try again." };
  return { ok: true, summary: saved[0] as Summary };
}
