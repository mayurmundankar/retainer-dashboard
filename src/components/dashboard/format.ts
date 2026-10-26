import type { Fact } from "@/lib/types";

export function statusColor(status: string): string {
  if (status.includes("Over-servicing")) return "#b5018b"; // Verkeer Plum (#b5018b)
  if (status.includes("Under-servicing")) return "#ea580c"; // Verkeer Alert Orange (#ea580c)
  if (status.includes("contract-to-date")) return "#4b439d"; // Verkeer Indigo (#4b439d)
  if (status.includes("On track")) return "#99d132"; // Verkeer Lime Green (#99d132)
  if (status.includes("Data issue")) return "#737373";
  return "#121212";
}

export function statusLabel(status: string): string {
  return status.replace(/^(?:\p{Extended_Pictographic}\uFE0F?\s*)+/u, "").trim();
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
  if (v > threshold) return "bg-[#b5018b]/15 text-[#b5018b] border-[#b5018b]/30";
  if (v < -threshold) return "bg-[#ea580c]/15 text-[#ea580c] border-[#ea580c]/30";
  return "bg-[#99d132]/15 text-[#2e5904] dark:text-[#99d132] border-[#99d132]/35";
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
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function pretty(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthEndIso(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadFact(rows: Fact[]) {
  if (!rows.length) return;

  const headers = [
    "Servicing Status",
    "Client Account",
    "POD / Account Lead",
    "Billing Month",
    "Contracted Hours",
    "Allocated Hours",
    "Planned Hours (Monday)",
    "Actual Hours (Everhour)",
    "Remaining Estimate",
    "Forecast Hours",
    "Monthly Variance (Hours)",
    "Monthly Variance (%)",
    "Contract-to-date Contracted (Hours)",
    "Contract-to-date Actual (Hours)",
    "Contract-to-date Variance (%)",
    "Deliverables Done",
    "Deliverables Outstanding",
    "Deliverables Blocked",
    "Non-billable Hours",
  ];

  const dataRows = rows.map((r) => [
    statusLabel(r.status),
    r.client,
    r.account_owner || "—",
    r.month_str,
    r.contracted_hours != null ? r.contracted_hours.toFixed(1) : "—",
    r.allocated_hours != null ? r.allocated_hours.toFixed(1) : "—",
    r.planned_hours != null ? r.planned_hours.toFixed(1) : "—",
    r.data_missing ? "Missing" : r.actual_hours != null ? r.actual_hours.toFixed(1) : "—",
    r.remaining_estimate != null ? r.remaining_estimate.toFixed(1) : "—",
    r.forecast_hours != null ? r.forecast_hours.toFixed(1) : "—",
    r.variance_hours != null ? `${r.variance_hours > 0 ? "+" : ""}${r.variance_hours.toFixed(1)}` : "—",
    r.variance_pct != null ? `${r.variance_pct > 0 ? "+" : ""}${r.variance_pct.toFixed(1)}%` : "—",
    r.ctd_contracted != null ? r.ctd_contracted.toFixed(1) : "—",
    r.ctd_actual != null ? r.ctd_actual.toFixed(1) : "—",
    r.ctd_variance_pct != null ? `${r.ctd_variance_pct > 0 ? "+" : ""}${r.ctd_variance_pct.toFixed(1)}%` : "—",
    r.deliverables_done ?? 0,
    r.deliverables_outstanding ?? 0,
    r.deliverables_blocked ?? 0,
    r.nonbillable_hours != null ? r.nonbillable_hours.toFixed(1) : "0.0",
  ]);

  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...dataRows.map((row) => row.map(csvCell).join(","))].join("\r\n");

  const monthRaw = rows[0]?.month_str || rows[0]?.month || "";
  const monthTag = monthRaw ? `_${monthRaw.replace(/[^a-zA-Z0-9-]/g, "_")}` : "";
  const fileName = `verkeer_retainer_accounts${monthTag}.csv`;

  // Use clean standard MIME type for CSV (never a trailing semicolon)
  const mimeType = "text/csv;charset=utf-8";
  const blob = new Blob([csvContent], { type: mimeType });

  // If File constructor exists, instantiate File so the filename is tied to the object
  let fileOrBlob: Blob = blob;
  try {
    fileOrBlob = new File([blob], fileName, { type: mimeType });
  } catch {
    fileOrBlob = blob;
  }

  const url = URL.createObjectURL(fileOrBlob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", fileName);
  a.download = fileName;
  a.rel = "noopener";
  // Off-screen rendering rather than display: none to guarantee Chrome respects download attributes
  a.style.position = "fixed";
  a.style.left = "-9999px";
  a.style.top = "-9999px";
  a.style.opacity = "0";

  document.body.appendChild(a);

  // Trigger download with MouseEvent and fallback
  try {
    a.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  } catch {
    a.click();
  }

  // Defer cleanup by 30 seconds to allow Chrome background download thread to finalize
  setTimeout(() => {
    try {
      if (a.parentNode) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignored
    }
  }, 30000);
}

