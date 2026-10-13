import { RECON_TOLERANCE_PCT } from "./constants";
import { cell, num } from "./csv";
import type { CsvRow } from "./csv";
import type { Loaded } from "./data-layer";
import { parseMonth, weekdayCount } from "./dates";
import type { CapacityRow, ReconRow } from "./types";

type TimeLike = { client: string; client_raw?: string; month: string | null; hours: number; billable: boolean; work_type: string; user: string };
type PlannedLike = { client: string; client_raw?: string; monthPeriod: string | null; planned_hours: number; discipline: string };

function lookup(mapping: CsvRow[], source: string) {
  const map = new Map<string, string>();
  for (const row of mapping) {
    if (cell(row, "source").toLowerCase() !== source.toLowerCase()) continue;
    const name = cell(row, "source_name").toLowerCase();
    const canonical = cell(row, "canonical_client");
    if (name && canonical) map.set(name, canonical);
  }
  return map;
}

export function everhourVsTracker(timeClean: TimeLike[], tracker: CsvRow[], mapping: CsvRow[]): ReconRow[] {
  const eh = new Map<string, { client: string; month: string; hours: number }>();
  for (const t of timeClean) {
    if (t.work_type !== "Retainer" || !t.billable || !t.month) continue;
    const key = `${t.client}\t${t.month}`;
    const cur = eh.get(key);
    if (cur) cur.hours += t.hours;
    else eh.set(key, { client: t.client, month: t.month, hours: t.hours });
  }
  const map = lookup(mapping, "tracker");
  const tr = new Map<string, { client: string; month: string; hours: number }>();
  for (const row of tracker) {
    const raw = cell(row, "client").trim();
    const client = map.get(raw.toLowerCase()) ?? raw;
    const month = parseMonth(cell(row, "month"));
    const hours = num(cell(row, "hours"));
    if (!client || !month || hours == null) continue;
    const key = `${client}\t${month}`;
    const cur = tr.get(key);
    if (cur) cur.hours += hours;
    else tr.set(key, { client, month, hours });
  }
  const keys = new Set([...eh.keys(), ...tr.keys()]);
  const rows: ReconRow[] = [];
  for (const key of keys) {
    const e = eh.get(key);
    const t = tr.get(key);
    const client = e?.client ?? t!.client;
    const month = e?.month ?? t!.month;
    const everhour = e ? e.hours : null;
    const trackerHours = t ? t.hours : null;
    const difference = everhour == null || trackerHours == null ? null : everhour - trackerHours;
    const differencePct =
      difference == null || trackerHours == null || trackerHours === 0 ? null : (difference / trackerHours) * 100;
    let status = "⚠️ Investigate";
    if (everhour == null) status = "❌ Missing in Everhour";
    else if (trackerHours == null) status = "❌ Missing in tracker";
    else if (differencePct != null && Math.abs(differencePct) <= RECON_TOLERANCE_PCT) status = "✅ Match";
    rows.push({
      client,
      month,
      everhour_hours: everhour,
      tracker_hours: trackerHours,
      difference,
      difference_pct: differencePct,
      status,
    });
  }
  rows.sort((a, b) => a.status.localeCompare(b.status) || a.client.localeCompare(b.client) || a.month.localeCompare(b.month));
  return rows;
}

export function unmappedClients(
  data: Pick<Loaded, "timeEntries" | "plannedItems" | "tracker" | "clientMapping">,
  canonical: Set<string>,
) {
  const rows: { source: string; client_name: string; records: number }[] = [];
  const sources: { source: string; names: string[] }[] = [
    {
      source: "everhour",
      names: data.timeEntries.map((t) => t.client),
    },
    {
      source: "monday",
      names: data.plannedItems.map((t) => t.client),
    },
    {
      source: "tracker",
      names: data.tracker.map((t) => cell(t, "client")),
    },
  ];
  for (const src of sources) {
    const map = lookup(data.clientMapping, src.source);
    const counts = new Map<string, number>();
    for (const rawName of src.names) {
      const raw = rawName.trim() || "nan";
      const client = raw === "nan" ? "nan" : (map.get(raw.toLowerCase()) ?? raw);
      if (canonical.has(client)) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, n] of ordered) rows.push({ source: src.source, client_name: name, records: n });
  }
  return rows;
}

