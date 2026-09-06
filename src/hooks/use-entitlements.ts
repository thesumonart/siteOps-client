'use client';

import type { EntitlementsDto, PlanFeature } from '@/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchEntitlements } from '@/lib/entitlements';
import { queryKeys } from '@/lib/query-keys';

/**
 * The active organization's plan, features and current usage.
 *
 * A plan changes rarely, and only through checkout — which invalidates this
 * key — so it is cached for the length of a visit rather than refetched per
 * screen.
 */
export function useEntitlements(organizationId: string): UseQueryResult<EntitlementsDto, Error> {
  return useQuery({
    queryKey: queryKeys.entitlements(organizationId),
    queryFn: () => fetchEntitlements(organizationId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Whether the plan includes a feature, for presentation only.
 *
 * Returns `false` while the query is still loading, so a gated control starts
 * hidden and appears once the plan is known — the opposite would flash a button
 * that then disappears, or worse, one the user can click and be refused.
 */
export function useHasFeature(organizationId: string, feature: PlanFeature): boolean {
  const { data } = useEntitlements(organizationId);
  return data?.features.includes(feature) ?? false;
}
