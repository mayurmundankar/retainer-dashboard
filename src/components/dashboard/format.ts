import type { Fact } from "@/lib/types";

export function statusColor(status: string): string {
  if (status.includes("Over-servicing")) return "#dc2626";
  if (status.includes("Under-servicing")) return "#ea580c";
  if (status.includes("contract-to-date")) return "#ca8a04";
  if (status.includes("On track")) return "#16a34a";
  if (status.includes("Data issue")) return "#a3a3a3";
  return "#525252";
}

export function statusLabel(status: string): string {
  return status.replace(/^(?:\p{Extended_Pictographic}\uFE0F?\s*)+/u, "");
}

export function hrs0(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "No data";
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} h`;
}

export function hrs1(v: number | null | undefined, missing = "—"): string {
  if (v == null || Number.isNaN(v)) return missing;
  return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function pct1(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function ctdVarClass(v: number | null | undefined, threshold = 10): string {
  if (v == null || Number.isNaN(v)) return "";
  if (v > threshold) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25";
  if (v < -threshold) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
  return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
}

export function signedPct(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(v)) return null;
  const n = `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  return n;
}

export function sumMin(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

export function sumNum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((s, v) => s + (typeof v === "number" && !Number.isNaN(v) ? v : 0), 0);
}

export function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function ageLabel(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "unknown";
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function pretty(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || "—";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[3]} ${names[+m[2] - 1]} ${m[1]}`;
}

export function monthEndIso(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${period}-${String(d).padStart(2, "0")}`;
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadFact(rows: Fact[]) {
  const cats = [...new Set(rows.flatMap((r) => Object.keys(r.nb)))];
  const flat = rows.map((r) => {
    const nb: Record<string, number> = {};
    for (const c of cats) nb[`nb_${c}`] = r.nb[c] ?? 0;
    return {
      status: r.status,
      client: r.client,
      account_owner: r.account_owner,
      billing_model: r.billing_model,
      month_str: r.month_str,
      contracted_hours: r.contracted_hours,
      allocated_hours: r.allocated_hours,
      planned_hours: r.planned_hours,
      actual_hours: r.actual_hours,
      remaining_estimate: r.remaining_estimate,
      forecast_hours: r.forecast_hours,
      variance_hours: r.variance_hours,
      variance_pct: r.variance_pct,
      ctd_contracted: r.ctd_contracted,
      ctd_actual: r.ctd_actual,
      ctd_variance_pct: r.ctd_variance_pct,
      nonbillable_hours: r.nonbillable_hours,
      ...nb,
      deliverables_done: r.deliverables_done,
      deliverables_outstanding: r.deliverables_outstanding,
      deliverables_blocked: r.deliverables_blocked,
      partial_month: r.partial_month,
      data_missing: r.data_missing,
    };
  });
  if (!flat.length) return;
  const cols = Object.keys(flat[0]);
  const csv = [cols.join(","), ...flat.map((row) => cols.map((c) => csvCell(row[c as keyof typeof row])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "retainer_dashboard_export.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
