import { BILLABLE_VIEWS, REASONS, NATURE, ACTIONS, ACTION_STATUS } from "./constants";
import { dataSource } from "./config";
import { cell } from "./csv";
import { loadAll } from "./data-layer";
import { storageNote } from "./storage";
import { fmt } from "./dates";
import { buildFactTable, freshnessStatus } from "./metrics";
import { capacityByDiscipline, everhourVsTracker, unmappedClients, workTypeSplit } from "./reconciliation";
import type { ClientInfo, ContractRow, DashboardPayload } from "./types";

export async function getDashboard(workTypes: string[], billableView: string, threshold: number): Promise<DashboardPayload> {
  const data = await loadAll();
  if (!data.contracts.length) {
    const err = new Error(
      "No complete contracts yet. Fill contract_start and monthly_hours in contracts.csv, then reload.",
    );
    err.name = "NoContracts";
    throw err;
  }
  const built = buildFactTable(data, workTypes, billableView, threshold, threshold);
  const canonical = new Set(data.contracts.map((c) => c.client));
  const workTypesFound = new Set<string>(["Retainer", "Project"]);
  for (const t of data.timeEntries) workTypesFound.add((t.work_type || "").trim() || "Unclassified");

  const contracts: ContractRow[] = data.contracts.map((c) => ({
    contract_id: c.contract_id,
    client: c.client,
    account_owner: c.account_owner,
    contract_start: fmt(c.contract_start),
    contract_end: fmt(c.contract_end),
    effective_from: fmt(c.effective_from),
    monthly_hours: c.monthly_hours,
    billing_model: c.billing_model,
    notes: c.notes,
    service: c.service,
    contract_source: c.contract_source,
  }));

  const clientInfo: ClientInfo[] = data.clientInfo.map((r) => ({
    client: cell(r, "client"),
    board_id: cell(r, "board_id"),
    board_name: cell(r, "board_name"),
    owner: cell(r, "owner"),
    support: cell(r, "support"),
    escalation: cell(r, "escalation"),
    start_date: cell(r, "start_date"),
    hours_lines: cell(r, "hours_lines"),
    total_monthly_hours: cell(r, "total_monthly_hours"),
    email: cell(r, "email"),
    website: cell(r, "website"),
    contract_link: cell(r, "contract_link"),
    digital_plan: cell(r, "digital_plan"),
    brand_guidelines: cell(r, "brand_guidelines"),
    client_guide: cell(r, "client_guide"),
    other_links: cell(r, "other_links"),
    parse_issues: cell(r, "parse_issues"),
  }));

  const monthSource = new Map<string, { client: string; month_source: string; items: number; hours: number }>();
  for (const p of built.planned) {
    const key = `${p.client}\t${p.month_source}`;
    const cur = monthSource.get(key) ?? { client: p.client, month_source: p.month_source, items: 0, hours: 0 };
    cur.items += 1;
    cur.hours += p.planned_hours;
    monthSource.set(key, cur);
  }

  return {
    dataSource: dataSource(),
    storage: data.storage,
    dataUpdatedAt: data.dataUpdatedAt,
    storageNote: storageNote(),
    billableViews: [...BILLABLE_VIEWS],
    reasons: REASONS,
    nature: NATURE,
    actions: ACTIONS,
    actionStatus: ACTION_STATUS,
    workTypeOptions: [...workTypesFound].sort(),
    months: built.months,
    current: built.current,
    today: built.today,
    incompleteClients: data.contractsIncomplete.map((c) => c.client).sort(),
    freshness: freshnessStatus(data.refreshLog),
    fact: built.fact,
    contracts,
    clientInfo,
    planned: built.planned,
    plannedNoMonth: built.plannedNoMonth,
    duplicates: built.duplicates,
    unclassified: built.unclassified,
    recon: everhourVsTracker(built.timeClean, data.tracker, data.clientMapping),
    unmapped: unmappedClients(data, canonical),
    mapping: data.clientMapping.map((r) => ({
      source: cell(r, "source"),
      source_name: cell(r, "source_name"),
      canonical_client: cell(r, "canonical_client"),
    })),
    workSplit: workTypeSplit(built.timeClean),
    capacity: capacityByDiscipline(data.team, data.leave, built.timeClean, built.plannedClean, built.months),
    actionsLog: data.actions.map((r) => ({
      client: cell(r, "client"),
      month: cell(r, "month"),
      flag_type: cell(r, "flag_type"),
      direction: cell(r, "direction"),
      variance_pct: cell(r, "variance_pct"),
      reason: cell(r, "reason"),
      nature: cell(r, "nature"),
      action: cell(r, "action"),
      owner: cell(r, "owner"),
      deadline: cell(r, "deadline"),
      hours_adjustment: cell(r, "hours_adjustment"),
      status: cell(r, "status"),
      notes: cell(r, "notes"),
      updated_at: cell(r, "updated_at"),
    })),
    monthSource: [...monthSource.values()].sort((a, b) => a.client.localeCompare(b.client) || a.month_source.localeCompare(b.month_source)),
    categories: built.categories,
  };
}
