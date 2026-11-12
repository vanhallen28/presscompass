// Creates a fresh PostgreSQL database with the Supabase stub, every migration and the test users,
// the same way tests/db does, and returns a connection pool for the fake Data API.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { USERS } from './auth.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function createDatabase({ adminUrl, name }) {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const setup = new pg.Client({ connectionString: url.toString() });
  await setup.connect();
  await setup.query(readFileSync(join(ROOT, 'tests/db/supabase-stub.sql'), 'utf8'));
  const dir = join(ROOT, 'supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await setup.query(readFileSync(join(dir, file), 'utf8'));
  }
  for (const [email, user] of Object.entries(USERS)) {
    await setup.query('insert into auth.users (id, email) values ($1, $2)', [user.id, email]);
    if (user.staff) await setup.query(`insert into public.staff (user_id, role) values ($1, 'owner')`, [user.id]);
  }
  await setup.end();
  return new pg.Pool({ connectionString: url.toString(), max: 10 });
}
