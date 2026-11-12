'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { signIn, type SignInState } from '@/modules/auth/actions';
import styles from './login.module.css';

const INITIAL: SignInState = { error: null, email: '' };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={styles.input} />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={styles.input} />
      </div>
      <div role="alert" aria-live="assertive" className={styles.alertSlot}>
        {state.error && (
          <p className={styles.error}>
            <Icon name="alert" size={16} />
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
