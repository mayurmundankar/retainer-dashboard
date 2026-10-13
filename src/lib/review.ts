import type { Fact, ReviewItem } from "./types";

type ActionLike = {
  client: string;
  month: string;
  flag_type: string;
  reason?: string;
  nature?: string;
  action?: string;
  owner?: string;
  deadline?: string;
  hours_adjustment?: string;
  status?: string;
  notes?: string;
  updated_at?: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function reviewItems(fact: Fact[], actions: ActionLike[]): ReviewItem[] {
  const rows: Omit<ReviewItem, "reason" | "nature" | "action" | "owner" | "deadline" | "hours_adjustment" | "status" | "notes" | "updated_at" | "complete">[] = [];
  for (const r of fact) {
    if (!r.review_required) continue;
    const outstanding = r.deliverables_outstanding + r.deliverables_blocked;
    if (r.monthly_flag === "Over" || r.monthly_flag === "Under" || r.monthly_flag === "Data missing") {
      rows.push({
        client: r.client,
        month: r.month_str,
        flag_type: "Monthly forecast",
        direction: r.monthly_flag,
        variance_hours: r.variance_hours,
        variance_pct: r.variance_pct,
        account_owner: r.account_owner,
        outstanding,
      });
    }
    if (r.ctd_flag === "Over" || r.ctd_flag === "Under") {
      rows.push({
        client: r.client,
        month: r.month_str,
        flag_type: "Contract-to-date",
        direction: r.ctd_flag,
        variance_hours: r.ctd_variance_hours,
        variance_pct: r.ctd_variance_pct,
        account_owner: r.account_owner,
        outstanding,
      });
    }
  }

  const latest = new Map<string, ActionLike>();
  const ordered = [...actions].sort((a, b) => String(a.updated_at ?? "").localeCompare(String(b.updated_at ?? "")));
  for (const a of ordered) {
    latest.set(`${a.client}\t${String(a.month)}\t${a.flag_type}`, a);
  }

  return rows.map((row) => {
    const saved = latest.get(`${row.client}\t${row.month}\t${row.flag_type}`);
    const reason = String(saved?.reason ?? "");
    const nature = String(saved?.nature ?? "");
    const action = String(saved?.action ?? "");
    const owner = String(saved?.owner ?? "");
    const notes = String(saved?.notes ?? "");
    const deadlineRaw = String(saved?.deadline ?? "").trim();
    const deadline = /^\d{4}-\d{2}-\d{2}/.test(deadlineRaw) ? deadlineRaw.slice(0, 10) : null;
    const status = String(saved?.status ?? "").trim() || "Open";
    return {
      ...row,
      reason,
      nature,
      action,
      owner,
      deadline,
      hours_adjustment: num(saved?.hours_adjustment),
      status,
      notes,
      updated_at: String(saved?.updated_at ?? ""),
      complete: reason !== "" && action !== "" && owner !== "" && deadline != null,
    };
  });
}
