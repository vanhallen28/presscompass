import { ImageResponse } from 'next/og';
import { BRAND, symbolSvg, svgDataUri } from '@/components/ds/logo-svg';

// The organisation logo for structured data (NewsMediaOrganization.logo): the symbol on paper, 512 × 512 PNG.
// Static: built once at deploy time.

export function GET() {
  return new ImageResponse(
    <div style={{ width: 512, height: 512, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.paper }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img elements */}
      <img src={svgDataUri(symbolSvg())} width={400} height={400} alt="" />
    </div>,
    { width: 512, height: 512 },
  );
}
