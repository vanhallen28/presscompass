import { getSiteAds } from '@/modules/ads/queries';
import { adsTxtBody } from '@/modules/ads/validate';

// /ads.txt (IAB ads.txt 1.1): the AdSense line from the publisher ID plus the lines entered on the Ads page.
// Served while ads are off too, so networks can check it before approving the site. Nothing to declare: 404.

export async function GET() {
  const body = adsTxtBody(await getSiteAds());
  const headers = { 'content-type': 'text/plain; charset=utf-8' };
  return body ? new Response(body, { headers }) : new Response('No ads.txt records.\n', { status: 404, headers });
}
