import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { LOGIN_PATH, loginUrl } from '@/modules/auth/paths';

const hasAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));

/**
 * Runs only for /newsroom (public pages stay cacheable). Refreshes the Supabase session cookie and
 * sends signed-out visitors to the login page. This is an optimistic check: every protected layout,
 * page and Server Action still calls requireStaff().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  if (!hasAuthCookie(request)) {
    if (isLogin) return NextResponse.next();
    return NextResponse.redirect(new URL(loginUrl(pathname + search), request.url));
  }

  let response = NextResponse.next({ request });
  try {
    const { supabaseUrl, publishableKey } = publicEnv();
    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // Missing keys or Supabase unreachable: let the page render its own message.
  }
  return response;
}

export const config = { matcher: ['/newsroom', '/newsroom/:path*'] };
