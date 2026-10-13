"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { reviewItems } from "@/lib/review";
import type { ReviewItem } from "@/lib/types";
import { Banner, Metric } from "./bits";
import { hrs1, pct1 } from "./format";
import type { View } from "./view";

function keyOf(r: { client: string; month: string; flag_type: string }) {
  return `${r.client}\t${r.month}\t${r.flag_type}`;
}

export function ReviewTab({ view, onSaved }: { view: View; onSaved: () => void }) {
  const [scope, setScope] = useState<"month" | "range">("month");
  const [edits, setEdits] = useState<Record<string, Partial<ReviewItem>>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const src = scope === "month" ? view.monthRows : view.trendRows;
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
        A flag means review, not reduce. Over-hours can be planned investment (onboarding, seasonal peaks). Outstanding commitments stay visible next to each flag.
      </Banner>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={scope === "month" ? "default" : "outline"} onClick={() => setScope("month")}>
          Reporting month ({view.asOf})
        </Button>
        <Button size="sm" variant={scope === "range" ? "default" : "outline"} onClick={() => setScope("range")}>
          Trend range ({view.range[0]} → {view.range[1]})
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
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {["Client", "Month", "Flag", "Direction", "Var (h)", "Var %", "Open deliverables", "Account owner", "Reason", "Temporary / recurring", "Action", "Action owner", "Deadline", "Hours adj.", "Status", "Notes", "Complete"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>
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
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save actions"}</Button>
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
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
