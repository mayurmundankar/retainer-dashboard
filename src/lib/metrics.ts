import { canonicalIndex, clientKey, resolveClient } from "./clients";
import {
  CTD_PRORATE_CURRENT_MONTH,
  CTD_THRESHOLD_PCT,
  DELIVERY_STATUS_BLOCKED,
  DELIVERY_STATUS_DONE,
  EVERHOUR_NONBILLABLE_MARKERS,
  HISTORY_START,
  PRORATE_PARTIAL_MONTHS,
  STALE_AFTER_HOURS,
  VARIANCE_THRESHOLD_PCT,
  isInternalClient,
} from "./constants";
import type { CsvRow } from "./csv";
import { cell, num } from "./csv";
import type { Contract, Loaded, PlannedRaw, TimeEntry } from "./data-layer";
import {
  addDays,
  cmp,
  daysInMonth,
  diffDays,
  fmt,
  maxD,
  minD,
  monthEnd,
  monthStart,
  parseDate,
  parseMonth,
  periodRange,
  toPeriod,
  today,
  type YMD,
} from "./dates";
import type { Fact, PlannedItem } from "./types";

type MappedTime = TimeEntry & { client_raw: string; month: string | null; ymd: YMD | null };
type MappedPlanned = PlannedRaw & { client_raw: string; monthPeriod: string | null };

function mappingLookup(mapping: CsvRow[], source: string) {
  const lookup = new Map<string, string>();
  for (const row of mapping) {
    if (cell(row, "source").toLowerCase() !== source.toLowerCase()) continue;
    const name = clientKey(cell(row, "source_name"));
    const canonical = cell(row, "canonical_client").normalize("NFC").trim();
    if (name && canonical) lookup.set(name, canonical);
  }
  return lookup;
}

function mapClient(raw: string, lookup: Map<string, string>, canonical: Map<string, string>) {
  const trimmed = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  return { client_raw: trimmed, client: resolveClient(trimmed, lookup, canonical) };
}

function pulseId(id: string): string | null {
  const match = id.match(/(\d{6,})$/);
  return match ? match[1] : null;
}

export function prepareTime(entries: TimeEntry[], mapping: CsvRow[], canonicalNames: string[] = []) {
  const lookup = mappingLookup(mapping, "everhour");
  const canonical = canonicalIndex(canonicalNames);
  const mapped: MappedTime[] = entries
    .filter((e) => !isInternalClient(e.client))
    .map((e) => {
      const names = mapClient(e.client, lookup, canonical);
      const ymd = parseDate(e.date);
      const work = e.work_type.trim() || "Unclassified";
      const isNonBillableMarker = EVERHOUR_NONBILLABLE_MARKERS.some((m) =>
        `${e.project} ${e.task_name} ${e.category}`.toLowerCase().includes(m.toLowerCase())
      );
      const billable = isNonBillableMarker ? false : e.billable;
      return {
        ...e,
        ...names,
        billable,
        work_type: work,
        ymd,
        month: ymd ? toPeriod(ymd) : null,
      };
    })
    .filter((e) => !isInternalClient(e.client));
  const seen = new Set<string>();
  const clean: MappedTime[] = [];
  const duplicates: MappedTime[] = [];
  for (const row of mapped) {
    if (!row.entry_id) {
      clean.push(row);
      continue;
    }
    if (seen.has(row.entry_id)) duplicates.push(row);
    else {
      seen.add(row.entry_id);
      clean.push(row);
    }
  }
  return { clean, duplicates };
}

export function preparePlanned(items: PlannedRaw[], mapping: CsvRow[], canonicalNames: string[] = []) {
  const lookup = mappingLookup(mapping, "monday");
  const canonical = canonicalIndex(canonicalNames);
  const all: MappedPlanned[] = items
    .filter((item) => !isInternalClient(item.client))
    .map((item) => {
      const names = mapClient(item.client, lookup, canonical);
      const work = item.work_type.trim() || "Unclassified";
      return { ...item, ...names, work_type: work, monthPeriod: parseMonth(item.month) };
    })
    .filter((item) => !isInternalClient(item.client));
  return {
    planned: all.filter((p) => p.monthPeriod),
    noMonth: all.filter((p) => !p.monthPeriod),
  };
}

