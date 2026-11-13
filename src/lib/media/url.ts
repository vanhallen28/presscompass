// Cloudinary delivery URLs for images. Pure, so it runs on the server and in the browser.
// Every URL asks for f_auto,q_auto (AVIF or WebP when the browser supports it) at a capped width.

export type Preset = 'original' | 'hero' | 'card' | 'square';
export type Delivery = { cloudName: string; deliveryUrl: string };
export type ImageRef = { publicId: string; width: number; height: number };

/** Width ÷ height of the cropped presets. `original` keeps the image's own shape. */
const RATIO: Record<Exclude<Preset, 'original'>, { ar: string; value: number }> = {
  hero: { ar: '16:9', value: 16 / 9 },
  card: { ar: '3:2', value: 3 / 2 },
  square: { ar: '1:1', value: 1 },
};

/** Widths offered in srcset. Few on purpose: each one is a Cloudinary transformation (Free: 25 credits a month). */
export const WIDTHS = [320, 640, 960, 1280, 1920] as const;

export function delivery(): Delivery {
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    deliveryUrl: process.env.NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL || 'https://res.cloudinary.com',
  };
}

export function cloudinaryUrl(config: Delivery, { publicId, preset, width }: { publicId: string; preset: Preset; width: number }): string {
  const crop = preset === 'original' ? 'c_limit' : `c_fill,g_auto,ar_${RATIO[preset].ar}`;
  return `${config.deliveryUrl}/${config.cloudName}/image/upload/${crop},w_${Math.round(width)},f_auto,q_auto/${publicId}`;
}

/** src, srcset and the intrinsic width and height (for layout without shifts) of an image in a preset. */
export function imageSources(config: Delivery, image: ImageRef, preset: Preset) {
  const largest = Math.min(image.width, WIDTHS[WIDTHS.length - 1]);
  const widths: number[] = WIDTHS.filter((w) => w <= largest);
  if (!widths.includes(largest)) widths.push(largest);
  const fallback = widths.filter((w) => w <= 1280).at(-1) ?? widths[0];
  const height = preset === 'original' ? (largest * image.height) / image.width : largest / RATIO[preset].value;
  return {
    src: cloudinaryUrl(config, { publicId: image.publicId, preset, width: fallback }),
    srcSet: widths.map((w) => `${cloudinaryUrl(config, { publicId: image.publicId, preset, width: w })} ${w}w`).join(', '),
    width: largest,
    height: Math.round(height),
  };
}
