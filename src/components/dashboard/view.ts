import type { DashboardPayload, Fact } from "@/lib/types";

export type View = {
  payload: DashboardPayload;
  asOf: string;
  range: [string, string];
  threshold: number;
  workTypes: string[];
  monthRows: Fact[];
  trendRows: Fact[];
  clients: string[];
  owners: string[];
};