function billableFilter<T extends { billable: boolean }>(rows: T[], view: string): T[] {
  if (view === "Billable only") return rows.filter((r) => r.billable);
  if (view === "Non-billable only") return rows.filter((r) => !r.billable);
  return rows;
}

type Range = Contract & { eff_start: YMD; eff_end: YMD };

function effectiveRanges(contracts: Contract[]): Range[] {
  const groups = new Map<string, Contract[]>();
  for (const c of contracts) {
    const list = groups.get(c.contract_id);
    if (list) list.push(c);
    else groups.set(c.contract_id, [c]);
  }
  const out: Range[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => cmp(a.effective_from, b.effective_from));
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const nxt = sorted[i + 1];
      const effectiveTo = nxt ? addDays(nxt.effective_from, -1) : r.contract_end;
      out.push({
        ...r,
        eff_start: maxD(r.effective_from, r.contract_start),
        eff_end: minD(effectiveTo, r.contract_end),
      });
    }
  }
  return out;
}

type MonthContract = {
  client: string;
  month: string;
  contract_id: string;
  contracted_hours: number;
  partial_month: boolean;
  account_owner: string;
  billing_model: string;
  contract_start: string;
  contract_end: string;
};

function contractedByMonth(contracts: Contract[], months: string[], prorate = PRORATE_PARTIAL_MONTHS): MonthContract[] {
  const ranges = effectiveRanges(contracts);
  type Acc = {
    client: string;
    month: string;
    contract_id: string;
    contracted_hours: number;
    active_days: number;
    days_in_month: number;
    account_owner: string;
    billing_model: string;
    contract_start: string;
    contract_end: string;
  };
  const per = new Map<string, Acc>();
  for (const r of ranges) {
    for (const m of months) {
      const ms = monthStart(m);
      const me = monthEnd(m);
      const s = maxD(ms, r.eff_start);
      const e = minD(me, r.eff_end);
      if (cmp(s, e) > 0) continue;
      const days = diffDays(s, e) + 1;
      const dim = daysInMonth(ms.y, ms.m);
      const hrs = prorate ? (r.monthly_hours * days) / dim : r.monthly_hours;
      const key = `${r.client}\t${m}\t${r.contract_id}`;
      const cur = per.get(key);
      if (!cur) {
        per.set(key, {
          client: r.client,
          month: m,
          contract_id: r.contract_id,
          contracted_hours: hrs,
          active_days: days,
          days_in_month: dim,
          account_owner: r.account_owner,
          billing_model: r.billing_model,
          contract_start: fmt(r.contract_start),
          contract_end: fmt(r.contract_end),
        });
      } else {
        cur.contracted_hours += hrs;
        cur.active_days += days;
      }
    }
  }

  const byClientMonth = new Map<string, Acc[]>();
  for (const row of per.values()) {
    const key = `${row.client}\t${row.month}`;
    const list = byClientMonth.get(key);
    if (list) list.push(row);
    else byClientMonth.set(key, [row]);
  }
  const out: MonthContract[] = [];
  for (const rows of byClientMonth.values()) {
    rows.sort((a, b) => b.active_days - a.active_days);
    const top = rows[0];
    out.push({
      client: top.client,
      month: top.month,
      contract_id: top.contract_id,
      contracted_hours: rows.reduce((s, r) => s + r.contracted_hours, 0),
      partial_month: rows.some((r) => r.active_days < r.days_in_month),
      account_owner: top.account_owner,
      billing_model: top.billing_model,
      contract_start: top.contract_start,
      contract_end: top.contract_end,
    });
  }
  return out;
}

