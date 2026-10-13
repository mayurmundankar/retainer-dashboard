import { readCsv, tidy } from "./csv";
import { env } from "./env";

export function dataSource(): string {
  return env("DASHBOARD_DATA_SOURCE") || "csv";
}

export function everhourApiKey(): string {
  return env("EVERHOUR_API_KEY");
}

export function mondayApiToken(): string {
  return env("MONDAY_API_TOKEN");
}

function envBoardIds(): string[] {
  return env("MONDAY_BOARD_IDS")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

export async function mondayBoardIds(): Promise<string[]> {
  const fromEnv = envBoardIds();
  const ids = (await readCsv("monday_boards.csv"))
    .map((r) => (r.board_id || "").trim())
    .filter(Boolean);
  return [...new Set([...ids, ...fromEnv])];
}

export async function boardClientLookup(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const r of await readCsv("monday_boards.csv")) {
    const id = (r.board_id || "").trim();
    const client = tidy(r.client || "");
    if (id && client) map.set(id, client);
  }
  return map;
}
