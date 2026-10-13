import { getDashboard } from "@/lib/dashboard-data";
import { BILLABLE_VIEWS, DEFAULT_BILLABLE_VIEW, DEFAULT_WORK_TYPES, VARIANCE_THRESHOLD_PCT } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workTypes = (url.searchParams.get("workTypes") || DEFAULT_WORK_TYPES.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const billable = url.searchParams.get("billable") || DEFAULT_BILLABLE_VIEW;
  const threshold = Number(url.searchParams.get("threshold") || VARIANCE_THRESHOLD_PCT);
  if (!workTypes.length) {
    return Response.json({ error: "Select at least one work type." }, { status: 400 });
  }
  if (!BILLABLE_VIEWS.includes(billable as (typeof BILLABLE_VIEWS)[number])) {
    return Response.json({ error: "Unknown time filter." }, { status: 400 });
  }
  try {
    const data = await getDashboard(workTypes, billable, Number.isFinite(threshold) ? threshold : VARIANCE_THRESHOLD_PCT);
    return Response.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
