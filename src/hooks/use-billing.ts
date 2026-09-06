'use client';

import type { PlanCatalogDto, SubscriptionDto } from '@/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useRef } from 'react';

import { fetchPlanCatalog } from '@/lib/billing';
import { fetchSubscription } from '@/lib/entitlements';
import { queryKeys } from '@/lib/query-keys';

const ACTIVATION_POLL_INTERVAL_MS = 2_000;
const ACTIVATION_POLL_LIMIT_MS = 60_000;

/**
 * The organization's subscription.
 *
 * Refetched when the window regains focus, unlike entitlements: the plan
 * changes at the payment provider, in another tab, and the webhook that records
 * it arrives while the user is still over there. Coming back to a page that
 * still says "Free" after paying is the one moment this screen must get right.
 */
export function useSubscription(
  organizationId: string,
  options: {
    /**
     * Poll until the plan changes.
     *
     * Set on return from a completed checkout. The payment is done but the plan
     * is granted by a webhook, which usually lands within a second or two of
     * the browser — so the screen watches for it rather than showing "Free" to
     * someone who has just paid and leaving them to reload. Polling stops as
     * soon as a subscription exists, and after a minute regardless: a webhook
     * that has not arrived by then needs a person, not more requests.
     */
    readonly awaitingActivation?: boolean;
  } = {},
): UseQueryResult<SubscriptionDto, Error> {
  /*
   * Started on the first poll rather than during render: reading the clock
   * while rendering is impure, and React may render a component more than once
   * for the same commit. The callback below runs outside render, so the first
   * tick is where the window legitimately begins.
   */
  const startedAt = useRef<number | null>(null);

  return useQuery({
    queryKey: queryKeys.subscription(organizationId),
    queryFn: () => fetchSubscription(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (options.awaitingActivation !== true) return false;
      if (query.state.data?.status !== 'none') return false;

      startedAt.current ??= Date.now();
      if (Date.now() - startedAt.current > ACTIVATION_POLL_LIMIT_MS) return false;

      return ACTIVATION_POLL_INTERVAL_MS;
    },
  });
}

/**
 * The public plan catalogue.
 *
 * Prices and limits change only on a deployment, so this is cached for the
 * length of the visit.
 */
export function usePlanCatalog(): UseQueryResult<PlanCatalogDto, Error> {
  return useQuery({
    queryKey: queryKeys.planCatalog,
    queryFn: () => fetchPlanCatalog(),
    staleTime: 30 * 60_000,
  });
}
