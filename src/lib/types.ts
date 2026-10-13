export type Fact = {
  client: string;
  month: string;
  month_str: string;
  status: string;
  account_owner: string;
  billing_model: string;
  contract_id: string;
  contract_start: string;
  contract_end: string;
  contracted_hours: number;
  allocated_hours: number;
  planned_hours: number;
  actual_hours: number | null;
  remaining_estimate: number;
  forecast_hours: number | null;
  variance_hours: number | null;
  variance_pct: number | null;
  ctd_contracted: number;
  ctd_actual: number;
  ctd_variance_hours: number;
  ctd_variance_pct: number | null;
  ctd_missing_months: number;
  nonbillable_hours: number;
  nb: Record<string, number>;
  deliverables_total: number;
  deliverables_done: number;
  deliverables_outstanding: number;
  deliverables_blocked: number;
  partial_month: boolean;
  data_missing: boolean;
  monthly_flag: string;
  ctd_flag: string;
  review_required: boolean;
  is_current_month: boolean;
};

export type ContractRow = {
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
  contract_source: string;
};

export type ClientInfo = {
  client: string;
  board_id: string;
  board_name: string;
  owner: string;
  support: string;
  escalation: string;
  start_date: string;
  hours_lines: string;
  total_monthly_hours: string;
  email: string;
  website: string;
  contract_link: string;
  digital_plan: string;
  brand_guidelines: string;
  client_guide: string;
  other_links: string;
  parse_issues: string;
};

export type PlannedItem = {
  item_id: string;
  board_id: string;
  client: string;
  month: string;
  task_name: string;
  discipline: string;
  owner: string;
  status: string;
  planned_hours: number;
  remaining_estimate_hours: number;
  work_type: string;
  month_source: string;
  billable_raw: string;
  billable: boolean;
  group: string;
};

export type ActionRow = {
  client: string;
  month: string;
  flag_type: string;
  direction: string;
  variance_pct: string;
  reason: string;
  nature: string;
  action: string;
  owner: string;
  deadline: string;
  hours_adjustment: string;
  status: string;
  notes: string;
  updated_at: string;
};

export type ReviewItem = {
  client: string;
  month: string;
  flag_type: string;
  direction: string;
  variance_hours: number | null;
  variance_pct: number | null;
  account_owner: string;
  outstanding: number;
  reason: string;
  nature: string;
  action: string;
  owner: string;
  deadline: string | null;
  hours_adjustment: number | null;
  status: string;
  notes: string;
  updated_at: string;
  complete: boolean;
};

export type Freshness = {
  source: string;
  last_success: string;
  period_start: string;
  period_end: string;
  status: string;
  age_hours: number | null;
  stale: boolean;
  state: string;
};

export type ReconRow = {
  client: string;
  month: string;
  everhour_hours: number | null;
  tracker_hours: number | null;
  difference: number | null;
  difference_pct: number | null;
  status: string;
};

export type CapacityRow = {
  month: string;
  month_str: string;
  discipline: string;
  gross_hours: number;
  leave_hours: number;
  capacity_hours: number;
  client_hours_actual: number;
  client_hours_planned: number;
  utilisation_pct: number | null;
  planned_load_pct: number | null;
  headroom_hours: number;
};

export type DashboardPayload = {
  dataSource: string;
  storage: "supabase" | "local";
  dataUpdatedAt: string;
  storageNote: string | null;
  billableViews: string[];
  reasons: string[];
  nature: string[];
  actions: string[];
  actionStatus: string[];
  workTypeOptions: string[];
  months: string[];
  current: string;
  today: string;
  incompleteClients: string[];
  freshness: Freshness[];
  fact: Fact[];
  contracts: ContractRow[];
  clientInfo: ClientInfo[];
  planned: PlannedItem[];
  plannedNoMonth: Record<string, string>[];
  duplicates: Record<string, string>[];
  unclassified: Record<string, string>[];
  recon: ReconRow[];
  unmapped: { source: string; client_name: string; records: number }[];
  mapping: { source: string; source_name: string; canonical_client: string }[];
  workSplit: { client: string; month: string; hours: Record<string, number> }[];
  capacity: CapacityRow[];
  actionsLog: ActionRow[];
  monthSource: { client: string; month_source: string; items: number; hours: number }[];
  categories: string[];
};
