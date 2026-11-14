import 'server-only';
import { deployEnv, siteUrl } from '@/lib/env';
import { delivery } from '@/lib/media/url';
import type { MetaContext } from './metadata';
import { getSeoSettings } from './queries';

/** What the metadata and structured data builders need: SEO settings, the site origin, and whether this is the live site. */
export async function metaContext(): Promise<MetaContext> {
  return { settings: await getSeoSettings(), origin: siteUrl(), production: deployEnv() === 'production', delivery: delivery() };
}
