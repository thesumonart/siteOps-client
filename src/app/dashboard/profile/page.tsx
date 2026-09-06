import { PLAN_LABELS } from '@/contracts';
import type { Metadata } from 'next';
import { format } from 'date-fns';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { fetchSession } from '@/lib/auth';
import { ChangePasswordForm } from './change-password-form';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = {
  title: 'Profile',
};

/**
 * The signed-in person's own account.
 *
 * Deliberately *not* organization-scoped, unlike every other dashboard route:
 * a name and a password belong to a person, who may be in several
 * organizations, and putting them under an organization would imply they can
 * differ between them. Anything that does vary by organization — the plan, the
 * alert preferences, the role — lives on its own screen and is linked from
 * here.
 */
export default async function ProfilePage(): Promise<React.ReactElement> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');
  const session = await fetchSession(cookie ? { cookie } : undefined);

  if (!session) redirect('/login?next=%2Fdashboard%2Fprofile');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          Your name, your sign-in details, and the organizations you belong to.
        </p>
      </header>

      <div className="space-y-10">
        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-sm font-semibold">
            Account
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {session.user.emailVerified ? (
              <>
                Signed in as {session.user.email}. Member since{' '}
                {format(new Date(session.user.createdAt), 'MMMM yyyy')}.
              </>
            ) : (
              <>Your email address has not been verified yet.</>
            )}
          </p>
          <ProfileForm user={session.user} />
        </section>

        <section aria-labelledby="security-heading" className="border-t pt-8">
          <h2 id="security-heading" className="text-sm font-semibold">
            Security
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Change the password you use to sign in.
          </p>
          <ChangePasswordForm />
        </section>

        <section aria-labelledby="organizations-heading" className="border-t pt-8">
          <h2 id="organizations-heading" className="text-sm font-semibold">
            Organizations
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Where you have access, and what you can do there. Switch between them from the sidebar.
          </p>

          <ul className="divide-y rounded-lg border">
            {session.memberships.map((membership) => (
              <li
                key={membership.organization.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{membership.organization.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Joined {format(new Date(membership.joinedAt), 'd MMMM yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PLAN_LABELS[membership.organization.plan]}</Badge>
                  <Badge variant="secondary">{membership.role}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
