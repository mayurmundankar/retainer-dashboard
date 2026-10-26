import { SimpleTable } from "./bits";

const DEFINITIONS = [
  ["Contracted hours", "Signed commitment for the month, applied from each change's effective date. Partial months are prorated by days.", "Contracts"],
  ["Allocated hours", "Agreed delivery allocation for the month. Equals contracted unless a seasonal allocation exists.", "Contracts / seasonal plan"],
  ["Planned hours", "Hours planned for the month. Shown separately and never added to the forecast.", "Monday.com"],
  ["Actual hours", "Hours recorded so far under the current filters.", "Everhour"],
  ["Remaining estimate", "Hours still left on open items this month, after Everhour time already logged on those items.", "Monday.com / Everhour"],
  ["Forecast", "Actual + remaining estimate.", "Calculated"],
  ["Monthly variance", "Forecast − allocated, in hours and percent.", "Calculated"],
  ["Contract-to-date", "Cumulative actual vs cumulative contracted for the current contract. Resets on renewal.", "Calculated"],
  ["Delivery status", "Done, outstanding, and blocked items.", "Monday.com"],
  ["Data freshness", "Last successful refresh and the period covered, per source.", "Refresh log"],
];

export function GuideTab({ threshold }: { threshold: number }) {
  return (
    <div className="max-w-3xl space-y-6 text-sm">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b-2 border-[#4b439d]/25 pb-1 mb-2">Metric definitions</h2>
        <div className="mt-2 overflow-auto rounded-xl border border-border/80 shadow-xs">
          <SimpleTable
            rows={DEFINITIONS.map(([metric, definition, source]) => ({ metric, definition, source }))}
            columns={[
              { key: "metric", label: "Metric", className: "font-bold text-foreground min-w-[160px]" },
              { key: "definition", label: "Definition", className: "whitespace-normal text-foreground/90 font-normal leading-relaxed" },
              {
                key: "source",
                label: "Source",
                className: "whitespace-nowrap text-xs",
                render: (r) => (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4b439d]/15 text-[#4b439d] dark:text-[#a5b4fc] border border-[#4b439d]/30 shadow-2xs">
                    {r.source}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>
      <div className="space-y-3 text-xs leading-relaxed text-foreground/85 font-normal">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground border-b-2 border-[#4b439d]/25 pb-1 pt-2">Business rules</h2>
        <p><strong className="font-bold text-foreground">Review threshold:</strong> ±{threshold}% monthly and contract-to-date. Change it in the sidebar. The default lives in the app config.</p>
        <p><strong className="font-bold text-foreground">Review trigger:</strong> A flag is a review trigger. It is not an instruction to reduce delivery.</p>
        <p><strong className="font-bold text-foreground">Work types:</strong> Retainer work stays separate from separately commissioned projects. Use the work type filter.</p>
        <p><strong className="font-bold text-foreground">Client time:</strong> Non-billable client time (senior support, rework) is always shown on its own.</p>
        <p><strong className="font-bold text-foreground">Effective dates:</strong> Contract changes apply from their effective date, never retrospectively.</p>
        <p><strong className="font-bold text-foreground">Data integrity:</strong> Missing or stale source data is flagged. It is never displayed as zero.</p>
        <p><strong className="font-bold text-foreground">Deduplication:</strong> Duplicate Everhour entries are removed by entry ID. Unmapped client names are listed so they can be fixed in client_mapping.csv.</p>
      </div>
    </div>
  );
}
