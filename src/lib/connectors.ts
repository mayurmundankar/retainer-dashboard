import {
  CLIENT_INFO_COLUMNS,
  CONTRACT_COLUMNS,
  DELIVERY_STATUS_DONE,
  EVERHOUR_NONBILLABLE_MARKERS,
  MONDAY_CLIENT_FROM_BOARD_NAME,
  MONDAY_COLUMN_TITLES,
  MONDAY_DEFAULT_WORK_TYPE,
  MONDAY_NONBILLABLE_VALUES,
} from "./constants";
import { boardClientLookup, everhourApiKey, mondayApiToken, mondayBoardIds } from "./config";
import { cell, num, readCsv, writeCsv } from "./csv";
import { filePath, updateRefreshLog } from "./data-layer";
import { monthStart, parseMonth, today } from "./dates";
import { buildContractsFromBoards, type BoardContract, type BoardInfo } from "./board-info";

const EVERHOUR_URL = "https://api.everhour.com";
const MONDAY_URL = "https://api.monday.com/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function everhourGet(endpoint: string, apiKey: string, params?: Record<string, string>) {
  const url = new URL(EVERHOUR_URL + endpoint);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Everhour ${endpoint} failed (${res.status})`);
  return res.json();
}

export async function fetchEverhourTime(apiKey: string, dateFrom: string, dateTo: string) {
  const users = new Map<string, string>();
  for (const u of (await everhourGet("/team/users", apiKey)) as { id: string | number; name?: string }[]) {
    users.set(String(u.id), u.name || String(u.id));
  }
  const projects = new Map<string, { name?: string }>();
  for (const p of (await everhourGet("/projects", apiKey)) as { id: string | number; name?: string }[]) {
    projects.set(String(p.id), p);
  }
  const clients = (await everhourGet("/clients", apiKey)) as { name: string; projects?: (string | number)[] }[];
  const projectClient = new Map<string, string>();
  for (const c of clients) for (const pid of c.projects ?? []) projectClient.set(String(pid), c.name);

  const records = (await everhourGet("/team/time", apiKey, { from: dateFrom, to: dateTo })) as Record<string, unknown>[];
  return records.map((rec) => {
    const task = (rec.task ?? {}) as { projects?: (string | number)[]; name?: string; id?: string | number };
    const pid = task.projects?.[0];
    const pname = pid != null ? projects.get(String(pid))?.name ?? "" : "";
    const tname = task.name ?? "";
    const label = `${pname} ${tname}`;
    const lower = label.toLowerCase();
    const nonbillable = EVERHOUR_NONBILLABLE_MARKERS.some((m) => lower.includes(m.toLowerCase()));
    const category = lower.includes("senior support")
      ? "Senior support"
      : lower.includes("rework")
        ? "Rework"
        : lower.includes("meeting")
          ? "Meetings"
          : "Delivery";
    const seconds = Number(rec.time ?? 0);
    return {
      entry_id: `EH-${rec.id ?? ""}`,
      date: String(rec.date ?? ""),
      client: (pid != null ? projectClient.get(String(pid)) : "") || pname,
      project: pname,
      task_id: String(task.id ?? ""),
      task_name: tname,
      user: users.get(String(rec.user ?? "")) ?? String(rec.user ?? ""),
      hours: Math.round((seconds / 3600) * 100) / 100,
      billable: nonbillable ? "False" : "True",
      work_type: pname.toLowerCase().includes("project") && !pname.toLowerCase().includes("retainer") ? "Project" : "Retainer",
      category,
    };
  });
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
for (const [k, v] of Object.entries({ ...MONTH_NAMES })) MONTH_NAMES[k.slice(0, 3)] = v;
MONTH_NAMES.sept = 9;

function monthFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const names = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.join("|")})[a-z]*\\.?\\s*(\\d{4}|\\d{2})?\\b`, "i");
  const m = text.toLowerCase().match(re);
  if (!m) return null;
  const month = MONTH_NAMES[m[1]];
  let year: number;
  if (!m[2]) year = today().y;
  else if (m[2].length === 2) year = 2000 + Number(m[2]);
  else year = Number(m[2]);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthFromDue(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return parseMonth(value);
}

