// Gives an existing Supabase Auth user access to the Newsroom.
// Usage: npm run staff:grant -- you@example.com
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env (the secret key bypasses RLS).
import { createClient } from '@supabase/supabase-js';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!email.includes('@')) fail('Give the email of the Supabase user, for example: npm run staff:grant -- you@example.com');
if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is missing from .env.');
if (!secret?.startsWith('sb_secret_')) fail('SUPABASE_SECRET_KEY in .env must be a secret key that starts with sb_secret_.');

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let user = null;
for (let page = 1; !user; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`Could not list Supabase users: ${error.message}`);
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) fail(`No Supabase user has the email ${email}. Create it first in Supabase: Authentication, Users, Add user.`);

const { error } = await supabase.from('staff').upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' });
if (error) fail(`Could not save the staff row: ${error.message}. Have the migrations been applied (npm run db:push)?`);

console.log(`\n${email} can now sign in to the Newsroom at /newsroom/login.\n`);
