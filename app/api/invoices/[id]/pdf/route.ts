import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download an issued invoice's PDF. The database decides who may see it: the
// client it's for, or a billing admin. Files are never public.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("number, pdf_status, pdf_path").eq("id", id).maybeSingle();
  if (!inv || inv.pdf_status !== "ready" || !inv.pdf_path) return new NextResponse("Not found", { status: 404 });
  const { data: file, error } = await supabase.storage.from("invoices").download(inv.pdf_path);
  if (error || !file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice-${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
