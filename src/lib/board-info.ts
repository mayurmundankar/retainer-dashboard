import { daysInMonth, fmt, type YMD } from "./dates";

const URL_RE = /https?:\/\/\S+/;
const NUM = /(\d+(?:[.,]\d+)?)/;
const HOURS_LINE =
  /^\s*([^:]*?)\s*\b(?:hours|hrs|hour)\b\s*(?:per\s+month|p\/?m|pcm)?\s*[:\-–]\s*(.*)$/i;
const HOURS_AFTER =
  /^\s*([A-Za-z][A-Za-z &/+\-]{0,30}):\s*(\d+(?:[.,]\d+)?\s*(?:hours|hrs|hr|h)\b.*)$/i;
const UNTIL = /\b(?:till|until|to|ends?|ending|through|thru)\b\s+(.+?)(?:\)|,|;|$)/i;
const FROM = /\b(?:from|starting|starts?)\b\s+(.+?)(?:\)|,|;|\btill\b|\buntil\b|$)/i;
const OWNER_KEYS = [
  "owner",
  "manager",
  "managers",
  "account owner",
  "account manager",
  "account managers",
  "am",
  "lead",
  "pod",
  "pod lead",
];
const START_KEYS = new Set(["start date", "start", "contract start", "start month", "contract start date"]);
const END_KEYS = new Set(["end date", "end", "contract end", "contract end date", "renewal date", "renewal"]);
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export type BoardContract = {
  contract_id: string;
  client: string;
  account_owner: string;
  contract_start: string;
  contract_end: string;
  effective_from: string;
  monthly_hours: number;
  billing_model: string;
  notes: string;
  service: string;
  source_board_id: string;
};

export type BoardInfo = {
  client: string;
  board_id: string;
  board_name: string;
  owner: string;
  support: string;
  escalation: string;
  start_date: string;
  hours_lines: string;
  total_monthly_hours: number;
  email: string;
  website: string;
  contract_link: string;
  digital_plan: string;
  brand_guidelines: string;
  client_guide: string;
  other_links: string;
  parse_issues: string;
  description: string;
};

