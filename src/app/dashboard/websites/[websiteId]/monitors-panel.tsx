'use client';

import {
  MONITOR_FEATURE,
  MONITOR_INTERVAL_LABELS,
  MONITOR_INTERVALS_SECONDS,
  MONITOR_TYPE_DESCRIPTIONS,
  MONITOR_TYPE_LABELS,
  PLAN_LABELS,
  cheapestPlanWith,
  type MonitorDto,
  type MonitorType,
  type UpdateMonitorInput,
} from '@/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { ErrorState, SkeletonRows } from '@/components/data-states';
import { MonitorStatusBadge } from '@/components/monitor-status-badge';
import { RelativeTime } from '@/components/relative-time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEntitlements } from '@/hooks/use-entitlements';
import { ApiError } from '@/lib/api-client';
import { formatRemainingDays, remainingDays } from '@/lib/expiry';
import { fetchMonitors, runMonitorNow, updateMonitor } from '@/lib/monitors';
import { queryKeys } from '@/lib/query-keys';
import { MonitorConfigDialog } from './monitor-config-dialog';
import { MonitorResultDetail } from './monitor-result-detail';

/**
 * A one-line summary whose numbers are current, for the monitors that carry a
 * countdown.
 *
 * `lastSummary` is prose the server wrote when the check ran — "31 days
 * remaining" — and it is a day stale by the next morning and frozen entirely if
 * the monitor stops running. That is precisely when a certificate countdown
 * matters most, so the two monitors with an expiry date get their line rebuilt
 * from the date itself.
 *
 * Returns null for everything else, and for a run that produced no date, so the
 * caller falls back to the server's own wording rather than inventing one.
 */
function liveSummary(monitor: MonitorDto): string | null {
  const result = monitor.latestResult;
  if (!result) return null;

  if (result.data.type === 'ssl') {
    const remaining = remainingDays(result.data.validTo, result.data.daysRemaining);
    if (remaining === null) return null;

    const issuer = result.data.issuer ? `Issued by ${result.data.issuer}` : 'Certificate';
    return remaining.days < 0
      ? `${issuer} — ${formatRemainingDays(remaining).toLowerCase()}.`
      : `${issuer}, ${formatRemainingDays(remaining)} remaining.`;
  }

  if (result.data.type === 'domain') {
    const remaining = remainingDays(result.data.expiresAt, result.data.daysRemaining);
    if (remaining === null) return null;

    const registrar = result.data.registrar
      ? `Registered with ${result.data.registrar}`
      : 'Registration';
    return remaining.days < 0
      ? `${registrar} — ${formatRemainingDays(remaining).toLowerCase()}.`
      : `${registrar}, ${formatRemainingDays(remaining)} remaining.`;
  }

  return null;
}

export interface MonitorsPanelProps {
  readonly organizationId: string;
  readonly websiteId: string;
  readonly canConfigure: boolean;
}

/**
 * The six auxiliary monitors for one website.
 *
 * Every type is listed, including the ones the plan does not include. Hiding
 * them would leave someone unable to discover a feature exists; showing them
 * with the plan that unlocks it is the honest version of an upsell, and it
 * costs nothing because the API refuses the request either way.
 *
 * The list is polled while any monitor is due, because a run happens on the
 * worker rather than in the request that asked for it — otherwise pressing
 * "Run now" would appear to do nothing until the page was reloaded.
 */
