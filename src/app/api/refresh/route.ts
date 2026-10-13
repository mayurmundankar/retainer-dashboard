import { refreshFromApis } from "@/lib/connectors";
import { invalidateCache } from "@/lib/data-layer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const messages = await refreshFromApis();
    invalidateCache();
    return Response.json({ messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ messages: [`Refresh failed: ${message}`] }, { status: 500 });
  }
}
