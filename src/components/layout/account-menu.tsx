'use client';

import type { Permission, UserDto } from '@/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronsUpDown, CreditCard, Loader2, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/auth';

interface AccountLink {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  /** Hidden when the role lacks this. The API and the route both re-check it. */
  readonly permission?: Permission;
}

/**
 * The account menu's contents.
 *
 * Kept short on purpose. Every entry is a route that exists and does something
 * — there are no placeholders here for screens that have not been built, and
 * nothing is listed twice just to raise the item count. What belongs to the
 * *person* comes first, what belongs to the *organization* second.
 */
const ACCOUNT_LINKS: readonly AccountLink[] = [
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  {
    href: '/dashboard/settings',
    label: 'Notifications',
    icon: Bell,
    permission: 'notification:read',
  },
  {
    href: '/dashboard/billing',
    label: 'Billing & subscription',
    icon: CreditCard,
    permission: 'billing:read',
  },
];

export interface AccountMenuProps {
  readonly user: UserDto;
  readonly permissions: readonly Permission[];
}

/**
 * The signed-in person's own menu, at the foot of the sidebar.
 *
 * This replaced a static name, email and sign-out button. The name and email
 * are still the trigger — that is how someone confirms which account they are
 * in — but they now open the account-level destinations too, which is where a
 * user looks for billing and where they previously found nothing.
 */
export function AccountMenu({ user, permissions }: AccountMenuProps): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // The whole cache is dropped rather than just the session: everything in
      // it belongs to the person signing out.
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    },
  });

  const visible = ACCOUNT_LINKS.filter(
    (link) => link.permission === undefined || permissions.includes(link.permission),
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={`Account menu for ${user.name}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Account</DropdownMenuLabel>

        {visible.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            signOutMutation.mutate();
          }}
          disabled={signOutMutation.isPending}
        >
          {signOutMutation.isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
