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
        <h2 className="text-sm font-medium">Metric definitions</h2>
        <div className="mt-2 overflow-auto rounded-md border">
          <SimpleTable
            rows={DEFINITIONS.map(([metric, definition, source]) => ({ metric, definition, source }))}
            columns={[
              { key: "metric", label: "Metric" },
              { key: "definition", label: "Definition", className: "whitespace-normal" },
              { key: "source", label: "Source" },
            ]}
          />
        </div>
      </div>
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <h2 className="text-sm font-medium text-foreground">Business rules</h2>
        <p>Review threshold: ±{threshold}% monthly and contract-to-date. Change it in the sidebar. The default lives in the app config.</p>
        <p>A flag is a review trigger. It is not an instruction to reduce delivery.</p>
        <p>Retainer work stays separate from separately commissioned projects. Use the work type filter.</p>
        <p>Non-billable client time (senior support, rework) is always shown on its own.</p>
        <p>Contract changes apply from their effective date, never retrospectively.</p>
        <p>Missing or stale source data is flagged. It is never displayed as zero.</p>
        <p>Duplicate Everhour entries are removed by entry ID. Unmapped client names are listed so they can be fixed in client_mapping.csv.</p>
        <h2 className="pt-2 text-sm font-medium text-foreground">Storage and refresh</h2>
        <p>
          CSV files are stored in the private Supabase bucket dashboard-data. Until the Supabase URL and service role key are set in this app&apos;s .env, the dashboard reads the same files from the local data_files folder. Saving a review action appends a row to actions_log.csv and keeps the previous rows as history.
          When the data source is set to api, Pull from Everhour / Monday overwrites the Everhour and Monday CSVs, then the dashboard recalculates from those files.
        </p>
      </div>
    </div>
  );
}
