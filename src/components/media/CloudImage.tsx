import { delivery, type ImageRef, imageSources, type Preset } from '@/lib/media/url';

/**
 * A Cloudinary image with srcset, sizes and intrinsic width and height (no layout shift).
 * A plain <img>: Cloudinary does the resizing, so next/image would only add client JavaScript.
 * Works in Server and Client Components. Without a cloud name it renders a labelled placeholder.
 */
export function CloudImage({
  image,
  alt,
  preset = 'original',
  sizes,
  priority = false,
  className,
}: {
  image: ImageRef;
  alt: string;
  preset?: Preset;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const config = delivery();
  if (!config.cloudName) return <span className={className} role="img" aria-label={alt || 'Image'} data-cloudinary-missing="" />;
  const source = imageSources(config, image, preset);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves every size in srcset; see src/lib/media/url.ts.
    <img
      src={source.src}
      srcSet={source.srcSet}
      sizes={sizes}
      width={source.width}
      height={source.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}
