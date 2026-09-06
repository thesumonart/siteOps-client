import { hasPermission } from '@/contracts';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ACTIVE_ORGANIZATION_COOKIE, resolveActiveOrganizationId } from '@/lib/active-organization';
import { fetchSession } from '@/lib/auth';
import { AuditLogsView } from './audit-logs-view';

export const metadata: Metadata = {
  title: 'Audit log',
};

export default async function AuditLogsPage(): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  const session = await fetchSession(cookie ? { cookie } : undefined);

  if (!session) redirect('/login?next=%2Fdashboard%2Faudit-logs');

  const cookieStore = await cookies();
  const activeId = resolveActiveOrganizationId(
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null,
    session.memberships.map((entry) => entry.organization.id),
  );
  const active = session.memberships.find((entry) => entry.organization.id === activeId);
  if (!active || activeId === null) redirect('/onboarding');

  /*
   * A member without `audit_log:read` gets a 404 rather than a message saying
   * the page exists but is not for them. The API answers the same way, and the
   * two should not disagree about whether the route is there.
   */
  if (!hasPermission(active.role, 'audit_log:read')) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Every change made inside {active.organization.name}, and who made it. Entries cannot be
          edited or deleted.
        </p>
      </header>

      <AuditLogsView organizationId={activeId} />
    </div>
  );
}