export function cleanDescription(text: string | null | undefined): string {
  if (!text) return "";
  let t = String(text).replace(/(?:<br\s*\/?>|<\/p>|<\/div>|<\/li>)/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  return decodeHtml(t).replace(/\r/g, "");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function parseMonthDate(text: string, endOfMonth = false): YMD | null {
  if (!text) return null;
  let t = text.replace(new RegExp(URL_RE.source, "g"), "").trim().replace(/^[ .()]+|[ .()]+$/g, "");
  t = t.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = t.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (m) {
    const y = +m[3] + (m[3].length === 2 ? 2000 : 0);
    const d = +m[1];
    const mo = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, m: mo, d };
  }
  m = t.match(/\b(\d{1,2}\s+)?([A-Za-z]{3,9})\.?,?\s+'?(\d{2,4})\b/);
  if (m) {
    const mi = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mi) return null;
    const year = +m[3] + (m[3].length === 2 ? 2000 : 0);
    if (m[1]) return { y: year, m: mi, d: parseInt(m[1], 10) };
    return endOfMonth ? { y: year, m: mi, d: daysInMonth(year, mi) } : { y: year, m: mi, d: 1 };
  }
  return null;
}

/**
 * Hours on one board line. A slash-separated pair such as "65hrs (SEO) / 21hrs (Paid)"
 * is two monthly amounts. A once-off figure on the same line is not added.
 */
export function hoursOnBoardLine(rest: string): number | null {
  const first = rest.match(NUM);
  if (!first) return null;
  let total = Number(first[1].replace(",", "."));
  if (!Number.isFinite(total)) return null;
  for (const extra of rest.matchAll(/\/\s*(\d+(?:[.,]\d+)?)\s*(?:hours|hrs|hr|h)\b([^/]*)/gi)) {
    if (/once[\s-]?off|one[\s-]?off/i.test(extra[2] || "")) continue;
    const n = Number(extra[1].replace(",", "."));
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export function ownerName(text: string): string {
  if (!text) return "";
  let first = text.trim().split(/\s*(?:\/|,|&|\band\b)\s*/)[0] ?? "";
  first = first.replace(/\s*\(.*?\)/g, "").trim();
  if (first.includes("@")) {
    const user = first.split("@")[0].trim();
    return user ? user.charAt(0).toUpperCase() + user.slice(1) : "";
  }
  const word = first.split(/\s+/).filter(Boolean)[0] || "";
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

export function extractOwnerFromDescription(description: string): string {
  const text = cleanDescription(description);
  const lines = text.split("\n");
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(":") && !/^https?:/i.test(trimmed)) {
      const idx = trimmed.indexOf(":");
      const key = trimmed.slice(0, idx).trim().toLowerCase();
      const val = trimmed.slice(idx + 1).trim();
      if (!(key in fields) && val) fields[key] = val;
    }
  }
  const raw = OWNER_KEYS.map((k) => fields[k]).find(Boolean) ?? "";
  return ownerName(raw);
}

export function parseBoardDescription(
  client: string,
  boardId: string,
  boardName: string,
  description: string,
  fallbackStart?: YMD | null,
): { rows: BoardContract[]; info: BoardInfo } {
  const text = cleanDescription(description);
  const lines = text.split("\n").map((ln) => ln.trim()).filter(Boolean);
  const fields: Record<string, string> = {};
  const links: Record<string, string> = {};
  const issues: string[] = [];
  const hourLines: { service: string; rest: string; raw: string }[] = [];

  for (let n = 0; n < lines.length; n++) {
    let ln = lines[n];
    if (ln.endsWith(":") && n + 1 < lines.length && !lines[n + 1].split("//")[0].includes(":")) {
      ln = `${ln} ${lines[n + 1]}`;
    }
    const hm = ln.match(HOURS_LINE) ?? ln.match(HOURS_AFTER);
    const service = hm?.[1] ?? "";
    const rest = hm?.[2] ?? "";
    if (hm && NUM.test(rest) && !URL_RE.test(rest)) {
      hourLines.push({
        service: service.trim().replace(/^[-–:\s]+|[-–:\s]+$/g, ""),
        rest,
        raw: ln,
      });
      continue;
    }
    if (ln.includes(":") && !/^https?:/i.test(ln)) {
      const idx = ln.indexOf(":");
      const key = ln.slice(0, idx).trim().toLowerCase();
      const val = ln.slice(idx + 1).trim();
      if (!(key in fields)) fields[key] = val;
      const url = val.match(URL_RE);
      if (url) links[key] = url[0];
    }
  }

  const ownerRaw = OWNER_KEYS.map((k) => fields[k]).find(Boolean) ?? "";
  const startKeys = Object.keys(fields).filter((k) => START_KEYS.has(k) || /start|commenc|began|go[- ]?live/.test(k));
  const endKeys = Object.keys(fields).filter((k) => END_KEYS.has(k) || /\bend\b|expir|renewal|until/.test(k));
  let start = startKeys.map((k) => parseMonthDate(fields[k])).find((d) => d) ?? null;
  let end = endKeys.map((k) => parseMonthDate(fields[k], true)).find((d) => d) ?? null;
  if (!start) {
    for (const k of startKeys) {
      const y = fields[k].match(/^\D*((?:19|20)\d{2})\D*$/);
      if (y) {
        start = { y: +y[1], m: 1, d: 1 };
        issues.push(`start date '${fields[k]}' has no month – January ${y[1]} assumed`);
        break;
      }
    }
  }
  if (!hourLines.length) issues.push("no '<service> hours: N p/m' line found");
  if (!start && hourLines.length && fallbackStart) {
    start = fallbackStart;
    const label = fallbackStart.toLocaleString?.() ;
    const monthName = new Date(fallbackStart.y, fallbackStart.m - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    issues.push(
      `no Start Date in board description – ${monthName} assumed from the first Monday item (add 'Start Date: Month YYYY' to Board info to set it properly)`,
    );
    void label;
  }
  if (!start) {
    const seen = startKeys.map((k) => `'${k}: ${fields[k]}'`).join("; ") || "no start line";
    issues.push(`no readable 'Start Date' (found ${seen}) – write it like 'Start Date: April 2026'`);
  }

  const rows: BoardContract[] = [];
  for (const { service: rawService, rest, raw } of hourLines) {
    const hours = hoursOnBoardLine(rest);
    if (hours == null) continue;
    const service = rawService || "Retainer";
    let lineStart = start;
    let lineEnd = end;
    const um = rest.match(UNTIL);
    const fm = rest.match(FROM);
    if (um?.[1]) {
      const parsed = parseMonthDate(um[1], true);
      lineEnd = parsed ?? lineEnd;
      if (!lineEnd) issues.push(`could not read end date in '${raw}'`);
    }
    if (fm?.[1]) lineStart = parseMonthDate(fm[1]) ?? lineStart;
    const slug = service.replace(/[^A-Za-z0-9]+/g, "") || "Retainer";
    rows.push({
      contract_id: `MON-${boardId}-${slug}`,
      client,
      account_owner: ownerName(ownerRaw),
      contract_start: lineStart ? fmt(lineStart) : "",
      contract_end: lineEnd ? fmt(lineEnd) : "",
      effective_from: lineStart ? fmt(lineStart) : "",
      monthly_hours: hours,
      billing_model: "Standard",
      notes: `From Monday board description: ${raw}`,
      service,
      source_board_id: String(boardId),
    });
  }

  const skip = new Set(["website", "contract", "digital plan", "brand guidelines", "client guide"]);
  const info: BoardInfo = {
    client,
    board_id: String(boardId),
    board_name: boardName,
    owner: ownerRaw,
    support: fields.support ?? "",
    escalation: fields.escalation ?? "",
    start_date: startKeys.map((k) => fields[k]).find(Boolean) ?? "",
    hours_lines: hourLines.map((h) => h.raw).join(" | "),
    total_monthly_hours: rows.reduce((s, r) => s + r.monthly_hours, 0),
    email: fields.email ?? "",
    website: links.website || fields.website || "",
    contract_link: links.contract ?? "",
    digital_plan: links["digital plan"] ?? "",
    brand_guidelines: links["brand guidelines"] ?? "",
    client_guide: links["client guide"] ?? "",
    other_links: Object.entries(links)
      .filter(([k]) => !skip.has(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | "),
    parse_issues: issues.join("; "),
    description: text,
  };
  return { rows, info };
}

export function buildContractsFromBoards(
  boards: { id: string; name: string; description: string }[],
  boardClients: Map<string, string>,
  fallbackStarts: Map<string, YMD>,
): { contracts: BoardContract[]; info: BoardInfo[] } {
  const order = [...boardClients.keys()];
  const rank = new Map(order.map((id, i) => [id, i]));
  const sorted = [...boards].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  const contracts: BoardContract[] = [];
  const infos: BoardInfo[] = [];
  const used = new Map<string, string>();
  const seen = new Set<string>();
  for (const b of sorted) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    const client = boardClients.get(b.id) ?? b.name;
    const parsed = parseBoardDescription(client, b.id, b.name, b.description || "", fallbackStarts.get(client) ?? null);
    if (parsed.rows.length && used.has(client)) {
      parsed.info.parse_issues = `hours ignored – already taken from board ${used.get(client)} (avoids double counting)`;
      parsed.rows = [];
    } else if (parsed.rows.length) {
      used.set(client, b.id);
    }
    contracts.push(...parsed.rows);
    infos.push(parsed.info);
  }
  return { contracts, info: infos };
}