async function mondayQuery(token: string, query: string, variables: Record<string, unknown>, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(MONDAY_URL, {
      method: "POST",
      headers: { Authorization: token, "API-Version": "2024-10", "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 429) {
      await sleep(10_000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Monday.com HTTP ${res.status}`);
    const body = (await res.json()) as { data?: unknown; errors?: unknown };
    if (body.errors) {
      const msg = JSON.stringify(body.errors);
      if (msg.toLowerCase().includes("complexity") && attempt < retries - 1) {
        await sleep(20_000);
        continue;
      }
      throw new Error(`Monday.com API error: ${msg}`);
    }
    return body.data as Record<string, unknown>;
  }
  throw new Error("Monday.com API: retries exhausted (rate/complexity limit).");
}

const ITEM_FIELDS = "id name created_at group { title } column_values { id text column { title } }";

type MondayItem = {
  id: string;
  name: string;
  created_at?: string;
  group?: { title?: string };
  column_values: { id: string; text?: string; column?: { title?: string } }[];
};

function parseMondayItem(item: MondayItem, boardId: string, boardName: string) {
  const vals: Record<string, string> = {};
  for (const cv of item.column_values ?? []) {
    const title = (cv.column?.title || cv.id || "").trim().toLowerCase();
    if (cv.text && vals[title] == null) vals[title] = cv.text.trim();
  }
  const get = (field: string) => {
    for (const title of MONDAY_COLUMN_TITLES[field] ?? []) {
      const v = vals[title.toLowerCase()];
      if (v) return v;
    }
    return "";
  };
  let month = "";
  let source = "";
  const due = get("due_date");
  const timeline = get("timeline");
  const group = item.group?.title ?? "";
  if (due) {
    const parsed = monthFromDue(due);
    if (parsed) {
      month = parsed;
      source = "Due Date";
    }
  } else if (timeline) {
    const parsed = monthFromDue(timeline.split(" - ")[0]);
    if (parsed) {
      month = parsed;
      source = "Timeline";
    }
  } else if (monthFromText(group)) {
    month = monthFromText(group) || "";
    source = "Group title";
  } else if (item.created_at) {
    const created = String(item.created_at);
    const m = created.match(/^(\d{4})-(\d{2})/);
    if (m) {
      month = `${m[1]}-${m[2]}`;
      source = "Created date (fallback)";
    }
  }
  if (month === "NaT") {
    month = "";
    source = "";
  }
  const status = get("status");
  const done = DELIVERY_STATUS_DONE.includes(status);
  const planned = num(get("planned_hours")) ?? 0;
  const billableRaw = get("billable");
  const nonbill = MONDAY_NONBILLABLE_VALUES.map((v) => v.toLowerCase());
  return {
    item_id: `MON-${item.id}`,
    board_id: boardId,
    board_name: boardName,
    client: get("client") || (MONDAY_CLIENT_FROM_BOARD_NAME ? boardName : ""),
    month,
    month_source: source,
    group,
    week: get("week"),
    task_name: item.name,
    discipline: get("discipline") || "Unassigned",
    task_type: get("task_type"),
    work_type: get("work_type") || MONDAY_DEFAULT_WORK_TYPE,
    planned_hours: planned,
    remaining_estimate_hours: done ? 0 : planned,
    status: status || "Not set",
    owner: get("owner"),
    billable: nonbill.includes(billableRaw.toLowerCase()) ? "False" : "True",
    billable_raw: billableRaw || "Not set",
  };
}

const PLANNED_COLUMNS = [
  "item_id", "board_id", "board_name", "client", "month", "month_source", "group", "week",
  "task_name", "discipline", "task_type", "work_type", "planned_hours", "remaining_estimate_hours",
  "status", "owner", "billable", "billable_raw",
];

export async function fetchMondayItems(token: string, boardIds: string[]) {
  const firstQ = `query ($ids: [ID!]) { boards(ids: $ids) { id name items_page(limit: 200) { cursor items { ${ITEM_FIELDS} } } } }`;
  const nextQ = `query ($cursor: String!) { next_items_page(limit: 200, cursor: $cursor) { cursor items { ${ITEM_FIELDS} } } }`;
  const rows: ReturnType<typeof parseMondayItem>[] = [];
  const messages: string[] = [];
  for (const boardId of [...new Set(boardIds)]) {
    try {
      const data = await mondayQuery(token, firstQ, { ids: [boardId] });
      const boards = (data.boards ?? []) as { id: string; name: string; items_page: { cursor?: string; items: MondayItem[] } }[];
      if (!boards.length) {
        messages.push(`Board ${boardId}: not found or no access – skipped.`);
        continue;
      }
      const board = boards[0];
      let page = board.items_page;
      let n = 0;
      while (page) {
        for (const item of page.items ?? []) {
          rows.push(parseMondayItem(item, boardId, board.name));
          n += 1;
        }
        if (!page.cursor) break;
        const next = await mondayQuery(token, nextQ, { cursor: page.cursor });
        page = next.next_items_page as typeof page;
      }
      messages.push(`${board.name}: ${n} items`);
    } catch (e) {
      messages.push(`Board ${boardId}: failed – ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { rows, messages };
}

async function fetchBoardDescriptions(token: string, boardIds: string[]) {
  const q = "query ($ids: [ID!]) { boards(ids: $ids, limit: 100) { id name description } }";
  const ids = [...new Set(boardIds.map(String))];
  const out: { id: string; name: string; description: string }[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    const data = await mondayQuery(token, q, { ids: ids.slice(i, i + 25) });
    const boards = (data.boards ?? []) as { id: string; name: string; description?: string }[];
    for (const b of boards) out.push({ id: String(b.id), name: b.name, description: b.description ?? "" });
  }
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

async function fallbackStarts() {
  const lookup = await boardClientLookup();
  const min = new Map<string, string>();
  for (const row of await readCsv(filePath("planned_items"))) {
    const id = cell(row, "board_id").replace(/\.0$/, "");
    const client = lookup.get(id);
    const month = parseMonth(cell(row, "month"));
    if (!client || !month) continue;
    const cur = min.get(client);
    if (!cur || month < cur) min.set(client, month);
  }
  const out = new Map<string, ReturnType<typeof monthStart>>();
  for (const [client, month] of min) out.set(client, monthStart(month));
  return out;
}

async function pullContracts(token: string, boardIds: string[]) {
  const boards = await fetchBoardDescriptions(token, boardIds);
  const boardClients = await boardClientLookup();
  const { contracts, info } = buildContractsFromBoards(boards, boardClients, await fallbackStarts());
  await writeCsv("contracts_from_monday.csv", contracts as unknown as Record<string, unknown>[], [...CONTRACT_COLUMNS], true);
  await writeCsv("client_info.csv", info as unknown as Record<string, unknown>[], [...CLIENT_INFO_COLUMNS], true);
  const clients = new Set(contracts.map((c: BoardContract) => c.client));
  const msgs = [
    `Contracts: ${clients.size} client(s), ${contracts.length} service line(s) read from ${boards.length} board description(s).`,
  ];
  const returned = new Set(boards.map((b) => b.id));
  const missing = [...boardClients.keys()].filter((id) => !returned.has(id));
  if (missing.length) {
    msgs.push(
      `Contracts: board(s) not returned by Monday (no access or not shared with your API token): ${missing.sort().join(", ")}.`,
    );
  }
  for (const r of info as BoardInfo[]) {
    if (r.parse_issues) msgs.push(`Contracts – ${r.client} (board ${r.board_id}): ${r.parse_issues}`);
  }
  return msgs;
}

export async function refreshFromApis(monthsBack = 12): Promise<string[]> {
  const messages: string[] = [];
  const end = today();
  const startDate = new Date(end.y, end.m - 1 - monthsBack, 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const endStr = `${end.y}-${String(end.m).padStart(2, "0")}-${String(end.d).padStart(2, "0")}`;
  const timeCols = ["entry_id", "date", "client", "project", "task_id", "task_name", "user", "hours", "billable", "work_type", "category"];

  const everhourKey = everhourApiKey();
  if (everhourKey) {
    try {
      const te = await fetchEverhourTime(everhourKey, start, endStr);
      const seen = new Set<string>();
      const unique = te.filter((r) => (seen.has(r.entry_id) ? false : (seen.add(r.entry_id), true)));
      await writeCsv(filePath("time_entries"), unique, timeCols);
      await updateRefreshLog("Everhour", start, endStr);
      messages.push(`Everhour: ${te.length.toLocaleString()} time entries loaded.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateRefreshLog("Everhour", start, endStr, `Failed: ${msg}`);
      messages.push(`Everhour failed: ${msg}`);
    }
  }
  const boards = await mondayBoardIds();
  const mondayToken = mondayApiToken();
  if (mondayToken && boards.length) {
    try {
      const { rows, messages: boardMsgs } = await fetchMondayItems(mondayToken, boards);
      const failed = boardMsgs.filter((m) => m.includes("failed") || m.includes("no access"));
      if (!rows.length) throw new Error(boardMsgs.join("; ") || "no items returned");
      await writeCsv(filePath("planned_items"), rows, PLANNED_COLUMNS);
      await updateRefreshLog("Monday.com", start, endStr, failed.length ? `Partial – ${failed.length} board(s) skipped` : "OK");
      messages.push(`Monday.com: ${rows.length.toLocaleString()} items loaded.`);
      messages.push(...boardMsgs);
      try {
        messages.push(...(await pullContracts(mondayToken, boards)));
        await updateRefreshLog("Contracts", start, endStr);
      } catch (e) {
        messages.push(`Contracts from board descriptions failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateRefreshLog("Monday.com", start, endStr, `Failed: ${msg}`);
      messages.push(`Monday.com failed: ${msg}`);
    }
  }
  return messages.length ? messages : ["No API credentials configured – set EVERHOUR_API_KEY / MONDAY_API_TOKEN."];
}