function flag(pct: number | null, thr: number): "Over" | "Under" | "Within" {
  if (pct == null || Number.isNaN(pct)) return "Within";
  if (pct > thr) return "Over";
  if (pct < -thr) return "Under";
  return "Within";
}

function statusLabel(monthly: string, ctd: string): string {
  if (monthly === "Data missing") return "⚪ Data issue";
  if (monthly === "Over") return "🔴 Over-servicing";
  if (monthly === "Under") return "🟠 Under-servicing";
  if (ctd === "Over") return "🟡 Over (contract-to-date)";
  if (ctd === "Under") return "🟡 Under (contract-to-date)";
  return "🟢 On track";
}

function sumInto(map: Map<string, number>, key: string, hours: number) {
  map.set(key, (map.get(key) ?? 0) + hours);
}

export function buildFactTable(
  data: Loaded,
  workTypes: string[],
  billableView: string,
  threshold = VARIANCE_THRESHOLD_PCT,
  ctdThreshold = CTD_THRESHOLD_PCT,
  now: YMD = today(),
) {
  const current = toPeriod(now);
  const canonicalNames = data.contracts.map((c) => c.client).filter((c) => !isInternalClient(c));
  const { clean: timeClean, duplicates } = prepareTime(data.timeEntries, data.clientMapping, canonicalNames);
  const { planned, noMonth } = preparePlanned(data.plannedItems, data.clientMapping, canonicalNames);

  const contractStarts = data.contracts.map((c) => toPeriod(c.contract_start)).sort();
  const firstContract = contractStarts[0];
  const timeMonths = timeClean.map((t) => t.month).filter((m): m is string => !!m).sort();
  const firstTime = timeMonths[0];
  let first = HISTORY_START ?? (firstTime ? (firstContract > firstTime ? firstContract : firstTime) : firstContract);
  if (first > current) first = current;
  const months = first ? periodRange(first, current) : [];

  const seasonal = new Map<string, number>();
  for (const row of data.seasonal) {
    const month = parseMonth(cell(row, "month"));
    const hours = num(cell(row, "allocated_hours"));
    const client = cell(row, "client").trim();
    if (month && hours != null && client) seasonal.set(`${client}\t${month}`, hours);
  }

  const workSet = new Set(workTypes);
  const te = timeClean.filter((t) => t.month && workSet.has(t.work_type));
  const teView = billableFilter(te, billableView);

  const actual = new Map<string, number>();
  for (const t of teView) sumInto(actual, `${t.client}\t${t.month}`, t.hours);
  const entryCount = new Map<string, number>();
  for (const t of timeClean) {
    if (!t.month) continue;
    entryCount.set(`${t.client}\t${t.month}`, (entryCount.get(`${t.client}\t${t.month}`) ?? 0) + 1);
  }

  const nb = new Map<string, Record<string, number>>();
  const nbTotal = new Map<string, number>();
  const categories = new Set<string>();
  for (const t of te) {
    if (t.billable || !t.month) continue;
    const key = `${t.client}\t${t.month}`;
    const cat = t.category || "Uncategorised";
    categories.add(cat);
    const rec = nb.get(key) ?? {};
    rec[cat] = (rec[cat] ?? 0) + t.hours;
    nb.set(key, rec);
    sumInto(nbTotal, key, t.hours);
  }

  const loggedOnItem = new Map<string, number>();
  for (const t of teView) {
    const id = pulseId(t.task_id);
    if (!id || !t.month) continue;
    sumInto(loggedOnItem, `${id}\t${t.month}`, t.hours);
  }

  const openHours = (item: { item_id: string; monthPeriod: string | null; status: string; planned_hours: number }) => {
    if (DELIVERY_STATUS_DONE.includes(item.status)) return 0;
    const id = pulseId(item.item_id);
    const logged = id && item.monthPeriod ? (loggedOnItem.get(`${id}\t${item.monthPeriod}`) ?? 0) : 0;
    return Math.max(0, Math.round((item.planned_hours - logged) * 100) / 100);
  };

  const p = billableFilter(
    planned.filter((item) => item.monthPeriod && workSet.has(item.work_type)),
    billableView,
  );
  type PlanAcc = {
    planned_hours: number;
    remaining_estimate: number;
    deliverables_total: number;
    deliverables_done: number;
    deliverables_blocked: number;
  };
  const plan = new Map<string, PlanAcc>();
  for (const item of p) {
    const key = `${item.client}\t${item.monthPeriod}`;
    const done = DELIVERY_STATUS_DONE.includes(item.status);
    const blocked = DELIVERY_STATUS_BLOCKED.includes(item.status);
    const cur = plan.get(key) ?? {
      planned_hours: 0,
      remaining_estimate: 0,
      deliverables_total: 0,
      deliverables_done: 0,
      deliverables_blocked: 0,
    };
    cur.planned_hours += item.planned_hours;
    cur.remaining_estimate += openHours(item);
    cur.deliverables_total += 1;
    cur.deliverables_done += done ? 1 : 0;
    cur.deliverables_blocked += blocked ? 1 : 0;
    plan.set(key, cur);
  }

  const base = contractedByMonth(
    data.contracts.filter((c) => !isInternalClient(c.client)),
    months,
  );
  const fact: Fact[] = base.map((row) => {
    const key = `${row.client}\t${row.month}`;
    const entries = entryCount.get(key) ?? 0;
    const dataMissing = entries === 0 && row.contracted_hours > 0;
    const actualHours = dataMissing ? null : (actual.get(key) ?? 0);
    const plannedRow = plan.get(key);
    const isCurrent = row.month === current;
    const remaining = isCurrent ? (plannedRow?.remaining_estimate ?? 0) : 0;
    const forecast = actualHours == null ? null : actualHours + remaining;
    const allocated = seasonal.get(key) ?? row.contracted_hours;
    const varianceHours = forecast == null ? null : forecast - allocated;
    const variancePct = allocated > 0 && varianceHours != null ? (varianceHours / allocated) * 100 : null;
    const nbRow: Record<string, number> = {};
    for (const cat of categories) nbRow[cat] = nb.get(key)?.[cat] ?? 0;
    const done = plannedRow?.deliverables_done ?? 0;
    const blocked = plannedRow?.deliverables_blocked ?? 0;
    const total = plannedRow?.deliverables_total ?? 0;
    return {
      client: row.client,
      month: row.month,
      month_str: row.month,
      status: "",
      account_owner: row.account_owner,
      billing_model: row.billing_model,
      contract_id: row.contract_id,
      contract_start: row.contract_start,
      contract_end: row.contract_end,
      contracted_hours: row.contracted_hours,
      allocated_hours: allocated,
      planned_hours: plannedRow?.planned_hours ?? 0,
      actual_hours: actualHours,
      remaining_estimate: remaining,
      forecast_hours: forecast,
      variance_hours: varianceHours,
      variance_pct: variancePct,
      ctd_contracted: 0,
      ctd_actual: 0,
      ctd_variance_hours: 0,
      ctd_variance_pct: null,
      ctd_missing_months: 0,
      nonbillable_hours: nbTotal.get(key) ?? 0,
      nb: nbRow,
      deliverables_total: total,
      deliverables_done: done,
      deliverables_outstanding: total - done - blocked,
      deliverables_blocked: blocked,
      partial_month: row.partial_month,
      data_missing: dataMissing,
      monthly_flag: "",
      ctd_flag: "",
      review_required: false,
      is_current_month: isCurrent,
    };
  });

  fact.sort((a, b) => a.client.localeCompare(b.client) || a.month.localeCompare(b.month));
  const elapsed = now.d / daysInMonth(now.y, now.m);
  const acc = new Map<string, { ctdC: number; ctdA: number; miss: number }>();
  for (const row of fact) {
    const key = `${row.client}\t${row.contract_id}`;
    const prev = acc.get(key) ?? { ctdC: 0, ctdA: 0, miss: 0 };
    const basis = CTD_PRORATE_CURRENT_MONTH && row.is_current_month ? row.contracted_hours * elapsed : row.contracted_hours;
    const ctdC = prev.ctdC + basis;
    const ctdA = prev.ctdA + (row.actual_hours ?? 0);
    const miss = prev.miss + (row.data_missing ? 1 : 0);
    acc.set(key, { ctdC, ctdA, miss });
    row.ctd_contracted = ctdC;
    row.ctd_actual = ctdA;
    row.ctd_missing_months = miss;
    row.ctd_variance_hours = ctdA - ctdC;
    row.ctd_variance_pct = ctdC > 0 ? ((ctdA - ctdC) / ctdC) * 100 : null;
    row.monthly_flag = row.data_missing ? "Data missing" : flag(row.variance_pct, threshold);
    row.ctd_flag = flag(row.ctd_variance_pct, ctdThreshold);
    row.review_required =
      row.monthly_flag === "Over" ||
      row.monthly_flag === "Under" ||
      row.monthly_flag === "Data missing" ||
      row.ctd_flag === "Over" ||
      row.ctd_flag === "Under";
    row.status = statusLabel(row.monthly_flag, row.ctd_flag);
  }

  const plannedItems: PlannedItem[] = planned.map((p) => ({
    item_id: p.item_id,
    board_id: p.board_id,
    client: p.client,
    month: p.monthPeriod || "",
    task_name: p.task_name,
    discipline: p.discipline,
    owner: p.owner,
    status: p.status,
    planned_hours: p.planned_hours,
    remaining_estimate_hours: openHours(p),
    work_type: p.work_type,
    month_source: p.month_source,
    billable_raw: p.billable_raw,
    billable: p.billable,
    group: p.group,
  }));

  return {
    fact,
    months,
    current,
    today: fmt(now),
    categories: [...categories].sort(),
    duplicates: duplicates.map(serializeTime),
    unclassified: timeClean.filter((t) => t.work_type === "Unclassified").map(serializeTime),
    planned: plannedItems,
    plannedNoMonth: noMonth.map((p) => ({
      item_id: p.item_id,
      board_id: p.board_id,
      client: p.client,
      task_name: p.task_name,
      group: p.group,
      status: p.status,
      planned_hours: String(p.planned_hours),
      month_source: p.month_source,
    })),
    timeClean,
    plannedClean: planned,
  };
}

function serializeTime(t: MappedTime): Record<string, string> {
  return {
    entry_id: t.entry_id,
    date: t.date,
    client: t.client,
    project: t.project,
    task_name: t.task_name,
    user: t.user,
    hours: String(t.hours),
    billable: String(t.billable),
    work_type: t.work_type,
    category: t.category,
  };
}

export function freshnessStatus(rows: CsvRow[], now = new Date()) {
  return rows.map((r) => {
    const status = cell(r, "status") || "Unknown";
    const raw = cell(r, "last_success");
    const parsed = raw
      ? (() => {
          const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
          if (!m) return null;
          const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0;
          return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
        })()
      : null;
    const age = parsed ? (now.getTime() - parsed.getTime()) / 3600000 : null;
    const source = cell(r, "source");
    const stale = (age == null || age > STALE_AFTER_HOURS) && source !== "Contracts";
    const ok = status.toLowerCase() === "ok";
    return {
      source,
      last_success: raw,
      period_start: cell(r, "period_start"),
      period_end: cell(r, "period_end"),
      status,
      age_hours: age,
      stale,
      state: stale || !ok ? "⚠️ Check" : "✅ Fresh",
    };
  });
}
