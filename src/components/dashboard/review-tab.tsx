"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { isInternalClient } from "@/lib/constants";
import { reviewItems } from "@/lib/review";
import type { ReviewItem } from "@/lib/types";
import { Banner, Metric, SectionTitle, SimpleTable } from "./bits";
import { hrs1, pct1 } from "./format";
import { formatMonth } from "./month-picker";
import type { View } from "./view";

function keyOf(r: { client: string; month: string; flag_type: string }) {
  return `${r.client}\t${r.month}\t${r.flag_type}`;
}

export function ReviewTab({ view, onSaved }: { view: View; onSaved: () => void }) {
  const [scope, setScope] = useState<"month" | "range">("month");
  const [edits, setEdits] = useState<Record<string, Partial<ReviewItem>>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const rawSrc = scope === "month" ? view.monthRows : view.trendRows;
  const src = useMemo(
    () =>
      rawSrc.filter(
        (r) =>
          !isInternalClient(r.client) &&
          !r.data_missing &&
          ((r.actual_hours != null && r.actual_hours > 0) || r.planned_hours > 0),
      ),
    [rawSrc],
  );
  const items = useMemo(() => reviewItems(src, view.payload.actionsLog), [src, view.payload.actionsLog]);
  const rows = items.map((item) => ({ ...item, ...edits[keyOf(item)] }));
  const done = rows.filter((r) => r.reason && r.action && r.owner && r.deadline).length;

  function patch(row: ReviewItem, partial: Partial<ReviewItem>) {
    const k = keyOf(row);
    setEdits((prev) => ({ ...prev, [k]: { ...prev[k], ...partial } }));
  }

  async function save() {
    setSaving(true);
    setNote(null);
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          ...r,
          deadline: r.deadline ?? "",
          hours_adjustment: r.hours_adjustment ?? "",
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setNote("Could not save actions.");
      return;
    }
    setEdits({});
    setNote("Actions saved. History stays in actions_log.csv.");
    onSaved();
  }

  return (
    <div className="space-y-4">
      <Banner tone="info">
        <strong>Review &amp; Action Tracking:</strong> A flag prompts strategic review, not automatic hour reductions. Over-hours may represent planned investments (onboarding, seasonal peaks). Saved actions are permanently preserved in the central audit history log, visible to all users across data refreshes and API pulls.
      </Banner>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className={
            scope === "month"
              ? "rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] text-white shadow-[2px_2px_0px_#b5018b]"
              : "rounded-full font-bold uppercase text-[11px] tracking-wider border border-border/80 bg-white text-foreground hover:bg-[#121212] hover:text-white"
          }
          onClick={() => setScope("month")}
        >
          Reporting month ({formatMonth(view.asOf)})
        </Button>
        <Button
          size="sm"
          className={
            scope === "range"
              ? "rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] text-white shadow-[2px_2px_0px_#b5018b]"
              : "rounded-full font-bold uppercase text-[11px] tracking-wider border border-border/80 bg-white text-foreground hover:bg-[#121212] hover:text-white"
          }
          onClick={() => setScope("range")}
        >
          Trend range ({formatMonth(view.range[0])} – {formatMonth(view.range[1])})
        </Button>
      </div>
      {rows.length === 0 ? (
        <Banner tone="ok">No accounts exceed the review threshold for this selection.</Banner>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Flags" value={String(rows.length)} />
            <Metric label="With reason, action, owner & deadline" value={`${done}/${rows.length}`} />
            <Metric label="Over" value={String(rows.filter((r) => r.direction === "Over").length)} />
            <Metric label="Under / data missing" value={String(rows.filter((r) => r.direction === "Under" || r.direction === "Data missing").length)} />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
              Flagged active client accounts ({rows.length})
            </span>
            <div className="flex items-center gap-3">
              {note && <span className="text-xs text-muted-foreground font-medium">{note}</span>}
              <Button
                onClick={save}
                disabled={saving}
                size="sm"
                className="rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] hover:bg-[#b5018b] text-white shadow-[2px_2px_0px_#99d132] px-4 transition-all"
              >
                {saving ? "Saving…" : "Save actions"}
              </Button>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-border/80 shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-[#b5018b] text-white border-b-2 border-[#b5018b] text-left">
                <tr>
                  {["Client", "Month", "Flag", "Direction", "Var (h)", "Var %", "Open deliverables", "Account owner", "Reason for over/under delivery", "Is issue Temporary or recurring", "Action", "Action owner", "Deadline", "Hours adj.", "Status", "Notes", "Complete"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2.5 py-2.5 font-bold uppercase tracking-wider text-white text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={keyOf(r)} className="border-t align-top">
                    <td className="px-2 py-1.5">{r.client}</td>
                    <td className="px-2 py-1.5">{r.month}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.flag_type}</td>
                    <td className="px-2 py-1.5">{r.direction}</td>
                    <td className="px-2 py-1.5 tabular-nums">{hrs1(r.variance_hours)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{pct1(r.variance_pct)}</td>
                    <td className="px-2 py-1.5">{r.outstanding}</td>
                    <td className="px-2 py-1.5">{r.account_owner || "—"}</td>
                    <td className="px-2 py-1.5"><Pick value={r.reason} options={view.payload.reasons} onChange={(v) => patch(r, { reason: v })} /></td>
                    <td className="px-2 py-1.5"><Pick value={r.nature} options={view.payload.nature} onChange={(v) => patch(r, { nature: v })} /></td>
                    <td className="px-2 py-1.5"><Pick value={r.action} options={view.payload.actions} onChange={(v) => patch(r, { action: v })} /></td>
                    <td className="px-2 py-1.5">
                      <input className="h-7 w-28 rounded-md border bg-transparent px-2" value={r.owner} onChange={(e) => patch(r, { owner: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="h-7 rounded-md border bg-transparent px-2" type="date" value={r.deadline ?? ""} onChange={(e) => patch(r, { deadline: e.target.value || null })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="h-7 w-20 rounded-md border bg-transparent px-2"
                        type="number"
                        step="0.1"
                        value={r.hours_adjustment ?? ""}
                        onChange={(e) => patch(r, { hours_adjustment: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5"><Pick value={r.status} options={view.payload.actionStatus} onChange={(v) => patch(r, { status: v })} /></td>
                    <td className="px-2 py-1.5">
                      <input className="h-7 w-56 rounded-md border bg-transparent px-2" value={r.notes} onChange={(e) => patch(r, { notes: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">{r.reason && r.action && r.owner && r.deadline ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={save}
              disabled={saving}
              size="sm"
              className="rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] hover:bg-[#b5018b] text-white shadow-[2px_2px_0px_#99d132] px-5 py-2 transition-all cursor-pointer"
            >
              {saving ? "Saving…" : "Save actions"}
            </Button>
            {note && (
              <span className="text-xs font-semibold text-[#b5018b] bg-[#b5018b]/10 px-3 py-1 rounded-full border border-[#b5018b]/30">
                {note}
              </span>
            )}
          </div>

          {/* Saved Action History Log (actions_log.csv audit trail) */}
          <div className="space-y-2 pt-4">
            <SectionTitle badge="AUDIT LOG" subtitle="All historical and active review actions recorded in actions_log.csv. Preserved across refreshes and API pulls.">
              Saved Action History &amp; Weekly Summary
            </SectionTitle>
            <div className="max-h-80 overflow-auto rounded-xl border border-border/80 shadow-xs bg-card">
              {view.payload.actionsLog.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-light">
                  No saved actions logged yet. Edit flagged accounts above and click &quot;Save actions&quot; to log them.
                </div>
              ) : (
                <SimpleTable
                  stickyHeader
                  rows={view.payload.actionsLog}
                  columns={[
                    { key: "client", label: "Client", className: "font-bold text-foreground" },
                    { key: "month", label: "Month", className: "tabular-nums" },
                    {
                      key: "flag_type",
                      label: "Flag",
                      render: (r) => (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4b439d]/15 text-[#4b439d] dark:text-[#a5b4fc] border border-[#4b439d]/25">
                          {r.flag_type}
                        </span>
                      ),
                    },
                    { key: "reason", label: "Reason", className: "font-medium" },
                    { key: "action", label: "Agreed Action", className: "font-medium text-foreground" },
                    { key: "owner", label: "Owner", className: "font-semibold text-[#b5018b]" },
                    { key: "deadline", label: "Deadline", className: "tabular-nums" },
                    {
                      key: "status",
                      label: "Status",
                      render: (r) => {
                        const st = (r.status || "Open").toLowerCase();
                        const cls = st.includes("resolved") || st.includes("complete")
                          ? "bg-[#99d132]/15 text-[#2e5904] dark:text-[#99d132] border-[#99d132]/35"
                          : st.includes("progress")
                          ? "bg-[#01abc8]/15 text-[#01abc8] border-[#01abc8]/35"
                          : "bg-[#b5018b]/15 text-[#b5018b] border-[#b5018b]/35";
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-2xs ${cls}`}>
                            {r.status || "Open"}
                          </span>
                        );
                      },
                    },
                    { key: "notes", label: "Notes", className: "max-w-xs truncate" },
                    {
                      key: "updated_at",
                      label: "Logged At",
                      render: (r) => (
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          {r.updated_at ? r.updated_at.replace("T", " ").slice(0, 16) : "—"}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Pick({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      className="h-7 max-w-52 rounded-md border bg-transparent px-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o || "blank"} value={o}>{o || "—"}</option>
      ))}
    </select>
  );
}
