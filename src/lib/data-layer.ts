import { extractOwnerFromDescription, hoursOnBoardLine, ownerName } from "./board-info";
import { ACTION_COLUMNS, INTERNAL_CLIENTS, isInternalClient } from "./constants";
import { asBool, cell, num, readCsv, tidy, writeCsv, type CsvRow } from "./csv";
import { addYears, fmt, nowIso, parseDate, today, type YMD } from "./dates";
import { bucketName, listObjects, supabaseConfigured, uploadLocalCsvs } from "./storage";

export const FILES = {
  contracts: "contracts.csv",
  seasonal_allocations: "seasonal_allocations.csv",
  time_entries: "everhour_time_entries.csv",
  planned_items: "monday_planned_items.csv",
  tracker: "standup_tracker.csv",
  client_mapping: "client_mapping.csv",
  team: "team_capacity.csv",
  leave: "team_leave.csv",
  refresh_log: "refresh_log.csv",
  actions: "actions_log.csv",
} as const;

export function filePath(key: keyof typeof FILES) {
  return FILES[key];
}

export type Contract = {
  contract_id: string;
  client: string;
  account_owner: string;
  contract_start: YMD;
  contract_end: YMD;
  effective_from: YMD;
  monthly_hours: number;
  billing_model: string;
  notes: string;
  service: string;
  contract_source: string;
  source_board_id: string;
};

export type TimeEntry = {
  entry_id: string;
  date: string;
  client: string;
  project: string;
  task_id: string;
  task_name: string;
  user: string;
  hours: number;
  billable: boolean;
  work_type: string;
  category: string;
};

export type PlannedRaw = {
  item_id: string;
  board_id: string;
  board_name: string;
  client: string;
  month: string;
  month_source: string;
  group: string;
  week: string;
  task_name: string;
  discipline: string;
  task_type: string;
  work_type: string;
  planned_hours: number;
  remaining_estimate_hours: number;
  status: string;
  owner: string;
  billable: boolean;
  billable_raw: string;
};

export type Loaded = {
  contracts: Contract[];
  contractsIncomplete: { client: string }[];
  seasonal: CsvRow[];
  timeEntries: TimeEntry[];
  plannedItems: PlannedRaw[];
  tracker: CsvRow[];
  clientMapping: CsvRow[];
  team: { user: string; discipline: string; weekly_hours: number; non_client_share: number }[];
  leave: { user: string; month: string; leave_hours: number }[];
  refreshLog: CsvRow[];
  actions: CsvRow[];
  clientInfo: CsvRow[];
  storage: "supabase" | "local";
  dataUpdatedAt: string;
};

const CLIENT_POD_DIRECTORY: Record<string, "Kayleigh" | "Sam"> = {
  // Pod Kayleigh
  "hacker": "Kayleigh",
  "ha cker": "Kayleigh",
  "häcker": "Kayleigh",
  "suited & booted": "Kayleigh",
  "pooky": "Kayleigh",
  "stanton aviation": "Kayleigh",
  "the gallery home": "Kayleigh",
  "breathe home maintenance": "Kayleigh",
  "haus & haus": "Kayleigh",
  "haus & haus holidays": "Kayleigh",
  "matw": "Kayleigh",

  // Pod Sam
  "bm steel / ims": "Sam",
  "bm steel": "Sam",
  "ims": "Sam",
  "frasers": "Sam",
  "mhdv": "Sam",
  "rldatix": "Sam",
  "lta": "Sam",
  "nixon peabody": "Sam",
  "nixon peabody trust company": "Sam",
  "swiftdoctor": "Sam",
  "brandpie": "Sam",
  "smart salem": "Sam",
  "green home systems": "Sam",
  "andrew wright windows": "Sam",
  "aztec group": "Sam",
  "aztec": "Sam",
  "magmutual": "Sam",
  "firmus energy": "Sam",
  "apetito": "Sam",
  "urisk": "Sam",
  "amicus": "Sam",
  "pwm": "Sam",
  "power of 0": "Sam",
};

