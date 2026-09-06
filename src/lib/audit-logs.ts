import type {
  AuditActorDto,
  AuditLogDto,
  CursorPaginatedResult,
  ListAuditLogsQuery,
} from '@/contracts';

import { apiRequest } from './api-client';

/**
 * The organization activity feed.
 *
 * Read-only on purpose: there is no write or delete call here because the API
 * offers none. Entries are recorded by the action they describe, and removed
 * only when they age past the retention window.
 */

export async function fetchAuditLogs(
  query: Partial<ListAuditLogsQuery> = {},
): Promise<CursorPaginatedResult<AuditLogDto>> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.area) params.set('area', query.area);
  if (query.action) params.set('action', query.action);
  if (query.actorUserId) params.set('actorUserId', query.actorUserId);
  if (query.targetType) params.set('targetType', query.targetType);
  if (query.targetId) params.set('targetId', query.targetId);
  if (query.search) params.set('search', query.search);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<CursorPaginatedResult<AuditLogDto>>(`/api/audit-logs${suffix}`);
}

export async function fetchAuditActors(): Promise<readonly AuditActorDto[]> {
  const result = await apiRequest<{ items: readonly AuditActorDto[] }>('/api/audit-logs/actors');
  return result.items;
}
