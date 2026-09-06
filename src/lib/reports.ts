import type {
  CreateReportInput,
  CursorPaginatedResult,
  ListReportsQuery,
  ReportDto,
  ReportFormat,
  ReportScheduleDto,
  ReportScheduleInput,
  UpdateReportScheduleInput,
} from '@/contracts';

import { apiRequest } from './api-client';
import { env } from './env';

/**
 * Generated reports and their schedules.
 *
 * Requesting a report queues it; the worker builds it. The list is polled while
 * anything is still pending, because there is no push channel and a report that
 * silently never appears is worse than a spinner.
 */

export async function fetchReports(
  query: Partial<ListReportsQuery> = {},
): Promise<CursorPaginatedResult<ReportDto>> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.type) params.set('type', query.type);

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<CursorPaginatedResult<ReportDto>>(`/api/reports${suffix}`);
}

export async function fetchReport(reportId: string): Promise<ReportDto> {
  return apiRequest<ReportDto>(`/api/reports/${reportId}`);
}

export async function createReport(input: CreateReportInput): Promise<ReportDto> {
  return apiRequest<ReportDto>('/api/reports', { method: 'POST', body: input });
}

export async function deleteReport(reportId: string): Promise<void> {
  await apiRequest(`/api/reports/${reportId}`, { method: 'DELETE' });
}

/**
 * The URL a download link points at.
 *
 * A plain link rather than a fetch-and-blob, so the browser handles the
 * download itself: it shows real progress, writes to the user's download
 * folder, and does not hold a multi-megabyte buffer in the tab. The session
 * cookie travels with the navigation, which is why no token has to be
 * constructed here.
 */
export function reportDownloadUrl(reportId: string, format: ReportFormat): string {
  return `${env.NEXT_PUBLIC_API_URL}/api/reports/${reportId}/download?format=${format}`;
}

export async function fetchReportSchedules(): Promise<readonly ReportScheduleDto[]> {
  const result = await apiRequest<{ items: readonly ReportScheduleDto[] }>(
    '/api/reports/schedules',
  );
  return result.items;
}

export async function createReportSchedule(input: ReportScheduleInput): Promise<ReportScheduleDto> {
  return apiRequest<ReportScheduleDto>('/api/reports/schedules', {
    method: 'POST',
    body: input,
  });
}

export async function updateReportSchedule(
  scheduleId: string,
  input: UpdateReportScheduleInput,
): Promise<ReportScheduleDto> {
  return apiRequest<ReportScheduleDto>(`/api/reports/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteReportSchedule(scheduleId: string): Promise<void> {
  await apiRequest(`/api/reports/schedules/${scheduleId}`, { method: 'DELETE' });
}