export function resolveClientOwner(clientName: string, rawOwner?: string | null, notes?: string): "Kayleigh" | "Sam" {
  const norm = (s: string) => s.trim().toLowerCase();
  const raw = norm(rawOwner || "");
  if (raw.includes("kayleigh") || raw.includes("tamires") || raw.includes("luther") || raw.includes("gus")) {
    return "Kayleigh";
  }
  if (raw.includes("sam") || raw.includes("rod") || raw.includes("damien") || raw.includes("matt") || raw.includes("leah")) {
    return "Sam";
  }
  if (notes) {
    const fromNotes = extractOwnerFromDescription(notes);
    if (fromNotes) {
      const fn = norm(fromNotes);
      if (fn.includes("kayleigh") || fn.includes("tamires") || fn.includes("luther") || fn.includes("gus")) return "Kayleigh";
      if (fn.includes("sam") || fn.includes("rod") || fn.includes("damien") || fn.includes("matt") || fn.includes("leah")) return "Sam";
    }
  }
  const key = norm(clientName);
  for (const [pattern, pod] of Object.entries(CLIENT_POD_DIRECTORY)) {
    if (key === pattern || key.includes(pattern) || pattern.includes(key)) {
      return pod;
    }
  }
  return "Kayleigh";
}

function cleanContracts(rows: CsvRow[], source: string): { ok: Contract[]; bad: { client: string }[] } {
  const openEnd = addYears(today(), 5);
  const ok: Contract[] = [];
  const bad: { client: string }[] = [];
  for (const row of rows) {
    const client = tidy(cell(row, "client")).normalize("NFC");
    if (!client || isInternalClient(client)) continue;
    const start = parseDate(cell(row, "contract_start"));
    const end = parseDate(cell(row, "contract_end")) ?? openEnd;
    const effective = parseDate(cell(row, "effective_from")) ?? start;
    const hours = boardHours(row) ?? num(cell(row, "monthly_hours"));
    const notes = cell(row, "notes");
    const owner = resolveClientOwner(client, cell(row, "account_owner"), notes);
    let billing = cell(row, "billing_model");
    if (!billing) billing = "Standard";
    let contractId = cell(row, "contract_id");
    if (!contractId) contractId = `C-${client}`;
    if (!start || !effective || hours == null) {
      bad.push({ client });
      continue;
    }
    ok.push({
      contract_id: contractId,
      client,
      account_owner: owner,
      contract_start: start,
      contract_end: end,
      effective_from: effective,
      monthly_hours: hours,
      billing_model: billing,
      notes,
      service: cell(row, "service"),
      contract_source: source,
      source_board_id: cell(row, "source_board_id"),
    });
  }
  return { ok, bad };
}

/** Re-read a stored Monday line so "65hrs (SEO) / 21hrs (Paid)" stays a sum, not the first number. */
function boardHours(row: CsvRow): number | null {
  const prefix = "From Monday board description:";
  const notes = cell(row, "notes");
  if (!notes.startsWith(prefix)) return null;
  const raw = notes.slice(prefix.length).trim();
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  return hoursOnBoardLine(raw.slice(idx + 1));
}

function mergeContracts(manualRows: CsvRow[], mondayRows: CsvRow[]): { contracts: Contract[]; incomplete: { client: string }[] } {
  const manual = cleanContracts(manualRows, "contracts.csv");
  const monday = mondayRows.length ? cleanContracts(mondayRows, "Monday board description") : { ok: [], bad: [] };
  // Monday board descriptions are the hours the account teams maintain.
  // contracts.csv only covers clients whose board has no readable hours line.
  const mondayClients = new Set(monday.ok.map((c) => c.client));
  const manualOnly = manual.ok.filter((c) => !mondayClients.has(c.client));
  const mondayBad = monday.bad;
  const covered = new Set<string>([...mondayClients, ...manualOnly.map((c) => c.client)]);
  const internal = new Set(INTERNAL_CLIENTS);
  const seen = new Set<string>();
  const incomplete: { client: string }[] = [];
  for (const row of [...manual.bad, ...mondayBad]) {
    if (covered.has(row.client) || internal.has(row.client) || seen.has(row.client)) continue;
    seen.add(row.client);
    incomplete.push(row);
  }
  return { contracts: [...monday.ok, ...manualOnly], incomplete };
}

