// A tiny stand-in for the Supabase Auth and Data APIs, used only by the E2E tests.
// It knows two users: the owner (staff) and a stranger (signed up, but no Newsroom access).
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 3101);
const PASSWORD = 'correct-horse-battery-staple';
const USERS = {
  'owner@example.com': { id: '11111111-1111-4111-8111-111111111111', staff: true },
  'stranger@example.com': { id: '22222222-2222-4222-8222-222222222222', staff: false },
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor = (email) => {
  const user = USERS[email];
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`;
};
const emailFromToken = (header) => {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).email;
  } catch {
    return null;
  }
};
const userJson = (email) => ({
  id: USERS[email].id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-13T00:00:00Z',
});

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const user = USERS[body.email];
    if (!user || body.password !== PASSWORD) {
      return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    const now = Math.floor(Date.now() / 1000);
    return send(res, 200, {
      access_token: tokenFor(body.email),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `refresh-${user.id}`,
      user: userJson(body.email),
    });
  }
  if (url.pathname === '/auth/v1/user') {
    const email = emailFromToken(req.headers.authorization);
    if (!email || !USERS[email]) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    return send(res, 200, userJson(email));
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204);

  if (url.pathname === '/rest/v1/staff') {
    const email = emailFromToken(req.headers.authorization);
    const user = email ? USERS[email] : null;
    const rows = user?.staff ? [{ user_id: user.id, role: 'owner' }] : [];
    return send(res, 200, rows);
  }
  if (url.pathname === '/rest/v1/sections') {
    return send(res, 200, req.method === 'HEAD' ? undefined : [], { 'content-range': '*/0' });
  }
  send(res, 404, { message: `Mock Supabase has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Mock Supabase on http://127.0.0.1:${PORT}`));
