import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The padding and width policy for a dashboard page, in one place.
 *
 * Every page used to repeat `mx-auto w-full max-w-5xl` — with the number
 * varying between 3xl and 6xl for no reason anyone could name — inside a shell
 * that had already taken 256px for the sidebar. On a wide screen that left the
 * content in a narrow ribbon with dead space on both sides of it, and made the
 * tables that need width most (checks, incidents, audit entries) the ones that
 * got least.
 *
 * So there is no maximum. Content fills the space the shell gives it, and the
 * things that genuinely must not stretch — a line of prose, a text input —
 * carry their own constraint at the element that needs it, where it can be seen
 * next to what it applies to.
 *
 * Padding scales with the viewport rather than staying fixed, so a phone is not
 * given desktop gutters and a 27-inch monitor does not run text into the bezel.
 */
export function PageContainer({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.ReactElement {
  return (
    <div className={cn('w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8', className)}>{children}</div>
  );
}
