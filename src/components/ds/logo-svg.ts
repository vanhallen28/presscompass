import { PRIMARY } from './logo-paths';

// The logo as standalone SVG text with fixed colours, for images made on the server (social cards, the
// organisation logo for search engines), where CSS variables do not exist.

const NORTH = 'M32 10L39.5 32L24.5 32Z M31.15 15.5L32.85 15.5L32.85 26.5L31.15 26.5Z M29.9 28.6A2.1 2.1 0 1 0 34.1 28.6A2.1 2.1 0 1 0 29.9 28.6Z';
const SOUTH = 'M24.5 32L39.5 32L32 54Z';

export const BRAND = { ink: '#0f1e33', paper: '#f6f4ef', mark: '#c8432b' } as const;

function symbol(ink: string, mark: string): string {
  return `<circle cx="32" cy="32" r="29.25" fill="none" stroke="${ink}" stroke-width="5.5"/><path d="${NORTH}" fill="${mark}" fill-rule="evenodd"/><path d="${SOUTH}" fill="${ink}"/>`;
}

/** The nib-needle symbol on its own, square. */
export function symbolSvg(ink: string = BRAND.ink, mark: string = BRAND.mark): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${symbol(ink, mark)}</svg>`;
}

/** The primary lockup (symbol and logotype), `height` px tall. */
export function primarySvg(height: number, ink: string = BRAND.ink, mark: string = BRAND.mark): { svg: string; width: number; height: number } {
  const { x, y, size } = PRIMARY.symbol;
  const width = Math.round((height * PRIMARY.width) / PRIMARY.height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PRIMARY.width} ${PRIMARY.height}" width="${width}" height="${height}"><g transform="translate(${x} ${y}) scale(${size / 64})">${symbol(ink, mark)}</g><path d="${PRIMARY.wordmark}" fill="${ink}"/></svg>`;
  return { svg, width, height };
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
