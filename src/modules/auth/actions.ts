'use server';

import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/clients';
import { SIGN_IN_MESSAGES, signInErrorMessage } from './messages';
import { LOGIN_PATH, safeNextPath } from './paths';

export type SignInState = { error: string | null; email: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? ''));
  if (!email || !password) return { error: SIGN_IN_MESSAGES.missingFields, email };

  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: signInErrorMessage(error ?? {}), email };

    const { data: staff } = await supabase.from('staff').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!staff) {
      await supabase.auth.signOut();
      return { error: SIGN_IN_MESSAGES.notStaff, email };
    }
  } catch (error) {
    return { error: signInErrorMessage(error as Error), email };
  }
  redirect(next);
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  } finally {
    redirect(LOGIN_PATH);
  }
}
