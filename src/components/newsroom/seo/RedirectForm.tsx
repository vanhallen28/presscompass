'use client';

import { useActionState, useId, useState } from 'react';
import { type RedirectState, saveRedirect } from '@/modules/seo/actions';
import styles from '../ads/ads.module.css';
import { SelectField, TextField } from '../Field';
import { SubmitButton } from '../SubmitButton';
import { Notice } from '../ui';

/** Adds a redirect from an old address, or marks it as gone. */
export function RedirectForm({ from }: { from: string }) {
  const [state, action] = useActionState<RedirectState, FormData>(saveRedirect, { errors: {} });
  const uid = useId();
  const [code, setCode] = useState(String(state.values?.code ?? 308));
  const errors = state.errors;
  return (
    <form action={action} className={styles.card} noValidate>
      <h2 className={styles.cardTitle}>Add a redirect</h2>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <TextField
        id={`${uid}-from`}
        name="from"
        label="Old address"
        mono
        defaultValue={state.values?.from ?? from}
        error={errors.from}
        placeholder="/old-story"
        hint="An address on this site that has no page any more. Addresses that still have a page keep showing it."
      />
      <SelectField id={`${uid}-code`} name="code" label="Then" value={code} onChange={(event) => setCode(event.target.value)}>
        <option value="308">Send readers to a new address (permanent)</option>
        <option value="410">Nothing replaces it (Page not found)</option>
      </SelectField>
      {code === '308' && (
        <TextField
          id={`${uid}-to`}
          name="to"
          label="New address"
          mono
          defaultValue={state.values?.to ?? ''}
          error={errors.to}
          placeholder="/business/new-story"
          hint="An address on this site, starting with /."
        />
      )}
      <div>
        <SubmitButton pendingLabel="Saving…">Save redirect</SubmitButton>
      </div>
    </form>
  );
}
