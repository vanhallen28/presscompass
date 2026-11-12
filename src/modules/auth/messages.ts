// Newsroom sign-in messages (English, design system ux-copy rules: say what happened and what to do).

export const SIGN_IN_MESSAGES = {
  missingFields: 'Enter your email and password.',
  invalidCredentials: 'Email or password is incorrect.',
  rateLimited: 'Too many attempts. Wait a minute, then try again.',
  unreachable: 'We could not reach the sign-in service. Check your connection, then try again.',
  notStaff: 'This account does not have Newsroom access.',
  notConfigured: 'The Newsroom is not configured yet. Add the Supabase keys to the environment.',
  unknown: 'Sign-in failed. Try again in a moment.',
} as const;

type AuthLikeError = { name?: string; status?: number; code?: string; message?: string };

/** Maps a Supabase Auth error to a message the owner can act on. */
export function signInErrorMessage(error: AuthLikeError): string {
  if (error.name === 'EnvError') return SIGN_IN_MESSAGES.notConfigured;
  if (error.code === 'invalid_credentials' || (error.status === 400 && /invalid login credentials/i.test(error.message ?? ''))) {
    return SIGN_IN_MESSAGES.invalidCredentials;
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit') return SIGN_IN_MESSAGES.rateLimited;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch failed|network/i.test(error.message ?? '')) {
    return SIGN_IN_MESSAGES.unreachable;
  }
  return SIGN_IN_MESSAGES.unknown;
}
