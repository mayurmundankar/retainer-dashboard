"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCw, CloudDownload } from "lucide-react";
import { isInternalClient } from "@/lib/constants";
import type { DashboardPayload } from "@/lib/types";
import { CapacityTab } from "./capacity-tab";
import { ClientTab } from "./client-detail";
import { Banner, Disclosure } from "./bits";
import { ageLabel, monthEndIso, pretty, unique } from "./format";
import { formatMonth, MonthDatePicker } from "./month-picker";
import { GuideTab } from "./guide-tab";
import { PortfolioTab } from "./portfolio";
import { ReconTab } from "./recon-tab";
import { ReviewTab } from "./review-tab";
import type { View } from "./view";

export function Dashboard() {
  const [workTypes, setWorkTypes] = useState<string[]>(["Retainer"]);
  const [billable, setBillable] = useState("Billable only");
  const [threshold, setThreshold] = useState(10);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerFilterFeedback = useCallback(() => {
    setFilterLoading(true);
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      setFilterLoading(false);
    }, 300);
  }, []);

  const [asOf, setAsOf] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState<string | null>(null);
  const [ownerPick, setOwnerPick] = useState<string[] | null>(null);
  const [clientPick, setClientPick] = useState<string[] | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullNotes, setPullNotes] = useState<string[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!workTypes.length) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      workTypes: workTypes.join(","),
      billable,
      threshold: String(threshold),
    });
    try {
      const res = await fetch(`/api/dashboard?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) {
        setError(json.error || "Could not load the dashboard.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      if (id === requestId.current) setError("Could not reach the dashboard API.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workTypes, billable, threshold]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!data?.months.length) return;
    if (!asOf || !data.months.includes(asOf)) setAsOf(data.months[data.months.length - 1]);
    if (!rangeFrom || !data.months.includes(rangeFrom)) setRangeFrom(data.months[0]);
    if (!rangeTo || !data.months.includes(rangeTo)) setRangeTo(data.months[data.months.length - 1]);
  }, [data, asOf, rangeFrom, rangeTo]);

  const owners = useMemo(() => unique((data?.fact ?? []).map((r) => r.account_owner)), [data]);
  const selectedOwners = ownerPick ? ownerPick.filter((o) => owners.includes(o)) : owners;
  const clients = useMemo(
    () =>
      unique(
        (data?.fact ?? [])
          .filter(
            (r) =>
              (!asOf || r.month === asOf) &&
              selectedOwners.includes(r.account_owner) &&
              !isInternalClient(r.client) &&
              !r.data_missing &&
              ((r.actual_hours != null && r.actual_hours > 0) || r.planned_hours > 0),
          )
          .map((r) => r.client),
      ),
    [data, selectedOwners, asOf],
  );
  const selectedClients = (clientPick ? clientPick.filter((c) => clients.includes(c)) : clients).filter(
    (c) => !isInternalClient(c),
  );

  const from = rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeTo : rangeFrom;
  const to = rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeFrom : rangeTo;

  const view: View | null = data && asOf && from && to
    ? {
        payload: data,
        asOf,
        range: [from, to],
        threshold,
        workTypes,
        owners: selectedOwners,
        clients: selectedClients,
        monthRows: data.fact.filter(
          (r) =>
            r.month === asOf &&
            selectedClients.includes(r.client) &&
            selectedOwners.includes(r.account_owner) &&
            !isInternalClient(r.client),
        ),
        trendRows: data.fact.filter(
          (r) =>
            r.month >= from &&
            r.month <= to &&
            selectedClients.includes(r.client) &&
            selectedOwners.includes(r.account_owner) &&
            !isInternalClient(r.client),
        ),
      }
    : null;

  async function pull() {
    setPulling(true);
    setPullNotes([]);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      setPullNotes(json.messages ?? ["Refresh finished."]);
      await load();
    } catch {
      setPullNotes(["Refresh failed."]);
    } finally {
      setPulling(false);
    }
  }

  const options = data?.workTypeOptions ?? ["Retainer", "Project"];
  const months = data?.months ?? [];
  const inactive = data && asOf ? inactiveClients(data, asOf) : [];
  const noTime = view?.monthRows.filter((r) => r.data_missing).map((r) => r.client) ?? [];
  const stale = data?.freshness.some((f) => f.stale || f.status.toLowerCase() !== "ok") ?? false;
  const isUpdating = loading || filterLoading;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden border-r border-border/70 bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 px-4 py-5 shadow-xs">
        {data && (
          <div className="flex flex-col gap-1.5 pb-3 border-b border-border/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Sources &amp; Status</span>
            <div className="flex flex-wrap gap-1.5">
              {data.freshness.map((f) => (
                <Badge
                  key={f.source}
                  variant={f.state.includes("Check") ? "outline" : "secondary"}
                  className="shadow-xs text-[10px] font-medium rounded-full px-2 py-0.5 border-border/80"
                  title={`${f.status}. Covers ${f.period_start || "—"} to ${f.period_end || "—"}. Last success ${ageLabel(f.age_hours)}.`}
                >
                  <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: f.state.includes("Check") ? "#ea580c" : "#99d132" }} />
                  {f.source} · {f.state.includes("Check") ? "Check" : "Fresh"}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  id="refresh-btn"
                  size="sm"
                  className="w-full h-8.5 rounded-full font-bold uppercase text-[11px] tracking-wider border border-border/80 bg-card text-foreground hover:bg-[#121212] hover:text-white transition-all shadow-[2px_2px_0px_#4b439d] inline-flex items-center justify-center gap-2 cursor-pointer"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>{loading ? "Refreshing…" : "Refresh"}</span>
                </Button>
              }
            />
            <TooltipContent side="right" className="max-w-xs text-xs">
              <strong>Refresh:</strong> Reloads local cached data and updates all metrics, filters, and charts instantly without fetching from external APIs.
            </TooltipContent>
          </Tooltip>

          {data?.dataSource === "api" && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    id="fetch-live-data-btn"
                    size="sm"
                    className="w-full h-8.5 rounded-full font-bold uppercase text-[11px] tracking-wider bg-[#121212] hover:bg-[#b5018b] text-white border-0 transition-all shadow-[2px_2px_0px_#99d132] inline-flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => void pull()}
                    disabled={pulling}
                  >
                    <CloudDownload className={`size-3.5 ${pulling ? "animate-bounce" : ""}`} />
                    <span>{pulling ? "Fetching…" : "Fetch Live Data"}</span>
                  </Button>
                }
              />
              <TooltipContent side="right" className="max-w-xs text-xs">
                <div>
                  <strong>Fetch Live Data:</strong> Connects to external APIs (Everhour &amp; Monday.com) to synchronize the latest live hours, deliverables, and board records.
                </div>
                <div className="mt-1.5 font-bold text-[#b5018b]">
                  ETA: Refresh will take ~2 mins (comprehensive sync).
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {pullNotes.length > 0 && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {pullNotes.map((n) => <p key={n}>{n}</p>)}
          </div>
        )}
        <Separator />
        <FilterGroup title="Work type">
          <div className="flex gap-3">
            {options.map((w) => (
              <CheckRow
                key={w}
                label={w}
                checked={workTypes.includes(w)}
                onChange={(on) => {
                  triggerFilterFeedback();
                  setWorkTypes((prev) => (on ? [...new Set([...prev, w])] : prev.filter((x) => x !== w)));
                }}
              />
            ))}
          </div>
        </FilterGroup>
        <FilterGroup title="Time included">
          <div className="flex flex-col gap-1">
            {(data?.billableViews ?? ["Billable only", "All client time", "Non-billable only"]).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={billable === v ? "secondary" : "ghost"}
                className={
                  billable === v
                    ? "justify-start bg-[#b5018b]/15 text-[#b5018b] dark:text-[#f472b6] font-bold border border-[#b5018b]/30 shadow-xs"
                    : "justify-start text-foreground/80 hover:text-foreground"
                }
                onClick={() => {
                  triggerFilterFeedback();
                  setBillable(v);
                }}
              >
                {v}
              </Button>
            ))}
          </div>
        </FilterGroup>

        {months.length > 0 && asOf && from && to && (
          <FilterGroup title="Date range">
            <div className="space-y-3">
              <MonthDatePicker
                label="Reporting month"
                value={asOf}
                months={months}
                onChange={(m) => {
                  triggerFilterFeedback();
                  setAsOf(m);
                }}
              />
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Trend Window
                </div>
                <MonthDatePicker
                  label="From"
                  value={from}
                  months={months}
                  onChange={(m) => {
                    triggerFilterFeedback();
                    setRangeFrom(m);
                  }}
                />
                <MonthDatePicker
                  label="To"
                  value={to}
                  months={months}
                  onChange={(m) => {
                    triggerFilterFeedback();
                    setRangeTo(m);
                  }}
                />
              </div>
            </div>
          </FilterGroup>
        )}

        <FilterGroup
          title="Account owner"
          action={
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => {
                triggerFilterFeedback();
                setOwnerPick(ownerPick ? null : []);
              }}
            >
              {ownerPick ? "All" : "None"}
            </button>
          }
        >
          <div className="max-h-36 space-y-1 overflow-auto">
            {owners.map((o) => (
              <CheckRow
                key={o || "none"}
                label={o || "Unassigned"}
                checked={selectedOwners.includes(o)}
                onChange={(on) => {
                  triggerFilterFeedback();
                  const base = ownerPick ?? owners;
                  setOwnerPick(on ? [...new Set([...base, o])] : base.filter((x) => x !== o));
                }}
              />
            ))}
          </div>
        </FilterGroup>
        <FilterGroup
          title="Client"
          action={
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => {
                triggerFilterFeedback();
                setClientPick(clientPick ? null : []);
              }}
            >
              {clientPick ? "All" : "None"}
            </button>
          }
        >
          <Input
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Find an active client"
            className="h-8"
          />
          <div className="max-h-40 space-y-1 overflow-auto">
            {clients.filter((c) => c.toLowerCase().includes(clientQuery.trim().toLowerCase())).map((c) => (
              <CheckRow
                key={c}
                label={c}
                checked={selectedClients.includes(c)}
                onChange={(on) => {
                  triggerFilterFeedback();
                  const base = clientPick ?? clients;
                  setClientPick(on ? [...new Set([...base, c])] : base.filter((x) => x !== c));
                }}
              />
            ))}
          </div>
        </FilterGroup>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto relative">
        {/* Full-screen Loading Overlay for Pull APIs */}
        {pulling && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md p-6 animate-in fade-in duration-200">
            <div className="flex max-w-md w-full flex-col items-center text-center space-y-4 rounded-2xl border border-border/80 bg-card/95 p-8 shadow-2xl">
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#b5018b]/20 border-t-[#b5018b]" />
                <img src="/verkeer-logo.svg" alt="Verkeer" className="absolute h-5 w-auto object-contain dark:brightness-110" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">Pulling data from APIs…</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-light">
                  Connecting to Everhour &amp; Monday.com boards to fetch updated time entries, contracts, and delivery schedules.
                </p>
                <div className="inline-block rounded-full bg-[#b5018b]/10 border border-[#b5018b]/30 px-3 py-1 text-xs font-semibold text-[#b5018b]">
                  ETA: Refresh will take ~2 minutes. Please keep this tab open.
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full bg-gradient-to-r from-[#b5018b] via-[#4b439d] to-[#01abc8] animate-indeterminate" />
              </div>
              <div className="text-[11px] text-muted-foreground animate-pulse font-light">
                Synchronizing records from Monday.com and Everhour…
              </div>
            </div>
          </div>
        )}

        {/* Top Loading Progress Bar - Verkeer brand gradient */}
        <div
          className={`sticky top-0 left-0 right-0 z-40 h-1 w-full overflow-hidden bg-[#b5018b]/10 transition-opacity duration-300 ${
            isUpdating ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="h-full w-full bg-gradient-to-r from-[#b5018b] via-[#4b439d] via-[#01abc8] to-[#99d132] animate-indeterminate" />
        </div>

        {/* Floating Updating Pill Indicator */}
        {isUpdating && (
          <div className="fixed top-4 right-8 z-40 flex items-center gap-2 rounded-full border border-[#b5018b]/30 bg-background/95 px-4 py-1.5 text-xs font-semibold text-foreground shadow-[3px_3px_0px_#b5018b] backdrop-blur-md transition-all animate-in fade-in duration-200">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#b5018b] border-t-transparent" />
            <span className="tracking-wide uppercase text-[11px]">Updating dashboard…</span>
          </div>
        )}

        <div className={`mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 transition-opacity duration-200 ${isUpdating ? "opacity-75" : "opacity-100"}`}>
          {/* Main Brand Header with PDF borders & Raleway typography */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b-2 border-[#4b439d]/25">
            <div className="flex items-center gap-4">
              <img src="/verkeer-logo.svg" alt="Verkeer" className="h-13 w-auto object-contain dark:brightness-110" />
              <div className="space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground uppercase">
                  Retainer, Capacity &amp; Overservicing Dashboard
                </h1>
                <p className="text-xs sm:text-sm font-light text-muted-foreground tracking-wide">
                  Contracted, planned, actual, and forecast performance hours
                </p>
              </div>
            </div>
          </div>

          {!workTypes.length && <Banner tone="warn">Select at least one work type.</Banner>}
          {error && <Banner tone="bad">{error}</Banner>}
          {data?.storageNote && <Banner tone="warn">{data.storageNote}</Banner>}
          {data && data.incompleteClients.length > 0 && (
            <Disclosure title={`${data.incompleteClients.length} clients missing a contract start or monthly hours`}>
              <p className="px-3 py-2 text-sm text-muted-foreground">{data.incompleteClients.join(", ")}. They are not shown yet.</p>
            </Disclosure>
          )}
          {inactive.length > 0 && asOf && (
            <Disclosure title={`${inactive.length} clients have no contract active in ${asOf}`}>
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {inactive.map((r) => `${r.client} (${pretty(r.start)} → ${pretty(r.end)})`).join("; ")}. They are not in this month’s figures.
              </p>
            </Disclosure>
          )}
          {/* {noTime.length > 0 && asOf && (
            <Disclosure title={`No Everhour time for ${noTime.length} clients in ${asOf}`}>
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {noTime.join(", ")}. If time was logged, the client is probably named differently in Everhour — see Reconciliation.
              </p>
            </Disclosure>
          )} */}
          {/* {stale && <Banner tone="warn">One or more sources are stale or only partly loaded. Affected figures may be incomplete.</Banner>} */}
          {data && !workTypes.includes("Retainer") && (
            <Banner tone="info">
              Contracted hours relate to retainer scope. With retainer excluded, variance vs contract is not meaningful — use this view to inspect project or other time only.
            </Banner>
          )}
          {view && data && view.asOf === data.current && (
            <p className="text-sm text-muted-foreground">
              {formatMonth(view.asOf)} is the open month. Forecast is actual so far plus the remaining estimate, as of {data.today}.
            </p>
          )}

          {loading && !data && <p className="text-sm text-muted-foreground">Loading data…</p>}
          {view && (
            <Tabs defaultValue="portfolio">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="client">Client</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="recon">Dev Reconciliation (for Ankit)</TabsTrigger>
                <TabsTrigger value="capacity">Capacity</TabsTrigger>
                <TabsTrigger value="guide">Guide</TabsTrigger>
              </TabsList>
              <TabsContent value="portfolio" className="pt-2"><PortfolioTab view={view} /></TabsContent>
              <TabsContent value="client" className="pt-2"><ClientTab view={view} /></TabsContent>
              <TabsContent value="review" className="pt-2"><ReviewTab view={view} onSaved={() => void load()} /></TabsContent>
              <TabsContent value="recon" className="pt-2"><ReconTab view={view} /></TabsContent>
              <TabsContent value="capacity" className="pt-2"><CapacityTab view={view} /></TabsContent>
              <TabsContent value="guide" className="pt-2"><GuideTab threshold={threshold} /></TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}

function inactiveClients(data: DashboardPayload, asOf: string) {
  const span = new Map<string, { start: string; end: string }>();
  for (const c of data.contracts) {
    const cur = span.get(c.client);
    if (!cur) span.set(c.client, { start: c.contract_start, end: c.contract_end });
    else {
      if (c.contract_start < cur.start) cur.start = c.contract_start;
      if (c.contract_end > cur.end) cur.end = c.contract_end;
    }
  }
  const start = `${asOf}-01`;
  const end = monthEndIso(asOf);
  return [...span.entries()]
    .filter(([, r]) => r.start > end || r.end < start)
    .map(([client, r]) => ({ client, ...r }))
    .sort((a, b) => a.client.localeCompare(b.client));
}

function FilterGroup({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm min-w-0 w-full cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="truncate flex-1">{label}</span>
    </label>
  );
}

