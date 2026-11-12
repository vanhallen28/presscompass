'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ds/Button';

/** Submit button that shows `pendingLabel` and blocks double submits while its form is sending. */
export function SubmitButton({ pendingLabel, children, ...button }: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" aria-disabled={pending || undefined} disabled={pending} {...button}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
