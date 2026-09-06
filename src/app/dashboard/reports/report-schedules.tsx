'use client';

import {
  PLAN_LABELS,
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  SCHEDULE_FREQUENCIES,
  SCHEDULE_FREQUENCY_LABELS,
  WEEKDAY_LABELS,
  cheapestPlanWith,
  type ReportScheduleDto,
  type ReportScheduleInput,
  type ScheduleFrequency,
} from '@/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEntitlements } from '@/hooks/use-entitlements';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  createReportSchedule,
  deleteReportSchedule,
  fetchReportSchedules,
  updateReportSchedule,
} from '@/lib/reports';

export interface ReportSchedulesProps {
  readonly organizationId: string;
  readonly canManage: boolean;
}

/**
 * Recurring reports.
 *
 * Times are UTC and the form says so rather than converting silently. A
 * schedule that arrives an hour early after a clock change is a support ticket
 * nobody can diagnose, and "08:00 UTC" is unambiguous in a way "08:00" is not.
 */
export function ReportSchedules({
  organizationId,
  canManage,
}: ReportSchedulesProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ReportScheduleDto | null>(null);

  const entitlements = useEntitlements(organizationId);
  const allowed = entitlements.data?.features.includes('scheduled_reports') ?? false;

  const schedules = useQuery({
    queryKey: queryKeys.reportSchedules(organizationId),
    queryFn: () => fetchReportSchedules(),
    enabled: allowed && canManage,
  });

  const invalidate = async (): Promise<void> => {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.reportSchedules(organizationId) });
  };

  const onError = (error: Error): void => {
    setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
  };

  const create = useMutation({
    mutationFn: (input: ReportScheduleInput) => createReportSchedule(input),
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    },
    onError,
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateReportSchedule(id, { enabled }),
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: (scheduleId: string) => deleteReportSchedule(scheduleId),
    onSuccess: async () => {
      setConfirmDelete(null);
      await invalidate();
    },
    onError,
  });

  // Schedules decide what is emailed to a client every month, so the panel is
  // simply absent for a role that cannot manage them rather than shown disabled.
  if (!canManage) return <></>;

  if (entitlements.isPending) return <SkeletonRows label="Loading schedules…" rows={2} />;

  if (!allowed) {
    const required = cheapestPlanWith('scheduled_reports');
    return (
      <FeatureLockedState
        feature="Scheduled reports"
        requiredPlan={required ? PLAN_LABELS[required] : 'a paid plan'}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Schedules</CardTitle>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Reports generated and emailed automatically. Times are UTC.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
          }}
        >
          New schedule
        </Button>
      </CardHeader>

      <CardContent className="grid gap-3">
        {actionError ? <Alert variant="error">{actionError}</Alert> : null}

        {schedules.isPending ? (
          <SkeletonRows label="Loading schedules…" rows={2} />
        ) : schedules.isError ? (
          <ErrorState
            title="Could not load schedules"
            onRetry={() => {
              void schedules.refetch();
            }}
          />
        ) : (schedules.data ?? []).length === 0 ? (
          <EmptyState
            title="No schedules"
            description="Set one up to have a report generated and emailed on a weekly or monthly cadence."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {(schedules.data ?? []).map((schedule) => (
              <li
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{schedule.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {describeCadence(schedule)} · {REPORT_FORMAT_LABELS[schedule.format]} ·{' '}
                    {schedule.recipients.length}{' '}
                    {schedule.recipients.length === 1 ? 'recipient' : 'recipients'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {schedule.enabled && schedule.nextRunAt ? (
                      <>
                        Next <RelativeTime iso={schedule.nextRunAt} />
                      </>
                    ) : (
                      'Paused'
                    )}
                    {schedule.lastRunAt ? (
                      <>
                        {' · last sent '}
                        <RelativeTime iso={schedule.lastRunAt} />
                      </>
                    ) : null}
                  </p>
                  {schedule.lastError ? (
                    <p className="mt-1 text-xs text-status-down">{schedule.lastError}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={toggle.isPending}
                    onClick={() => {
                      toggle.mutate({ id: schedule.id, enabled: !schedule.enabled });
                    }}
                  >
                    {schedule.enabled ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete schedule"
                    onClick={() => {
                      setConfirmDelete(schedule);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {creating ? (
        <ScheduleDialog
          saving={create.isPending}
          onCancel={() => {
            setCreating(false);
          }}
          onSave={(input) => {
            create.mutate(input);
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
              <DialogTitle>Delete this schedule?</DialogTitle>
              <DialogDescription>
                {confirmDelete.name} will stop sending. Reports it already produced are kept.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() => {
                  setConfirmDelete(null);
                }}
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
    </Card>
  );
}

function describeCadence(schedule: ReportScheduleDto): string {
  const hour = `${String(schedule.hourUtc).padStart(2, '0')}:00 UTC`;
  return schedule.frequency === 'monthly'
    ? `Monthly on the 1st at ${hour}`
    : `Every ${WEEKDAY_LABELS[schedule.dayOfWeek] ?? 'Monday'} at ${hour}`;
}

function ScheduleDialog({
  saving,
  onCancel,
  onSave,
}: {
  readonly saving: boolean;
  readonly onCancel: () => void;
  readonly onSave: (input: ReportScheduleInput) => void;
}): React.ReactElement {
  const [name, setName] = useState('Monthly monitoring report');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('monthly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hourUtc, setHourUtc] = useState(8);
  const [format, setFormat] = useState<(typeof REPORT_FORMATS)[number]>('pdf');
  const [recipients, setRecipients] = useState('');

  const parsedRecipients = recipients
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

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
            onSave({
              name,
              frequency,
              dayOfWeek,
              hourUtc,
              type: 'organization',
              format,
              recipients: parsedRecipients,
              enabled: true,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New schedule</DialogTitle>
            <DialogDescription>
              A report covering every website, generated and emailed on this cadence.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-name">Name</Label>
              <Input
                id="schedule-name"
                value={name}
                required
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-frequency">How often</Label>
                <select
                  id="schedule-frequency"
                  value={frequency}
                  onChange={(event) => {
                    setFrequency(event.target.value as ScheduleFrequency);
                  }}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {SCHEDULE_FREQUENCIES.map((value) => (
                    <option key={value} value={value}>
                      {SCHEDULE_FREQUENCY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="schedule-hour">Hour (UTC)</Label>
                <Input
                  id="schedule-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={hourUtc}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isNaN(parsed)) setHourUtc(parsed);
                  }}
                />
              </div>
            </div>

            {frequency === 'weekly' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="schedule-day">Day</Label>
                <select
                  id="schedule-day"
                  value={dayOfWeek}
                  onChange={(event) => {
                    setDayOfWeek(Number(event.target.value));
                  }}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                A monthly report runs on the 1st and covers the calendar month that just ended.
              </p>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="schedule-format">Format</Label>
              <select
                id="schedule-format"
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as (typeof REPORT_FORMATS)[number]);
                }}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {REPORT_FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {REPORT_FORMAT_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="schedule-recipients">Recipients</Label>
              <Input
                id="schedule-recipients"
                placeholder="client@example.com, team@example.com"
                value={recipients}
                onChange={(event) => {
                  setRecipients(event.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Each address receives its own copy, so recipients never see one
                another.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || parsedRecipients.length === 0}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
