/** Calendar dates as year/month/day so CSV dates never shift across timezones. */

export type YMD = { y: number; m: number; d: number };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function ymd(y: number, m: number, d: number): YMD {
  const dt = new Date(y, m - 1, d);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export function today(): YMD {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

export function cmp(a: YMD, b: YMD): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

export function maxD(a: YMD, b: YMD): YMD {
  return cmp(a, b) >= 0 ? a : b;
}

export function minD(a: YMD, b: YMD): YMD {
  return cmp(a, b) <= 0 ? a : b;
}

export function addDays(a: YMD, n: number): YMD {
  return ymd(a.y, a.m, a.d + n);
}

export function addYears(a: YMD, n: number): YMD {
  return ymd(a.y + n, a.m, a.d);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function monthStart(period: string): YMD {
  const [y, m] = period.split("-").map(Number);
  return { y, m, d: 1 };
}

export function monthEnd(period: string): YMD {
  const [y, m] = period.split("-").map(Number);
  return { y, m, d: daysInMonth(y, m) };
}

export function toPeriod(d: YMD): string {
  return `${d.y}-${String(d.m).padStart(2, "0")}`;
}

export function fmt(d: YMD | null | undefined): string {
  if (!d) return "";
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

export function periodRange(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  if (!y || !m || !ey || !em) return out;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function diffDays(a: YMD, b: YMD): number {
  const ua = Date.UTC(a.y, a.m - 1, a.d);
  const ub = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((ub - ua) / 86400000);
}

/** Weekdays in the month (Mon–Fri), matching numpy.busday_count. */
export function weekdayCount(period: string): number {
  const start = monthStart(period);
  const dim = daysInMonth(start.y, start.m);
  let n = 0;
  for (let d = 1; d <= dim; d++) {
    const wd = new Date(start.y, start.m - 1, d).getDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

export function nowIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function parseDateTime(input: unknown): Date | null {
  if (input == null) return null;
  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return null;
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), ms);
}

/**
 * ISO dates are year-month-day. Anything else (01/11/2025, 01-11-2025, 01-Nov-2025)
 * is day-first, matching the Streamlit date parser.
 */
export function parseDate(input: unknown): YMD | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw || raw === "nan" || raw === "NaT" || raw === "None" || raw === "YYYY-MM-DD") return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{2}:\d{2}:\d{2})?$/);
  if (iso) {
    const y = +iso[1];
    const m = +iso[2];
    const d = +iso[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }

  const df = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (df) {
    let y = +df[3];
    if (df[3].length === 2) y += 2000;
    const d = +df[1];
    const m = +df[2];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }

  const named = raw.match(/^(\d{1,2})[ \-]([A-Za-z]{3,9})[ ,.\-]+(\d{2,4})$/);
  if (named) {
    const mi = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (mi) {
      let y = +named[3];
      if (named[3].length === 2) y += 2000;
      return { y, m: mi, d: +named[1] };
    }
  }
  return null;
}

export function parseMonth(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s || s === "NaT" || s === "nan" || s === "None") return null;
  const ym = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (ym) {
    const m = +ym[2];
    if (m >= 1 && m <= 12) return `${ym[1]}-${String(m).padStart(2, "0")}`;
  }
  const d = parseDate(s);
  return d ? toPeriod(d) : null;
}

export function prettyDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[3]} ${names[+m[2] - 1]} ${m[1]}`;
}
