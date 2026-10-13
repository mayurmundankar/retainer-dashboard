import { saveActions } from "@/lib/data-layer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return Response.json({ error: "Expected a list of action rows." }, { status: 400 });
  }
  await saveActions(rows);
  return Response.json({ ok: true });
}
