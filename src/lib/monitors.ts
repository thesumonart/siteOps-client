import type {
  CursorPaginatedResult,
  ListMonitorResultsQuery,
  MonitorDto,
  MonitorResultDto,
  MonitorSummaryDto,
  MonitorType,
  UpdateMonitorInput,
} from '@/contracts';

import { apiRequest } from './api-client';

/**
 * The auxiliary monitors: SSL, domain, performance, content, SEO and links.
 *
 * Addressed by `(websiteId, type)` rather than by id, matching the API. A
 * monitor is conceptually a property of the website — every website has all
 * six, most of them off — so the client never has to know whether a document
 * has been written for one yet.
 */

export async function fetchMonitors(websiteId: string): Promise<readonly MonitorDto[]> {
  const result = await apiRequest<{ items: readonly MonitorDto[] }>(
    `/api/websites/${websiteId}/monitors`,
  );
  return result.items;
}

export async function updateMonitor(
  websiteId: string,
  type: MonitorType,
  input: UpdateMonitorInput,
): Promise<MonitorDto> {
  return apiRequest<MonitorDto>(`/api/websites/${websiteId}/monitors/${type}`, {
    method: 'PATCH',
    body: input,
  });
}

/**
 * Asks for a run as soon as possible.
 *
 * Returns once the monitor is marked due; the check itself happens on the
 * worker, so the caller polls for the result rather than awaiting it.
 */
export async function runMonitorNow(websiteId: string, type: MonitorType): Promise<MonitorDto> {
  return apiRequest<MonitorDto>(`/api/websites/${websiteId}/monitors/${type}/run`, {
    method: 'POST',
  });
}

export async function fetchMonitorResults(
  monitorId: string,
  query: Partial<ListMonitorResultsQuery> = {},
): Promise<CursorPaginatedResult<MonitorResultDto>> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<CursorPaginatedResult<MonitorResultDto>>(
    `/api/monitors/${monitorId}/results${suffix}`,
  );
}

export async function fetchMonitorSummary(
  headers?: Record<string, string>,
): Promise<readonly MonitorSummaryDto[]> {
  const result = await apiRequest<{ items: readonly MonitorSummaryDto[] }>(
    '/api/monitors/summary',
    headers ? { headers } : {},
  );
  return result.items;
}
