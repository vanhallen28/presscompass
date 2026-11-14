import { deployEnv, siteUrl } from '@/lib/env';
import { getSeoSettings } from '@/modules/seo/queries';
import { robotsTxt } from '@/modules/seo/settings';

// /robots.txt: everything readers see may be crawled; the Newsroom, the API and search results may not.
// Vercel Preview deployments and the owner's computer ask crawlers to stay out entirely.
export async function GET() {
  const body = robotsTxt(await getSeoSettings(), siteUrl(), deployEnv() === 'production');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
