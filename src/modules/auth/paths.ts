export const NEWSROOM_HOME = '/newsroom';
export const LOGIN_PATH = '/newsroom/login';

/** Only same-site Newsroom paths are allowed as a post-login destination. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return NEWSROOM_HOME;
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return NEWSROOM_HOME;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return NEWSROOM_HOME;
  if (path !== NEWSROOM_HOME && !path.startsWith(`${NEWSROOM_HOME}/`) && !path.startsWith(`${NEWSROOM_HOME}?`)) return NEWSROOM_HOME;
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`) || path.startsWith(`${LOGIN_PATH}/`)) return NEWSROOM_HOME;
  return path;
}

/** Login URL that returns to `next` after signing in. */
export function loginUrl(next?: string): string {
  const target = safeNextPath(next);
  return target === NEWSROOM_HOME ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}
