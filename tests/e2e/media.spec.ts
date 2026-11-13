import { crc32, deflateSync } from 'node:zlib';
import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, seedArticle, seedMedia, seedTaxonomy, signIn, sql, unique } from './helpers';

// Media runs against the fake Cloudinary inside the fake Supabase (tests/fake-supabase/cloudinary.mjs), which checks
// upload and delete signatures like the real one and serves the uploaded bytes back.

const FAKE_CLOUDINARY = 'http://127.0.0.1:3101/fake-cloudinary';
const main = (page: Page) => page.getByRole('main');

/** A solid-colour PNG of the given size. */
function png(width: number, height: number, [r, g, b]: [number, number, number]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

const fileName = (label: string) => `${unique(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;

async function storedAssets(): Promise<string[]> {
  return (await fetch(`${FAKE_CLOUDINARY}/__assets`)).json();
}

async function mediaRow(originalName: string) {
  const [row] = await sql<{ id: string; public_id: string; width: number; height: number; alt: string }>(
    `select id, public_id, width, height, alt from public.media where original_name = $1`,
    [originalName],
  );
  return row;
}

test('uploads to the library, describes the image, and deletes it once it is unused', async ({ page }) => {
  const name = fileName('Harbour');
  await signIn(page, '/newsroom/media');
  await main(page)
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: png(3000, 1500, [32, 96, 160]) });
  await expect(main(page).getByText('Image uploaded. Add its alt text before using it in a published article.')).toBeVisible();

  // Signed upload with the incoming limit: stored at most 2560 px wide, under the site's folder.
  const row = await mediaRow(name);
  expect(row.public_id).toMatch(/^presscompass\/images\/harbour-[a-z0-9-]+-[0-9a-f]{8}$/);
  expect(row).toMatchObject({ width: 2560, height: 1280, alt: '' });
  expect(await storedAssets()).toContain(row.public_id);

  await main(page).getByRole('link', { name: new RegExp(name.replace('.png', '')) }).click();
  await page.waitForURL(`**/newsroom/media/${row.id}`);
  await expect(main(page).getByText(row.public_id)).toBeVisible();
  const alt = 'Fishing boats moored at Sunda Kelapa harbour.';
  await page.getByRole('textbox', { name: 'Alt text' }).fill(alt);
  await page.getByRole('textbox', { name: 'Credit' }).fill('Rani Prameswari/PressCompass');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(main(page).getByText('Details saved.')).toBeVisible();
  expect((await mediaRow(name)).alt).toBe(alt);

  const image = main(page).getByRole('img', { name: alt });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  expect(await image.getAttribute('srcset')).toContain(`${FAKE_CLOUDINARY}/demo/image/upload/c_limit,w_320,f_auto,q_auto/${row.public_id}`);

  await page.getByRole('button', { name: 'Delete image' }).click();
  await page.getByRole('dialog', { name: 'Delete this image?' }).getByRole('button', { name: 'Delete image' }).click();
  await page.waitForURL('**/newsroom/media?notice=deleted');
  await expect(main(page).getByText('Image deleted, here and on Cloudinary.')).toBeVisible();
  expect(await mediaRow(name)).toBeUndefined();
  expect(await storedAssets()).not.toContain(row.public_id);
});

test('refuses files that are not images before uploading', async ({ page }) => {
  await signIn(page, '/newsroom/media');
  await main(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(main(page).getByText('notes.txt: Use a JPEG, PNG, WebP, AVIF or GIF image.')).toBeVisible();
});

test.describe('images in articles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop.');
    await signIn(page);
  });

  test('every image needs alt text before publishing, and the preview shows the images', async ({ page }) => {
    test.setTimeout(60_000);
    const { section, author } = await seedTaxonomy('Images');
    const title = unique('Harbour story');
    const id = await seedArticle({ title, sectionId: section.id, authorId: author.id, ready: true });
    const name = fileName('Boats');
    await page.goto(`/newsroom/articles/${id}`);

    await page.getByRole('textbox', { name: 'Article text' }).click();
    await page.keyboard.press('Control+End');
    await page.getByRole('button', { name: 'Image', exact: true }).click();
    let picker = page.getByRole('dialog', { name: 'Insert an image' });
    await picker.locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/png', buffer: png(1200, 800, [200, 120, 40]) });
    await expect(picker.getByRole('textbox', { name: 'Alt text' })).toBeVisible();
    await picker.getByRole('textbox', { name: /Caption/ }).fill('Boats wait for the tide.');
    await picker.getByRole('textbox', { name: /Credit/ }).fill('Rani Prameswari/PressCompass');
    await picker.getByRole('button', { name: 'Insert' }).click();
    await expect(picker).toBeHidden();
    await expect(main(page).getByText('Boats wait for the tide.')).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('alert')).toContainText('One image in the text needs alt text.');

    await main(page).getByRole('button', { name: 'Edit', exact: true }).click();
    picker = page.getByRole('dialog', { name: 'Image' });
    await picker.getByRole('textbox', { name: 'Alt text' }).fill('Wooden boats tied up in a row at low tide.');
    await picker.getByRole('button', { name: 'Save' }).click();
    await expect(picker).toBeHidden();
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();

    const upload = await mediaRow(name);
    const [stored] = await sql<{ images: { mediaId: string; caption: string }[] }>(
      `select jsonb_path_query_array(body, 'strict $.** ? (@.type == "image").attrs') as images from public.articles where id = $1`,
      [id],
    );
    expect(stored.images).toEqual([{ mediaId: upload.id, caption: 'Boats wait for the tide.' }]);

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByRole('img', { name: 'Farmers plant rice seedlings in a flooded field.' })).toBeVisible();
    const figure = page.getByRole('figure').filter({ has: page.getByRole('img', { name: 'Wooden boats tied up in a row at low tide.' }) });
    await expect(figure).toContainText('Boats wait for the tide.');
    await expect(figure).toContainText('Photo: Rani Prameswari/PressCompass');

    await page.goto(`/newsroom/media/${upload.id}`);
    const usedIn = main(page).getByRole('region', { name: 'Used in' });
    await expect(usedIn.getByRole('link', { name: title })).toBeVisible();
    await expect(usedIn).toContainText('In the text');
    await expect(main(page).getByText('Images in use cannot be deleted.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete image' })).toHaveCount(0);
  });

  test('gives an author a profile photo', async ({ page }) => {
    const { author } = await seedTaxonomy('Photo');
    const alt = unique('Portrait of a reporter');
    const mediaId = await seedMedia(alt);
    await page.goto(`/newsroom/authors/${author.id}`);
    await page.getByRole('button', { name: 'Choose photo' }).click();
    const picker = page.getByRole('dialog', { name: 'Author photo' });
    await picker.getByRole('searchbox', { name: 'Search the media library' }).fill(alt);
    await picker.getByRole('button', { name: 'Search' }).click();
    await picker.getByRole('button', { name: alt }).click();
    await picker.getByRole('button', { name: 'Use as photo' }).click();
    await expect(main(page).getByText(`Alt text: ${alt}`)).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/newsroom/authors?notice=updated');
    const [row] = await sql<{ photo_media_id: string }>(`select photo_media_id from public.authors where id = $1`, [author.id]);
    expect(row.photo_media_id).toBe(mediaId);

    await page.goto(`/newsroom/media/${mediaId}`);
    await expect(main(page).getByRole('region', { name: 'Used in' })).toContainText('Author photo');
  });

  test('media pages and the picker are accessible in both themes', async ({ page }) => {
    const mediaId = await seedMedia(unique('Accessible image'));
    const id = await seedArticle({ title: unique('Accessible images') });
    const check = async () => {
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    };
    for (const path of ['/newsroom/media', `/newsroom/media/${mediaId}`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check();
    }
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Choose image' }).click();
    await expect(page.getByRole('dialog', { name: 'Lead image' }).getByRole('list', { name: 'Images' }).getByRole('button').first()).toBeVisible();
    await check();
  });
});

test('the media library fits a phone screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  await seedMedia(unique('Phone image'));
  await signIn(page, '/newsroom/media');
  await expect(main(page).getByRole('list', { name: 'Images' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
