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
    () => unique((data?.fact ?? []).filter((r) => selectedOwners.includes(r.account_owner)).map((r) => r.client)),
    [data, selectedOwners],
  );
  const selectedClients = (clientPick ? clientPick.filter((c) => clients.includes(c)) : clients);

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
        monthRows: data.fact.filter((r) => r.month === asOf && selectedClients.includes(r.client) && selectedOwners.includes(r.account_owner)),
        trendRows: data.fact.filter((r) => r.month >= from && r.month <= to && selectedClients.includes(r.client) && selectedOwners.includes(r.account_owner)),
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

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r bg-sidebar px-4 py-5">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Reload"}
          </Button>
          {data?.dataSource === "api" && (
            <Button variant="outline" size="sm" onClick={() => void pull()} disabled={pulling}>
              {pulling ? "Pulling…" : "Pull APIs"}
            </Button>
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
                onChange={(on) => setWorkTypes((prev) => (on ? [...new Set([...prev, w])] : prev.filter((x) => x !== w)))}
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
                className="justify-start"
                onClick={() => setBillable(v)}
              >
                {v}
              </Button>
            ))}
          </div>
        </FilterGroup>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Review threshold ±{threshold}%</Label>
          <Slider
            min={5}
            max={30}
            step={1}
            value={[threshold]}
            onValueChange={(value) => {
              const n = Array.isArray(value) ? value[0] : value;
              if (typeof n === "number") setThreshold(n);
            }}
          />
        </div>
        {months.length > 0 && asOf && from && to && (
          <>
            <MonthDatePicker label="Reporting month" value={asOf} months={months} onChange={setAsOf} />
            <MonthDatePicker label="Trend from" value={from} months={months} onChange={setRangeFrom} />
            <MonthDatePicker label="Trend to" value={to} months={months} onChange={setRangeTo} />
          </>
        )}
        <FilterGroup
          title="Account owner"
          action={
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setOwnerPick(ownerPick ? null : [])}>
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
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setClientPick(clientPick ? null : [])}>
              {clientPick ? "All" : "None"}
            </button>
          }
        >
          <Input
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Find a client"
            className="h-8"
          />
          <div className="max-h-40 space-y-1 overflow-auto">
            {clients.filter((c) => c.toLowerCase().includes(clientQuery.trim().toLowerCase())).map((c) => (
              <CheckRow
                key={c}
                label={c}
                checked={selectedClients.includes(c)}
                onChange={(on) => {
                  const base = clientPick ?? clients;
                  setClientPick(on ? [...new Set([...base, c])] : base.filter((x) => x !== c));
                }}
              />
            ))}
          </div>
        </FilterGroup>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-medium tracking-tight">Retainers</h1>
              <p className="text-sm text-muted-foreground">Contracted, planned, actual, and forecast hours.</p>
            </div>
            {data && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {data.freshness.map((f) => (
                  <Badge
                    key={f.source}
                    variant={f.state.includes("Check") ? "outline" : "secondary"}
                    title={`${f.status}. Covers ${f.period_start || "—"} to ${f.period_end || "—"}. Last success ${ageLabel(f.age_hours)}.`}
                  >
                    {f.source} · {f.state.includes("Check") ? "Check" : "Fresh"}
                  </Badge>
                ))}
              </div>
            )}
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
          {noTime.length > 0 && asOf && (
            <Disclosure title={`No Everhour time for ${noTime.length} clients in ${asOf}`}>
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {noTime.join(", ")}. If time was logged, the client is probably named differently in Everhour — see Reconciliation.
              </p>
            </Disclosure>
          )}
          {stale && <Banner tone="warn">One or more sources are stale or only partly loaded. Affected figures may be incomplete.</Banner>}
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
                <TabsTrigger value="recon">Reconciliation</TabsTrigger>
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
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="truncate">{label}</span>
    </label>
  );
}

