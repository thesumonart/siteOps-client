import type { BillingRedirectDto, PlanCatalogDto, StartCheckoutInput } from '@/contracts';

import { apiRequest } from './api-client';

/**
 * Plans, prices and the organization's subscription.
 *
 * Nothing here decides anything. The plan a request is for travels as a plan
 * identifier — never a price, never an amount — and what the organization is
 * actually on is read back from the API, which learned it from a signed
 * provider webhook. A tampered response changes the words on screen and nothing
 * else.
 */

/**
 * The public price list.
 *
 * Unauthenticated, so the marketing page can render it server-side for a
 * visitor with no session. `headers` is threaded through only because a server
 * component makes its own request and does not inherit the browser's cookies —
 * this endpoint does not need them, but forwarding keeps every fetcher in this
 * directory the same shape.
 */
export async function fetchPlanCatalog(headers?: Record<string, string>): Promise<PlanCatalogDto> {
  return apiRequest<PlanCatalogDto>('/api/billing/plans', {
    ...(headers ? { headers } : {}),
  });
}

/**
 * Starts a checkout and returns where to send the browser.
 *
 * The response is a URL rather than a redirect because this is called with
 * `fetch`, which would follow a 302 into a cross-origin page it can do nothing
 * with. The caller navigates.
 */
export async function startCheckout(
  organizationId: string,
  input: StartCheckoutInput,
): Promise<BillingRedirectDto> {
  return apiRequest<BillingRedirectDto>(`/api/organizations/${organizationId}/billing/checkout`, {
    method: 'POST',
    body: input,
  });
}

/**
 * Opens the provider's management portal.
 *
 * Everything after the first purchase happens there — upgrade, downgrade,
 * cancel, payment method, invoices — so there is no SiteOps screen that edits a
 * subscription, and no request here that could name someone else's.
 */
export async function openBillingPortal(organizationId: string): Promise<BillingRedirectDto> {
  return apiRequest<BillingRedirectDto>(`/api/organizations/${organizationId}/billing/portal`, {
    method: 'POST',
  });
}
