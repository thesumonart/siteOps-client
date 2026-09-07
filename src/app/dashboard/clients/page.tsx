import { hasPermission, permissionsFor } from '@/contracts';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ACTIVE_ORGANIZATION_COOKIE, resolveActiveOrganizationId } from '@/lib/active-organization';
import { fetchSession } from '@/lib/auth';
import { PageContainer } from '@/components/layout/page-container';
import { ClientsView } from './clients-view';

export const metadata: Metadata = {
  title: 'Clients',
};

export default async function ClientsPage(): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  const session = await fetchSession(cookie ? { cookie } : undefined);

  if (!session) redirect('/login?next=%2Fdashboard%2Fclients');

  const cookieStore = await cookies();
  const activeId = resolveActiveOrganizationId(
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null,
    session.memberships.map((entry) => entry.organization.id),
  );
  const active = session.memberships.find((entry) => entry.organization.id === activeId);
  if (!active || activeId === null) redirect('/onboarding');

  /*
   * A client contact holds no client capability at all, so this page does not
   * exist for them — which is exactly right: they must not be able to discover
   * that the agency has other customers.
   */
  if (!hasPermission(active.role, 'client:read')) notFound();

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Group websites by client, and give each client&rsquo;s own contacts a read-only view of
          just their sites.
        </p>
      </header>

      <ClientsView organizationId={activeId} permissions={permissionsFor(active.role)} />
    </PageContainer>
  );
}
