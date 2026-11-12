import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, type QueryResultRow } from 'pg';

// Tests run against a throwaway database on plain PostgreSQL.
// TEST_DATABASE_URL points at a server where the user may create databases,
// e.g. postgresql://postgres:postgres@localhost:5432/postgres (CI: scripts/ci-postgres.sh).
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

export type TestDatabase = {
  client: Client;
  /** Runs `fn` inside a transaction as the given API role (and user), then rolls everything back. */
  as<T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export type Query = <R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `presscompass_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync(join(__dirname, 'supabase-stub.sql'), 'utf8'));
  const dir = join(__dirname, '..', '..', 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(dir, file), 'utf8'));
  }

  return {
    client,
    async as(role, userId, fn) {
      await client.query('begin');
      try {
        await client.query(`set local role ${role}`);
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [userId ? JSON.stringify({ sub: userId, role }) : '']);
        const query: Query = async (sql, params) => (await client.query(sql, params)).rows;
        return await fn(query);
      } finally {
        await client.query('rollback');
      }
    },
    async close() {
      await client.end();
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    },
  };
}
