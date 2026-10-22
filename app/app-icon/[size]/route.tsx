import { appIcon } from "@/lib/app-icon";

const SIZES = new Set([192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const px = Number((await params).size);
  if (!SIZES.has(px)) return new Response("Not found", { status: 404 });
  return appIcon(px);
}
