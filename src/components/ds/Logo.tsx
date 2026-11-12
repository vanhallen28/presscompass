import { PRIMARY, WORDMARK } from './logo-paths';

// Nib-needle symbol on a 64-unit grid: ring, north half with the pen-nib slit and breather hole, south half.
const NORTH =
  'M32 10L39.5 32L24.5 32Z M31.15 15.5L32.85 15.5L32.85 26.5L31.15 26.5Z M29.9 28.6A2.1 2.1 0 1 0 34.1 28.6A2.1 2.1 0 1 0 29.9 28.6Z';
const SOUTH = 'M24.5 32L39.5 32L32 54Z';

export type LogoVariant = 'primary' | 'wordmark' | 'symbol';
export type LogoTone = 'default' | 'inverse' | 'mono';

type LogoProps = {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Rendered height in px; width follows the artwork's proportions. */
  height?: number;
  /** Accessible name. Pass an empty string when a parent link already names it. */
  label?: string;
  className?: string;
};

function NibSymbol({ x, y, size, ink, mono }: { x: number; y: number; size: number; ink: string; mono: boolean }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 64 64" overflow="visible">
      <circle cx="32" cy="32" r="29.25" fill="none" stroke={ink} strokeWidth="5.5" />
      <path d={NORTH} fill={mono ? ink : 'var(--compass-mark)'} fillRule="evenodd" />
      {mono ? <path d={SOUTH} fill="none" stroke={ink} strokeWidth="1.6" /> : <path d={SOUTH} fill={ink} />}
    </svg>
  );
}

/** The PressCompass logo as inline SVG. Ink follows the theme; the north tip is always compass-mark red. */
export function Logo({ variant = 'primary', tone = 'default', height, label = 'PressCompass', className }: LogoProps) {
  const ink = tone === 'inverse' ? 'var(--on-navy)' : 'var(--ink)';
  const mono = tone === 'mono';
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (variant === 'symbol') {
    const h = height ?? 32;
    return (
      <svg className={className} viewBox="0 0 64 64" width={h} height={h} {...a11y}>
        <NibSymbol x={0} y={0} size={64} ink={ink} mono={mono} />
      </svg>
    );
  }
  const art = variant === 'wordmark' ? WORDMARK : PRIMARY;
  const h = height ?? 28;
  return (
    <svg className={className} viewBox={`0 0 ${art.width} ${art.height}`} height={h} width={(h * art.width) / art.height} {...a11y}>
      {variant === 'primary' && <NibSymbol {...PRIMARY.symbol} ink={ink} mono={mono} />}
      <path d={variant === 'primary' ? PRIMARY.wordmark : WORDMARK.path} fill={ink} />
    </svg>
  );
}
