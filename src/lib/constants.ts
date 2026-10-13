/** Business rules ported from config.py. Thresholds live here, not in the charts. */

export const VARIANCE_THRESHOLD_PCT = 10;
export const CTD_THRESHOLD_PCT = 10;
export const PRORATE_PARTIAL_MONTHS = true;
export const CTD_PRORATE_CURRENT_MONTH = true;
export const STALE_AFTER_HOURS = 26;
export const RECON_TOLERANCE_PCT = 2;
export const HISTORY_START: string | null = null;

export const DEFAULT_WORK_TYPES = ["Retainer"];
export const BILLABLE_VIEWS = ["Billable only", "All client time", "Non-billable only"] as const;
export const DEFAULT_BILLABLE_VIEW = "Billable only";

export const INTERNAL_CLIENTS = ["Verkeer"];

export const REASONS = [
  "",
  "Onboarding",
  "Seasonal increase",
  "Extra scope requested",
  "Rework",
  "Excessive meetings",
  "Client delay",
  "Under-delivery / capacity gap",
  "Other",
];

export const NATURE = ["", "Temporary", "Recurring"];

export const ACTIONS = [
  "",
  "Rebalance delivery",
  "Resolve blocker",
  "Improve efficiency",
  "Agree additional fees",
  "Review scope",
  "No action – planned investment",
];

export const ACTION_STATUS = ["Open", "In progress", "Done"];

export const DELIVERY_STATUS_DONE = ["Done", "Complete"];
export const DELIVERY_STATUS_BLOCKED = ["Stuck", "Blocked"];

export const MONDAY_COLUMN_TITLES: Record<string, string[]> = {
  owner: ["Who"],
  status: ["Status"],
  due_date: ["Due Date"],
  timeline: ["Timeline"],
  planned_hours: ["Hours Planned"],
  discipline: ["Channel"],
  task_type: ["Type"],
  billable: ["Billable vs Non"],
  week: ["Week"],
  client: ["Client"],
  work_type: ["Work Type"],
};

export const MONDAY_CLIENT_FROM_BOARD_NAME = true;
export const MONDAY_DEFAULT_WORK_TYPE = "Retainer";
export const MONDAY_NONBILLABLE_VALUES = ["Non Billable", "Non-billable", "Nonbillable"];
export const EVERHOUR_NONBILLABLE_MARKERS = ["[NB]", "Non-billable", "Senior support", "Rework"];

export const ACTION_COLUMNS = [
  "client",
  "month",
  "flag_type",
  "direction",
  "variance_pct",
  "reason",
  "nature",
  "action",
  "owner",
  "deadline",
  "hours_adjustment",
  "status",
  "notes",
  "updated_at",
] as const;

export const CONTRACT_COLUMNS = [
  "contract_id",
  "client",
  "account_owner",
  "contract_start",
  "contract_end",
  "effective_from",
  "monthly_hours",
  "billing_model",
  "notes",
  "service",
  "source_board_id",
] as const;

export const CLIENT_INFO_COLUMNS = [
  "client",
  "board_id",
  "board_name",
  "owner",
  "support",
  "escalation",
  "start_date",
  "hours_lines",
  "total_monthly_hours",
  "email",
  "website",
  "contract_link",
  "digital_plan",
  "brand_guidelines",
  "client_guide",
  "other_links",
  "parse_issues",
  "description",
] as const;