function applyBoardClients(planned: PlannedRaw[], boards: CsvRow[]): PlannedRaw[] {
  const lookup = new Map<string, string>();
  for (const r of boards) {
    const id = cell(r, "board_id").replace(/\.0$/, "");
    const client = tidy(cell(r, "client"));
    if (id && client) lookup.set(id, client);
  }
  if (!lookup.size) return planned;
  return planned.map((p) => {
    const id = String(p.board_id).trim().replace(/\.0$/, "");
    const mapped = lookup.get(id);
    return mapped ? { ...p, client: mapped } : p;
  });
}

function loadPlanned(rows: CsvRow[]): PlannedRaw[] {
  return rows.map((r) => ({
    item_id: cell(r, "item_id"),
    board_id: cell(r, "board_id").replace(/\.0$/, ""),
    board_name: cell(r, "board_name"),
    client: cell(r, "client"),
    month: cell(r, "month"),
    month_source: cell(r, "month_source"),
    group: cell(r, "group"),
    week: cell(r, "week"),
    task_name: cell(r, "task_name"),
    discipline: cell(r, "discipline"),
    task_type: cell(r, "task_type"),
    work_type: cell(r, "work_type"),
    planned_hours: num(cell(r, "planned_hours")) ?? 0,
    remaining_estimate_hours: num(cell(r, "remaining_estimate_hours")) ?? 0,
    status: cell(r, "status"),
    owner: cell(r, "owner"),
    billable: r.billable == null || r.billable === "" ? true : asBool(r.billable),
    billable_raw: cell(r, "billable_raw") || "Not set",
  }));
}

let cache: { sig: string; data: Loaded } | null = null;
let seeded = false;

function fileSignature(files: { name: string; updated_at: string; size: number }[]): string {
  return files
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `${f.name}:${f.updated_at}:${f.size}`)
    .join("|");
}

async function ensureStored() {
  const present = new Set((await listObjects()).map((f) => f.name));
  if (present.has("contracts.csv")) return;
  if (supabaseConfigured() && !seeded) {
    seeded = true;
    await uploadLocalCsvs();
  }
}