export function workTypeSplit(timeClean: TimeLike[]) {
  const table = new Map<string, { client: string; month: string; hours: Record<string, number> }>();
  for (const t of timeClean) {
    if (!t.month) continue;
    const key = `${t.client}\t${t.month}`;
    const cur = table.get(key) ?? { client: t.client, month: t.month, hours: {} };
    cur.hours[t.work_type] = (cur.hours[t.work_type] ?? 0) + t.hours;
    table.set(key, cur);
  }
  return [...table.values()].sort((a, b) => a.client.localeCompare(b.client) || a.month.localeCompare(b.month));
}

export function capacityByDiscipline(
  team: Loaded["team"],
  leave: Loaded["leave"],
  timeClean: TimeLike[],
  planned: PlannedLike[],
  months: string[],
): CapacityRow[] {
  const leaveMap = new Map<string, number>();
  for (const row of leave) {
    const month = parseMonth(row.month) ?? row.month;
    const key = `${row.user}\t${month}`;
    leaveMap.set(key, (leaveMap.get(key) ?? 0) + row.leave_hours);
  }
  const disc = new Map(team.map((t) => [t.user, t.discipline]));
  type Cap = { gross_hours: number; leave_hours: number; capacity_hours: number };
  const cap = new Map<string, Cap & { month: string; discipline: string }>();
  for (const m of months) {
    const wd = weekdayCount(m);
    for (const t of team) {
      const leaveH = leaveMap.get(`${t.user}\t${m}`) ?? 0;
      const gross = (t.weekly_hours * wd) / 5;
      const capacity = Math.max(gross * (1 - t.non_client_share) - leaveH, 0);
      const key = `${m}\t${t.discipline}`;
      const cur = cap.get(key) ?? { month: m, discipline: t.discipline, gross_hours: 0, leave_hours: 0, capacity_hours: 0 };
      cur.gross_hours += gross;
      cur.leave_hours += leaveH;
      cur.capacity_hours += capacity;
      cap.set(key, cur);
    }
  }
  const actual = new Map<string, number>();
  for (const t of timeClean) {
    if (!t.month) continue;
    const discipline = disc.get(t.user) ?? "Unknown";
    const key = `${t.month}\t${discipline}`;
    actual.set(key, (actual.get(key) ?? 0) + t.hours);
  }
  const plannedMap = new Map<string, number>();
  for (const p of planned) {
    if (!p.monthPeriod) continue;
    const key = `${p.monthPeriod}\t${p.discipline || "Unassigned"}`;
    plannedMap.set(key, (plannedMap.get(key) ?? 0) + p.planned_hours);
  }
  return [...cap.values()]
    .map((row) => {
      const key = `${row.month}\t${row.discipline}`;
      const clientActual = actual.get(key) ?? 0;
      const clientPlanned = plannedMap.get(key) ?? 0;
      return {
        month: row.month,
        month_str: row.month,
        discipline: row.discipline,
        gross_hours: row.gross_hours,
        leave_hours: row.leave_hours,
        capacity_hours: row.capacity_hours,
        client_hours_actual: clientActual,
        client_hours_planned: clientPlanned,
        utilisation_pct: row.capacity_hours > 0 ? (clientActual / row.capacity_hours) * 100 : null,
        planned_load_pct: row.capacity_hours > 0 ? (clientPlanned / row.capacity_hours) * 100 : null,
        headroom_hours: row.capacity_hours - clientPlanned,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.discipline.localeCompare(b.discipline));
}
