import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND, primarySvg, svgDataUri } from '@/components/ds/logo-svg';
import { UUID } from '@/lib/doc/schema';
import { delivery } from '@/lib/media/url';
import { getCard, getSeoSettings } from '@/modules/seo/queries';

// The automatic social card of an article (1200 × 630): paper background, logo, kicker in compass red, the
// headline in Newsreader, and the lead image on the right. Used when the editor picks no social image.
// The address carries ?v= (the last Major update), so the CDN may keep each version for a long time.

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO = 470;

const font = (file: string) => readFile(join(process.cwd(), 'src/fonts/og', file));

async function photo(publicId: string): Promise<string | null> {
  const { deliveryUrl, cloudName } = delivery();
  if (!cloudName) return null;
  try {
    const response = await fetch(`${deliveryUrl}/${cloudName}/image/upload/c_fill,g_auto,w_${PHOTO},h_${HEIGHT},f_jpg,q_auto/${publicId}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return `data:image/jpeg;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: RouteContext<'/og/[id]'>) {
  const { id } = await params;
  const card = UUID.test(id) ? await getCard(id.toLowerCase()) : null;
  if (!card) return new Response('Not found', { status: 404 });
  const [settings, serif, sans, image] = await Promise.all([
    getSeoSettings(),
    font('newsreader-latin-500-normal.woff'),
    font('ibm-plex-sans-latin-600-normal.woff'),
    card.lead ? photo(card.lead.publicId) : Promise.resolve(null),
  ]);
  const logo = primarySvg(40);
  const kicker = (card.kicker || card.section?.name || 'News').toUpperCase();
  const textWidth = image ? WIDTH - PHOTO - 128 : WIDTH - 128;
  const size = card.title.length > 90 ? 50 : card.title.length > 60 ? 58 : 66;
  const byline = card.authors.map((author) => author.name).join(', ');

  return new ImageResponse(
    <div style={{ width: WIDTH, height: HEIGHT, display: 'flex', background: BRAND.paper, color: BRAND.ink }}>
      <div style={{ width: textWidth + 128, height: HEIGHT, display: 'flex', flexDirection: 'column', padding: '56px 64px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img elements */}
        <img src={svgDataUri(logo.svg)} width={logo.width} height={logo.height} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontFamily: 'Plex', fontSize: 22, letterSpacing: 2, color: BRAND.mark, marginBottom: 18 }}>{kicker}</div>
          <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: size, lineHeight: 1.12, letterSpacing: -0.5 }}>{card.title}</div>
        </div>
        <div style={{ display: 'flex', fontFamily: 'Plex', fontSize: 20, color: '#5b6577', borderTop: `2px solid ${BRAND.ink}`, paddingTop: 18 }}>
          {[byline, settings.siteName].filter(Boolean).join(' · ')}
        </div>
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img elements
        <img src={image} width={PHOTO} height={HEIGHT} alt="" style={{ objectFit: 'cover' }} />
      )}
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Newsreader', data: serif, weight: 500, style: 'normal' },
        { name: 'Plex', data: sans, weight: 600, style: 'normal' },
      ],
      headers: { 'cache-control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' },
    },
  );
}
