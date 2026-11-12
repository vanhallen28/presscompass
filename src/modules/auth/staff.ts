import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createSessionClient } from '@/lib/supabase/clients';
import { LOGIN_PATH } from './paths';

export type Staff = { id: string; email: string; role: 'owner' };

/** The signed-in Newsroom user, or null when signed out, not staff, or Supabase is unreachable. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  try {
    const supabase = await createSessionClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;
    const { data: staff, error } = await supabase.from('staff').select('role').eq('user_id', userData.user.id).maybeSingle();
    if (error || !staff) return null;
    return { id: userData.user.id, email: userData.user.email ?? '', role: staff.role as Staff['role'] };
  } catch {
    return null;
  }
});

/** Use at the top of every protected Newsroom layout, page and Server Action. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect(LOGIN_PATH);
  return staff;
}