export async function loadAll(): Promise<Loaded> {
  await ensureStored();
  const files = await listObjects();
  const sig = fileSignature(files);
  if (cache && cache.sig === sig) return cache.data;

  const required = ["contracts", "time_entries", "planned_items", "refresh_log"] as const;
  const present = new Set(files.map((f) => f.name));
  const dataUpdatedAt = files.reduce((max, f) => (f.updated_at > max ? f.updated_at : max), "");
  const missing = required.filter((k) => !present.has(FILES[k]));
  if (missing.length) {
    const where = supabaseConfigured() ? `Supabase bucket "${bucketName()}"` : "data_files";
    throw new Error(`Missing ${missing.map((k) => FILES[k]).join(", ")} in ${where}.`);
  }
  if (!present.has(FILES.actions)) {
    await writeCsv(FILES.actions, [], [...ACTION_COLUMNS]);
  }

  const [
    contracts,
    mondayContracts,
    seasonal,
    timeEntries,
    plannedItems,
    boards,
    tracker,
    clientMapping,
    team,
    leave,
    refreshLog,
    actions,
    clientInfo,
  ] = await Promise.all([
    readCsv(FILES.contracts),
    readCsv("contracts_from_monday.csv"),
    readCsv(FILES.seasonal_allocations),
    readCsv(FILES.time_entries),
    readCsv(FILES.planned_items),
    readCsv("monday_boards.csv"),
    readCsv(FILES.tracker),
    readCsv(FILES.client_mapping),
    readCsv(FILES.team),
    readCsv(FILES.leave),
    readCsv(FILES.refresh_log),
    readCsv(FILES.actions),
    readCsv("client_info.csv"),
  ]);

  const merged = mergeContracts(contracts, mondayContracts);
  const data: Loaded = {
    contracts: merged.contracts,
    contractsIncomplete: merged.incomplete,
    seasonal: seasonal.filter((r) => !isInternalClient(cell(r, "client"))),
    timeEntries: timeEntries
      .filter((r) => !isInternalClient(cell(r, "client")))
      .map((r) => ({
        entry_id: cell(r, "entry_id"),
        date: cell(r, "date"),
        client: cell(r, "client"),
        project: cell(r, "project"),
        task_id: cell(r, "task_id"),
        task_name: cell(r, "task_name"),
        user: cell(r, "user"),
        hours: num(cell(r, "hours")) ?? 0,
        billable: asBool(r.billable),
        work_type: cell(r, "work_type"),
        category: cell(r, "category"),
      })),
    plannedItems: applyBoardClients(loadPlanned(plannedItems), boards).filter((p) => !isInternalClient(p.client)),
    tracker: tracker.filter((r) => !isInternalClient(cell(r, "client"))),
    clientMapping: clientMapping.filter(
      (r) => !isInternalClient(cell(r, "canonical_client")) && !isInternalClient(cell(r, "source_name")),
    ),
    team: team.map((r) => ({
      user: cell(r, "user"),
      discipline: cell(r, "discipline"),
      weekly_hours: num(cell(r, "weekly_hours")) ?? 0,
      non_client_share: num(cell(r, "non_client_share")) ?? 0,
    })),
    leave: leave.flatMap((r) => {
      const month = cell(r, "month");
      const user = cell(r, "user");
      const leave_hours = num(cell(r, "leave_hours"));
      if (!user || !month || leave_hours == null) return [];
      return [{ user, month, leave_hours }];
    }),
    refreshLog,
    actions: actions.filter((r) => !isInternalClient(cell(r, "client"))),
    clientInfo: clientInfo
      .filter((r) => !isInternalClient(cell(r, "client")))
      .map((r) => {
        const c = cell(r, "client");
        const currentOwner = cell(r, "owner");
        const desc = cell(r, "description");
        const resolved = resolveClientOwner(c, currentOwner, desc);
        return {
          ...r,
          owner: resolved || currentOwner,
        };
      }),
    storage: supabaseConfigured() ? "supabase" : "local",
    dataUpdatedAt,
  };
  cache = { sig, data };
  return data;
}

export function invalidateCache() {
  cache = null;
}

export async function saveActions(edited: Record<string, unknown>[]) {
  const existing = await readCsv(filePath("actions"));
  const textCols = ["reason", "nature", "action", "owner", "notes"];
  const stamp = nowIso();
  const fresh: Record<string, unknown>[] = [];
  for (const row of edited) {
    const hasText = textCols.some((c) => String(row[c] ?? "").trim() !== "");
    const deadline = parseDate(row.deadline);
    const status = String(row.status ?? "Open");
    if (!hasText && !deadline && status === "Open") continue;
    const out: Record<string, unknown> = {};
    for (const c of ACTION_COLUMNS) out[c] = row[c] ?? "";
    out.updated_at = stamp;
    out.deadline = deadline ? fmt(deadline) : "";
    fresh.push(out);
  }
  if (!fresh.length) return;
  await writeCsv(filePath("actions"), [...existing, ...fresh], [...ACTION_COLUMNS]);
  invalidateCache();
}

export async function updateRefreshLog(source: string, periodStart: string, periodEnd: string, status = "OK") {
  const log = await readCsv(filePath("refresh_log"));
  const next = log.filter((r) => r.source !== source);
  next.push({
    source,
    last_success: nowIso(),
    period_start: periodStart,
    period_end: periodEnd,
    status,
  });
  await writeCsv(filePath("refresh_log"), next, ["source", "last_success", "period_start", "period_end", "status"]);
  invalidateCache();
}
