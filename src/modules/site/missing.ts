import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { findRedirect } from './queries';

/** For an address with nothing to show: follow an automatic redirect (308) if the content moved, else 404. */
export async function missing(path: string): Promise<never> {
  const redirect = await findRedirect(path);
  if (redirect && redirect.code !== 410 && redirect.to) permanentRedirect(redirect.to);
  notFound();
}
