import { hasPermission, permissionsFor } from '@/contracts';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ACTIVE_ORGANIZATION_COOKIE, resolveActiveOrganizationId } from '@/lib/active-organization';
import { fetchSession } from '@/lib/auth';
import { PageContainer } from '@/components/layout/page-container';
import { ReportsView } from './reports-view';

export const metadata: Metadata = {
  title: 'Reports',
};

export default async function ReportsPage(): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  const session = await fetchSession(cookie ? { cookie } : undefined);

  if (!session) redirect('/login?next=%2Fdashboard%2Freports');

  const cookieStore = await cookies();
  const activeId = resolveActiveOrganizationId(
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null,
    session.memberships.map((entry) => entry.organization.id),
  );
  const active = session.memberships.find((entry) => entry.organization.id === activeId);
  if (!active || activeId === null) redirect('/onboarding');

  // The API answers 404 for a role without this capability; the route table
  // should not disagree with it about whether the page exists.
  if (!hasPermission(active.role, 'report:read')) notFound();

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Monitoring summaries for {active.organization.name}, built from recorded checks and
          downloadable as PDF, CSV or JSON.
        </p>
      </header>

      <ReportsView organizationId={activeId} permissions={permissionsFor(active.role)} />
    </PageContainer>
  );
}
