// Manual redirects (Newsroom, SEO, Redirects). Next.js answers permanent redirects with 308, which search
// engines treat like 301; 410 marks an address as gone (readers see Page not found).

export type RedirectInput = { from: string; to: string; code: 308 | 410 };
export type RedirectErrors = Partial<Record<'from' | 'to' | 'code', string>>;

const RESERVED = /^\/(?:newsroom|api|_next)(?:\/|$)/;

/** A site path as stored: leading slash, no query or fragment, no trailing slash (except the front page). */
export function normalisePath(value: string): string {
  let path = value.trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return path;
  }
  path = path.split(/[?#]/)[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path;
}

const isPath = (path: string) => path.startsWith('/') && !path.startsWith('//') && !/\s/.test(path) && path.length <= 300;

/** True for a full address on another site. */
function elsewhere(value: string, siteHost: string): boolean {
  if (!/^https?:\/\//i.test(value.trim())) return false;
  try {
    return new URL(value.trim()).hostname.replace(/^www\./, '') !== siteHost.replace(/^www\./, '');
  } catch {
    return true;
  }
}

export function parseRedirect(
  form: FormData,
  siteHost: string,
): { ok: true; value: RedirectInput } | { ok: false; errors: RedirectErrors; value: RedirectInput } {
  const code = form.get('code') === '410' ? 410 : 308;
  const rawTo = String(form.get('to') ?? '');
  const value: RedirectInput = {
    from: normalisePath(String(form.get('from') ?? '')),
    to: code === 410 ? '' : normalisePath(String(form.get('to') ?? '')),
    code,
  };
  const errors: RedirectErrors = {};
  if (!isPath(value.from) || value.from === '/') errors.from = 'Enter the old address on this site, starting with /, for example /old-story.';
  else if (RESERVED.test(value.from)) errors.from = 'Addresses under /newsroom, /api and /_next cannot be redirected.';
  if (code === 308) {
    if (elsewhere(rawTo, siteHost)) errors.to = 'Redirects lead to pages on this site. Enter the address starting with /.';
    else if (!isPath(value.to)) errors.to = 'Enter the new address on this site, starting with /.';
    else if (value.to === value.from) errors.to = 'The new address must differ from the old one.';
  }
  return Object.keys(errors).length ? { ok: false, errors, value } : { ok: true, value };
}
