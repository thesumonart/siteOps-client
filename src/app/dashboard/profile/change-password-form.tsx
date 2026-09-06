'use client';

import { changePasswordSchema, type ChangePasswordInput } from '@/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Field } from '@/components/forms/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { changePassword } from '@/lib/auth';

/**
 * Changing the account password.
 *
 * The current password is required — the API enforces it, and a form that did
 * not ask would let anyone who found an unlocked laptop take the account
 * permanently. Every other session is ended on success, which is stated on the
 * form rather than offered as a checkbox: the usual reason to change a password
 * is that someone else may have it, and leaving their session alive does not
 * solve that.
 */
export function ChangePasswordForm(): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordInput) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      setError(null);
      setDone(true);
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (mutationError: unknown) => {
      setDone(false);

      /*
       * A wrong current password comes back as INVALID_CREDENTIALS. It is shown
       * on the field it belongs to rather than as a banner, because that is
       * where the person is looking and it is the only field they can fix.
       */
      if (mutationError instanceof ApiError && mutationError.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { message: 'That is not your current password.' });
        return;
      }
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Your password could not be changed.',
      );
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          mutation.mutate(values);
        })(event);
      }}
      noValidate
    >
      <Field
        id="current-password"
        label="Current password"
        error={form.formState.errors.currentPassword?.message}
      >
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={form.formState.errors.currentPassword ? true : undefined}
          {...form.register('currentPassword')}
        />
      </Field>

      <Field
        id="new-password"
        label="New password"
        hint="At least 12 characters. Length matters more than symbols."
        error={form.formState.errors.newPassword?.message}
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={form.formState.errors.newPassword ? true : undefined}
          {...form.register('newPassword')}
        />
      </Field>

      <Field
        id="confirm-password"
        label="Confirm new password"
        error={form.formState.errors.confirmPassword?.message}
      >
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={form.formState.errors.confirmPassword ? true : undefined}
          {...form.register('confirmPassword')}
        />
      </Field>

      {error && (
        <Alert variant="error" title="Could not change your password">
          {error}
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Changing your password signs you out everywhere else.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Change password
        </Button>

        {done && (
          <span className="flex items-center gap-1.5 text-sm text-status-operational" role="status">
            <Check className="size-4" aria-hidden="true" />
            Password changed
          </span>
        )}
      </div>
    </form>
  );
}