export function MonitorsPanel({
  organizationId,
  websiteId,
  canConfigure,
}: MonitorsPanelProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<MonitorDto | null>(null);
  const [expanded, setExpanded] = useState<MonitorType | null>(null);

  const entitlements = useEntitlements(organizationId);

  const monitors = useQuery({
    queryKey: queryKeys.monitors(organizationId, websiteId),
    queryFn: () => fetchMonitors(websiteId),
    /*
     * A monitor that is enabled but has not produced its first result is
     * waiting on the worker. Poll until it has one, then stop: steady-state
     * data changes at most hourly and does not deserve a timer.
     */
    refetchInterval: (query) =>
      (query.state.data ?? []).some((monitor) => monitor.enabled && monitor.latestResult === null)
        ? 10_000
        : false,
  });

  const invalidate = async (): Promise<void> => {
    setActionError(null);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.monitors(organizationId, websiteId),
    });
  };

  const onError = (error: Error): void => {
    setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
  };

  const toggle = useMutation({
    mutationFn: ({ type, enabled }: { type: MonitorType; enabled: boolean }) =>
      updateMonitor(websiteId, type, { enabled }),
    onSuccess: invalidate,
    onError,
  });

  const configure = useMutation({
    mutationFn: ({ type, input }: { type: MonitorType; input: UpdateMonitorInput }) =>
      updateMonitor(websiteId, type, input),
    onSuccess: async () => {
      setConfiguring(null);
      await invalidate();
    },
    onError,
  });

  const runNow = useMutation({
    mutationFn: (type: MonitorType) => runMonitorNow(websiteId, type),
    onSuccess: invalidate,
    onError,
  });

  if (monitors.isPending || entitlements.isPending) {
    return <SkeletonRows label="Loading monitors…" rows={6} />;
  }

  if (monitors.isError) {
    return (
      <ErrorState
        title="Could not load monitors"
        onRetry={() => {
          void monitors.refetch();
        }}
      />
    );
  }

  const features = entitlements.data?.features ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks</CardTitle>
        <p className="text-sm text-pretty text-muted-foreground">
          Uptime is checked continuously. These run on their own schedule, from hourly to weekly.
        </p>
      </CardHeader>

      <CardContent className="grid gap-3">
        {actionError ? <Alert variant="error">{actionError}</Alert> : null}

        <ul className="divide-y rounded-lg border">
          {(monitors.data ?? []).map((monitor) => {
            const included = features.includes(MONITOR_FEATURE[monitor.type]);
            const requiredPlan = cheapestPlanWith(MONITOR_FEATURE[monitor.type]);

            return (
              <li key={monitor.type} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{MONITOR_TYPE_LABELS[monitor.type]}</p>
                      {monitor.enabled ? (
                        <MonitorStatusBadge
                          status={monitor.status}
                          hasRun={monitor.lastRunAt !== null}
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 max-w-prose text-xs text-pretty text-muted-foreground">
                      {monitor.enabled
                        ? (liveSummary(monitor) ??
                          monitor.lastSummary ??
                          MONITOR_TYPE_DESCRIPTIONS[monitor.type])
                        : MONITOR_TYPE_DESCRIPTIONS[monitor.type]}
                    </p>
                    {monitor.enabled ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {MONITOR_INTERVAL_LABELS[monitor.intervalSeconds] ??
                          `Every ${String(Math.round(monitor.intervalSeconds / 3600))} hours`}
                        {monitor.lastRunAt ? (
                          <>
                            {' · last run '}
                            <RelativeTime iso={monitor.lastRunAt} />
                          </>
                        ) : (
                          ' · waiting for the first run'
                        )}
                      </p>
                    ) : !included && requiredPlan ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Included from {PLAN_LABELS[requiredPlan]}.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {monitor.enabled && monitor.latestResult ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={expanded === monitor.type}
                        onClick={() => {
                          setExpanded((current) =>
                            current === monitor.type ? null : monitor.type,
                          );
                        }}
                      >
                        {expanded === monitor.type ? 'Hide' : 'Details'}
                      </Button>
                    ) : null}

                    {canConfigure && monitor.enabled ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={runNow.isPending}
                          onClick={() => {
                            runNow.mutate(monitor.type);
                          }}
                        >
                          <RefreshCw aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">Run now</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setConfiguring(monitor);
                          }}
                        >
                          Configure
                        </Button>
                      </>
                    ) : null}

                    {canConfigure ? (
                      <Button
                        size="sm"
                        variant={monitor.enabled ? 'ghost' : 'default'}
                        disabled={toggle.isPending || (!included && !monitor.enabled)}
                        onClick={() => {
                          toggle.mutate({ type: monitor.type, enabled: !monitor.enabled });
                        }}
                      >
                        {toggle.isPending && toggle.variables?.type === monitor.type ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : null}
                        {monitor.enabled ? 'Turn off' : 'Turn on'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {expanded === monitor.type && monitor.latestResult ? (
                  <MonitorResultDetail result={monitor.latestResult} className="mt-3" />
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>

      {configuring ? (
        <MonitorConfigDialog
          monitor={configuring}
          saving={configure.isPending}
          intervals={MONITOR_INTERVALS_SECONDS}
          onCancel={() => {
            setConfiguring(null);
          }}
          onSave={(input) => {
            configure.mutate({ type: configuring.type, input });
          }}
        />
      ) : null}
    </Card>
  );
}
