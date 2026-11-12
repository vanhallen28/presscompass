// Stand-in for Supabase Auth (GoTrue): password sign-in, current user and sign-out for the
// two test users. Tokens are unsigned JWTs; tests/fake-supabase/rest.mjs reads their claims.

export const PASSWORD = 'correct-horse-battery-staple';
export const USERS = {
  'owner@example.com': { id: '11111111-1111-4111-8111-111111111111', staff: true },
  'stranger@example.com': { id: '22222222-2222-4222-8222-222222222222', staff: false },
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function tokenFor(email) {
  const user = USERS[email];
  const claims = { sub: user.id, email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

/** Claims of a bearer JWT, or null when the header carries no JWT (for example a publishable key). */
export function jwtClaims(header) {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

/** The database role and JWT claims a Data API request runs with, as on Supabase. */
export function requestClaims(req) {
  const jwt = jwtClaims(req.headers.authorization);
  if (jwt?.role === 'authenticated' && USERS[jwt.email]) return jwt;
  const key = String(req.headers.apikey ?? req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (key.startsWith('sb_secret_')) return { role: 'service_role' };
  return { role: 'anon' };
}

const userJson = (email) => ({
  id: USERS[email].id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-13T00:00:00Z',
});

/** Handles /auth/v1/* requests. Returns false for other paths. */
export function handleAuth(req, url, body, send) {
  if (!url.pathname.startsWith('/auth/v1/')) return false;
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const user = USERS[body.email];
    if (!user || body.password !== PASSWORD) {
      send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return true;
    }
    const now = Math.floor(Date.now() / 1000);
    send(200, {
      access_token: tokenFor(body.email),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `refresh-${user.id}`,
      user: userJson(body.email),
    });
    return true;
  }
  if (url.pathname === '/auth/v1/user') {
    const claims = jwtClaims(req.headers.authorization);
    if (!claims?.email || !USERS[claims.email]) send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    else send(200, userJson(claims.email));
    return true;
  }
  if (url.pathname === '/auth/v1/logout') {
    send(204);
    return true;
  }
  send(404, { msg: `Fake Supabase Auth has no route for ${req.method} ${url.pathname}` });
  return true;
}
