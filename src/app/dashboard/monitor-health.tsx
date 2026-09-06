'use client';

import { MONITOR_TYPE_LABELS, type MonitorSummaryDto } from '@/contracts';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchMonitorSummary } from '@/lib/monitors';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export interface MonitorHealthProps {
  readonly organizationId: string;
}

/**
 * Where the auxiliary monitors stand across the whole organization.
 *
 * Only types that are switched on somewhere are shown. A row of six zeroes on a
 * new account tells nobody anything, and the empty card explains how to turn
 * one on instead.
 *
 * Renders nothing at all — not a spinner, not an empty card — while loading or
 * on failure. This sits below the numbers that matter, and a broken secondary
 * panel should not push the primary ones around or imply the dashboard is down.
 */
export function MonitorHealth({ organizationId }: MonitorHealthProps): React.ReactElement | null {
  const summary = useQuery({
    queryKey: queryKeys.monitorSummary(organizationId),
    queryFn: () => fetchMonitorSummary(),
    refetchInterval: 60_000,
  });

  if (summary.isPending || summary.isError) return null;

  const active = (summary.data ?? []).filter((row) => total(row) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks</CardTitle>
      </CardHeader>

      <CardContent>
        {active.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Certificate, domain, performance, content, SEO and broken-link checks are turned on per
            website. Open a website and use the Checks panel to switch one on.
          </p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((row) => (
              <MonitorRow key={row.type} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function total(row: MonitorSummaryDto): number {
  return row.passing + row.warning + row.failing + row.error + row.unknown;
}

function MonitorRow({ row }: { readonly row: MonitorSummaryDto }): React.ReactElement {
  const problems = row.failing + row.warning;

  return (
    <li className="rounded-lg border px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{MONITOR_TYPE_LABELS[row.type]}</p>
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            row.failing > 0
              ? 'text-status-down'
              : row.warning > 0
                ? 'text-status-degraded'
                : 'text-status-operational',
          )}
        >
          {problems > 0 ? problems : row.passing}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {problems > 0
          ? `${String(problems)} of ${String(total(row))} need attention`
          : `${String(row.passing)} of ${String(total(row))} passing`}
        {row.error > 0 ? ` · ${String(row.error)} could not be checked` : ''}
      </p>
    </li>
  );
}
