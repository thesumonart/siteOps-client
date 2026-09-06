'use client';

import {
  PLAN_LABELS,
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  REPORT_PERIODS,
  REPORT_PERIOD_LABELS,
  REPORT_STATUS_LABELS,
  cheapestPlanWith,
  formatDuration,
  formatResponseTime,
  formatUptimePercentage,
  type Permission,
  type ReportDto,
  type ReportPeriod,
} from '@/contracts';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, FeatureLockedState, SkeletonRows } from '@/components/data-states';
import { RelativeTime } from '@/components/relative-time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useEntitlements } from '@/hooks/use-entitlements';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { createReport, deleteReport, fetchReports, reportDownloadUrl } from '@/lib/reports';
import { cn } from '@/lib/utils';
import { ReportSchedules } from './report-schedules';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, string> = {
  ready: 'text-status-operational',
  failed: 'text-status-down',
  generating: 'text-status-degraded',
  pending: 'text-muted-foreground',
};

export interface ReportsViewProps {
  readonly organizationId: string;
  readonly permissions: readonly Permission[];
}

/**
 * Generated reports and the schedules that produce them.
 *
 * Requesting a report queues it on the worker, so the list polls while anything
 * is still pending. There is no push channel, and a report that silently never
 * appears is worse than a spinner that stops on its own once the queue drains.
 */
export function ReportsView({ organizationId, permissions }: ReportsViewProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ReportDto | null>(null);

  const canCreate = permissions.includes('report:create');
  const canManage = permissions.includes('report:manage');

  const entitlements = useEntitlements(organizationId);
  const allowed = entitlements.data?.features.includes('reports') ?? false;

  const reports = useInfiniteQuery({
    queryKey: queryKeys.reports(organizationId),
    queryFn: ({ pageParam }) =>
      fetchReports({ pageSize: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: allowed,
    /*
     * Poll only while something is still being built, then stop. A finished
     * list changes when somebody presses a button, which already invalidates
     * this key.
     */
    refetchInterval: (query) =>
      (query.state.data?.pages ?? []).some((page) =>
        page.items.some((report) => report.status === 'pending' || report.status === 'generating'),
      )
        ? 5_000
        : false,
  });

  const invalidate = async (): Promise<void> => {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports(organizationId) });
  };

  const onError = (error: Error): void => {
    setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
  };

  const request = useMutation({
    mutationFn: (period: ReportPeriod) => createReport({ type: 'organization', period }),
    onSuccess: async () => {
      setRequesting(false);
      await invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (reportId: string) => deleteReport(reportId),
    onSuccess: async () => {
      setConfirmDelete(null);
      await invalidate();
    },
    onError,
  });

  if (entitlements.isPending) return <SkeletonRows label="Loading reports…" rows={5} />;

  if (!allowed) {
    const required = cheapestPlanWith('reports');
    return (
      <FeatureLockedState
        feature="Reports"
        requiredPlan={required ? PLAN_LABELS[required] : 'a paid plan'}
      />
    );
  }

  const items = reports.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid gap-6">
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Reports</CardTitle>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              A snapshot of uptime, response times and incidents for a period. Generated in the
              background and downloadable as PDF, CSV or JSON.
            </p>
          </div>
          {canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                setRequesting(true);
              }}
            >
              New report
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          {reports.isPending ? (
            <SkeletonRows label="Loading reports…" rows={4} />
          ) : reports.isError ? (
            <ErrorState
              title="Could not load reports"
              onRetry={() => {
                void reports.refetch();
              }}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Generate one to summarise a period, or set up a schedule below to have it sent automatically."
            />
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {items.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    canManage={canManage}
                    onDelete={() => {
                      setConfirmDelete(report);
                    }}
                  />
                ))}
              </ul>

              {reports.hasNextPage ? (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reports.isFetchingNextPage}
                    onClick={() => {
                      void reports.fetchNextPage();
                    }}
                  >
                    {reports.isFetchingNextPage ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Loading…
                      </>
                    ) : (
                      'Load older reports'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <ReportSchedules organizationId={organizationId} canManage={canManage} />

      {requesting ? (
        <RequestReportDialog
          saving={request.isPending}
          onCancel={() => {
            setRequesting(false);
          }}
          onConfirm={(period) => {
            request.mutate(period);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmDelete(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this report?</DialogTitle>
              <DialogDescription>
                {confirmDelete.title} will be removed permanently. The monitoring data it summarised
                is not affected.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDelete(null);
                }}
                disabled={remove.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(confirmDelete.id);
                }}
              >
                {remove.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function ReportRow({
  report,
  canManage,
  onDelete,
}: {
  readonly report: ReportDto;
  readonly canManage: boolean;
  readonly onDelete: () => void;
}): React.ReactElement {
  const period = `${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{report.title}</p>
          <span className={cn('text-xs font-medium', STATUS_TONE[report.status])}>
            {REPORT_STATUS_LABELS[report.status]}
          </span>
          {report.scheduled ? (
            <span className="text-xs text-muted-foreground">· scheduled</span>
          ) : null}
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {period} · requested <RelativeTime iso={report.createdAt} />
        </p>

        {report.summary ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {report.summary.websiteCount}{' '}
            {report.summary.websiteCount === 1 ? 'website' : 'websites'} ·{' '}
            {formatUptimePercentage(report.summary.overallUptimePercentage)} uptime ·{' '}
            {formatResponseTime(report.summary.averageResponseTimeMs)} average ·{' '}
            {report.summary.totalIncidents}{' '}
            {report.summary.totalIncidents === 1 ? 'incident' : 'incidents'}
            {report.summary.totalDowntimeSeconds > 0
              ? ` · ${formatDuration(report.summary.totalDowntimeSeconds)} down`
              : ''}
          </p>
        ) : null}

        {report.status === 'failed' && report.errorMessage ? (
          <p className="mt-1 text-xs text-status-down">{report.errorMessage}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {report.status === 'ready' ? (
          REPORT_FORMATS.map((format) => (
            <Button key={format} size="sm" variant="outline" asChild>
              {/*
                A plain link, not a fetch-and-blob: the browser handles the
                download itself, shows real progress and does not hold a
                multi-megabyte buffer in the tab. The session cookie travels
                with the navigation.
              */}
              <a href={reportDownloadUrl(report.id, format)} download>
                {format === 'pdf' ? <Download aria-hidden="true" /> : null}
                {REPORT_FORMAT_LABELS[format]}
              </a>
            </Button>
          ))
        ) : report.status === 'pending' || report.status === 'generating' ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Building
          </span>
        ) : null}

        {canManage ? (
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete report">
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function RequestReportDialog({
  saving,
  onCancel,
  onConfirm,
}: {
  readonly saving: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (period: ReportPeriod) => void;
}): React.ReactElement {
  const [period, setPeriod] = useState<ReportPeriod>('last_30_days');

  // A custom range needs two date fields and a validated pair; the named
  // periods cover what people actually ask for, so this dialog offers those and
  // the API takes a custom range for anyone driving it directly.
  const selectable = REPORT_PERIODS.filter((value) => value !== 'custom');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(period);
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate a report</DialogTitle>
            <DialogDescription>
              Covers every website in this organization. It is built in the background and appears
              in the list when it is ready.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 py-4">
            <Label htmlFor="report-period">Period</Label>
            <select
              id="report-period"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as ReportPeriod);
              }}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {selectable.map((value) => (
                <option key={value} value={value}>
                  {REPORT_PERIOD_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
