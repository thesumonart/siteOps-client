'use client';

import type { UserDto } from '@/contracts';
import { humanNameSchema } from '@/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Field } from '@/components/forms/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { updateProfile } from '@/lib/auth';
import { queryKeys } from '@/lib/query-keys';

const profileSchema = z.object({ name: humanNameSchema });
type ProfileValues = z.input<typeof profileSchema>;

export interface ProfileFormProps {
  readonly user: UserDto;
}

/**
 * The signed-in user's display name.
 *
 * Only the name is editable, and that is the honest scope rather than a
 * limitation to apologise for: the email address is what verification, password
 * reset and every outage alert are addressed to, so changing it needs a
 * re-verification flow that does not exist yet. A form that appeared to change
 * it would either fail silently or leave alerts going to an unconfirmed
 * address.
 */
export function ProfileForm({ user }: ProfileFormProps): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });

  const mutation = useMutation({
    mutationFn: (values: { readonly name: string }) => updateProfile(values),
    onSuccess: async (_result, values) => {
      setError(null);
      setSaved(true);
      form.reset({ name: values.name });

      // The name is rendered by a server component in the dashboard shell, so
      // the cached session is invalidated and the route refreshed — otherwise
      // the sidebar keeps the old name until a hard reload.
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      router.refresh();
    },
    onError: (mutationError: unknown) => {
      setSaved(false);
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Your profile could not be saved.',
      );
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          mutation.mutate({ name: values.name.trim() });
        })(event);
      }}
      noValidate
    >
      <Field id="profile-name" label="Name" error={form.formState.errors.name?.message}>
        <Input
          id="profile-name"
          autoComplete="name"
          aria-invalid={form.formState.errors.name ? true : undefined}
          {...form.register('name')}
        />
      </Field>

      <Field
        id="profile-email"
        label="Email"
        hint="Alerts and account emails go here. Contact support to change it."
      >
        <Input id="profile-email" value={user.email} readOnly disabled autoComplete="email" />
      </Field>

      {error && (
        <Alert variant="error" title="Could not save">
          {error}
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save changes
        </Button>

        {saved && !form.formState.isDirty && (
          <span className="flex items-center gap-1.5 text-sm text-status-operational" role="status">
            <Check className="size-4" aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
