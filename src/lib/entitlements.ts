import type { EntitlementsDto, SubscriptionDto } from '@/contracts';

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

/**
 * The organization's subscription: plan, status, renewal date, and whether this
 * deployment can take a payment at all.
 *
 * Separate from {@link fetchEntitlements} because the two answer different
 * questions and are read by different roles. Entitlements say what the plan
 * *allows* and every member may see them, so a locked button can explain
 * itself. This says what the organization *pays*, and only an owner holds
 * `billing:read`.
 */
export async function fetchSubscription(
  organizationId: string,
  headers?: Record<string, string>,
): Promise<SubscriptionDto> {
  return apiRequest<SubscriptionDto>(`/api/organizations/${organizationId}/subscription`, {
    ...(headers ? { headers } : {}),
  });
}
