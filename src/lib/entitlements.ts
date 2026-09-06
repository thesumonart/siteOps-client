import type { EntitlementsDto } from '@/contracts';

import { apiRequest } from './api-client';

/**
 * What the active organization's plan allows.
 *
 * Used to explain a locked feature before the user runs into it, never to
 * decide whether an action is permitted — the API re-checks every entitlement
 * on the request itself, so a tampered response here changes nothing but the
 * wording on screen.
 */
export async function fetchEntitlements(
  organizationId: string,
  headers?: Record<string, string>,
): Promise<EntitlementsDto> {
  return apiRequest<EntitlementsDto>(`/api/organizations/${organizationId}/entitlements`, {
    ...(headers ? { headers } : {}),
  });
}
