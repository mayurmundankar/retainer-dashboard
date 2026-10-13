import Papa from "papaparse";
import { readObject, writeObject } from "./storage";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  const parsed = Papa.parse<CsvRow>(body, { header: true, skipEmptyLines: "greedy" });
  return (parsed.data ?? []).filter((row) => row && Object.values(row).some((v) => String(v ?? "").trim() !== ""));
}

export function serializeCsv(rows: Record<string, unknown>[], columns: string[], bom = false): string {
  const csv = Papa.unparse({
    fields: columns,
    data: rows.map((row) => columns.map((c) => (row[c] == null ? "" : row[c]))),
  });
  return (bom ? "\uFEFF" : "") + csv + (csv.endsWith("\n") ? "" : "\n");
}

export async function readCsv(name: string): Promise<CsvRow[]> {
  const text = await readObject(name);
  if (text == null) return [];
  return parseCsv(text);
}

export async function writeCsv(name: string, rows: Record<string, unknown>[], columns: string[], bom = false) {
  await writeObject(name, serializeCsv(rows, columns, bom));
}

export function cell(row: CsvRow, key: string): string {
  const v = row[key];
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "nan" || s === "NaT" || s === "None" || s === "NaN") return "";
  return s;
}

export function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "nan" || s === "NaN" || s === "None") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function asBool(v: unknown): boolean {
  return ["true", "1", "yes"].includes(String(v ?? "").trim().toLowerCase());
}

export function tidy(s: unknown): string {
  return String(s ?? "").trim().replace(/\s+/g, " ").replace(/^nan$/i, "");
}
