import { describe, expect, it, vi } from 'vitest';
import { cloudinaryUrl, imageSources } from '@/lib/media/url';
import { destroyAsset, fetchResource, publicIdFor, signParams, uploadPlan } from '@/modules/media/cloudinary';
import { checkFile, MAX_BYTES, parseMediaDetails } from '@/modules/media/validate';

const config = { cloudName: 'demo', apiKey: 'key-123', apiSecret: 'abcd', apiUrl: 'https://api.cloudinary.com' };
const delivery = { cloudName: 'demo', deliveryUrl: 'https://res.cloudinary.com' };
const ID = 'presscompass/images/rice-field-abcd1234';

describe('signParams', () => {
  it('matches the examples in the Cloudinary documentation', () => {
    expect(signParams({ timestamp: '1315060510' }, 'abcd')).toBe('a21ad0f63beb4de2e5575204b79ab90bffb02c10');
    expect(signParams({ timestamp: '1315060510', public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd')).toBe(
      'bfd09f95f331f558cbd1320e67aa8d488770583e',
    );
  });

  it('leaves out empty values, as the Cloudinary SDKs do', () => {
    expect(signParams({ timestamp: '1315060510', folder: '' }, 'abcd')).toBe(signParams({ timestamp: '1315060510' }, 'abcd'));
  });
});

describe('uploads', () => {
  it('names files from their original name with a random suffix', () => {
    expect(publicIdFor('Rice Field (Karawang).JPG', () => 'abcd1234')).toBe('presscompass/images/rice-field-karawang-abcd1234');
    expect(publicIdFor('.png', () => 'abcd1234')).toBe('presscompass/images/image-abcd1234');
    expect(publicIdFor(`${'long '.repeat(30)}.png`, () => 'abcd1234')).toMatch(/^presscompass\/images\/(long-)+long-abcd1234$/);
  });

  it('gives the browser exactly the signed fields for a direct upload', () => {
    const plan = uploadPlan(config, { fileName: 'Rice field.png', now: 1793744000, suffix: () => 'abcd1234' });
    const signed = {
      allowed_formats: 'jpg,png,webp,avif,gif',
      overwrite: 'false',
      public_id: ID,
      timestamp: '1793744000',
      transformation: 'c_limit,w_2560,q_auto',
    };
    expect(plan).toEqual({
      publicId: ID,
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      fields: { ...signed, api_key: 'key-123', signature: signParams(signed, 'abcd') },
    });
  });
});

describe('Admin API', () => {
  it('reads an uploaded image with basic authentication', async () => {
    const fetcher = vi.fn(async () => Response.json({ public_id: ID, format: 'png', width: 2560, height: 1440, bytes: 1234, version: 1 }));
    await expect(fetchResource(config, ID, fetcher)).resolves.toEqual({ publicId: ID, format: 'png', width: 2560, height: 1440, bytes: 1234 });
    expect(fetcher).toHaveBeenCalledWith(`https://api.cloudinary.com/v1_1/demo/resources/image/upload/${ID}`, {
      headers: { authorization: `Basic ${Buffer.from('key-123:abcd').toString('base64')}` },
      cache: 'no-store',
    });
  });

  it('returns null for an image Cloudinary does not have', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { message: 'Resource not found' } }, { status: 404 }));
    await expect(fetchResource(config, ID, fetcher)).resolves.toBeNull();
  });

  it('deletes an image with a signed request that also clears the CDN', async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => Response.json({ result: 'ok' }));
    await expect(destroyAsset(config, ID, 1793744000, fetcher)).resolves.toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy');
    const body = new URLSearchParams(String(init.body));
    const signed = { invalidate: 'true', public_id: ID, timestamp: '1793744000' };
    expect(Object.fromEntries(body)).toEqual({ ...signed, api_key: 'key-123', signature: signParams(signed, 'abcd') });
  });
});

describe('delivery URLs', () => {
  it('builds Cloudinary URLs per preset with automatic format and quality', () => {
    expect(cloudinaryUrl(delivery, { publicId: ID, preset: 'hero', width: 640 })).toBe(
      `https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,ar_16:9,w_640,f_auto,q_auto/${ID}`,
    );
    expect(cloudinaryUrl(delivery, { publicId: ID, preset: 'original', width: 960 })).toBe(
      `https://res.cloudinary.com/demo/image/upload/c_limit,w_960,f_auto,q_auto/${ID}`,
    );
  });

  it('offers widths up to the original size and keeps the shape of the preset', () => {
    const image = { publicId: ID, width: 1000, height: 500 };
    expect(imageSources(delivery, image, 'card')).toEqual({
      src: cloudinaryUrl(delivery, { publicId: ID, preset: 'card', width: 1000 }),
      srcSet: [320, 640, 960, 1000].map((w) => `${cloudinaryUrl(delivery, { publicId: ID, preset: 'card', width: w })} ${w}w`).join(', '),
      width: 1000,
      height: 667,
    });
    const large = imageSources(delivery, { publicId: ID, width: 2560, height: 1440 }, 'original');
    expect(large.srcSet.split(', ').map((entry) => entry.split(' ')[1])).toEqual(['320w', '640w', '960w', '1280w', '1920w']);
    expect(large).toMatchObject({ width: 1920, height: 1080, src: cloudinaryUrl(delivery, { publicId: ID, preset: 'original', width: 1280 }) });
  });
});

describe('validation', () => {
  it('accepts the image types and sizes Cloudinary Free takes', () => {
    expect(checkFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkFile({ type: 'image/jpeg', size: MAX_BYTES })).toBeNull();
    expect(checkFile({ type: 'image/svg+xml', size: 1000 })).toBe('Use a JPEG, PNG, WebP, AVIF or GIF image.');
    expect(checkFile({ type: 'image/png', size: MAX_BYTES + 1 })).toBe('The file is larger than 10 MB. Make it smaller and try again.');
    expect(checkFile({ type: 'image/png', size: 0 })).toBe('The file is empty.');
  });

  it('checks the alt text, caption and credit', () => {
    expect(parseMediaDetails({ alt: '  Farmers in Karawang ', caption: '', credit: 'Rani Prameswari' })).toEqual({
      values: { alt: 'Farmers in Karawang', caption: '', credit: 'Rani Prameswari' },
      errors: {},
    });
    expect(parseMediaDetails({ alt: 'x'.repeat(301), caption: 'y'.repeat(301), credit: 'z'.repeat(121) }).errors).toEqual({
      alt: 'Keep the alt text under 300 characters.',
      caption: 'Keep the caption under 300 characters.',
      credit: 'Keep the credit under 120 characters.',
    });
  });
});
