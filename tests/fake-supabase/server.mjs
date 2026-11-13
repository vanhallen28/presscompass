// Fake Supabase (and Cloudinary) for E2E tests and local previews without the real services (no Docker):
// Auth for two test users, a Data API that runs real SQL on a fresh PostgreSQL database, and
// Cloudinary uploads, Admin API and image delivery under /fake-cloudinary.
//   FAKE_SUPABASE_PORT   port to listen on (3101)
//   FAKE_DATABASE_URL    a PostgreSQL server where the user may create databases
//   FAKE_DATABASE_NAME   database to (re)create on start (presscompass_e2e)
import { createServer } from 'node:http';
import { handleAuth, requestClaims } from './auth.mjs';
import { handleCloudinary } from './cloudinary.mjs';
import { createDatabase } from './database.mjs';
import { handleRest } from './rest.mjs';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 3101);
const ADMIN_URL = process.env.FAKE_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
const NAME = process.env.FAKE_DATABASE_NAME ?? 'presscompass_e2e';

const pool = await createDatabase({ adminUrl: ADMIN_URL, name: NAME });
const typeCache = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (await handleCloudinary(req, url, raw, res)) return;
  let body = {};
  try {
    body = raw.length ? JSON.parse(raw.toString()) : {};
  } catch {
    return send(400, { message: 'Invalid JSON body' });
  }
  req.claims = requestClaims(req);
  if (handleAuth(req, url, body, send)) return;
  if (await handleRest(pool, typeCache, req, url, body, send)) return;
  send(404, { message: `Fake Supabase has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Fake Supabase on http://127.0.0.1:${PORT} (database ${NAME})`));
