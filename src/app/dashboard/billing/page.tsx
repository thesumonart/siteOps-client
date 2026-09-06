import { hasPermission } from '@/contracts';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LoadingState } from '@/components/data-states';
import { ACTIVE_ORGANIZATION_COOKIE, resolveActiveOrganizationId } from '@/lib/active-organization';
import { fetchSession } from '@/lib/auth';
import { BillingView } from './billing-view';

export const metadata: Metadata = {
  title: 'Billing',
};

/**
 * Billing and subscription for the active organization.
 *
 * Subscriptions belong to an organization, not to a person: someone who owns
 * two agencies has two subscriptions, and the one shown here is the one whose
 * dashboard they are looking at. That is why the page reads the active
 * organization the same way every other dashboard route does, rather than
 * anything on the user record.
 */
export default async function BillingPage(): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  const session = await fetchSession(cookie ? { cookie } : undefined);

  if (!session) redirect('/login?next=%2Fdashboard%2Fbilling');

  const cookieStore = await cookies();
  const activeId = resolveActiveOrganizationId(
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null,
    session.memberships.map((entry) => entry.organization.id),
  );
  const active = session.memberships.find((entry) => entry.organization.id === activeId);
  if (!active || activeId === null) redirect('/onboarding');

  /*
   * A member without `billing:read` gets a 404 rather than a page explaining
   * that billing exists but is not for them. The API answers the same way, and
   * the two must not disagree about whether the route is there.
   */
  if (!hasPermission(active.role, 'billing:read')) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          The plan {active.organization.name} is on, what it is using, and what else is available.
        </p>
      </header>

      {/* `useSearchParams` reads the checkout outcome, which opts the subtree
          into client-side rendering — the boundary keeps that local. */}
      <Suspense fallback={<LoadingState label="Loading your subscription…" />}>
        <BillingView
          organizationId={activeId}
          organizationName={active.organization.name}
          canManage={hasPermission(active.role, 'billing:manage')}
        />
      </Suspense>
    </div>
  );
}
