import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, revalidateSite, seedArticle, seedTaxonomy, signIn, slugFor, unique } from './helpers';

// Ads, consent and ads.txt. Runs in the `ads` project after every other test, because switching ads on changes
// all site pages. Google and Meta are never reached: their scripts are answered with small stand-ins.

const GOOGLE = /googlesyndication\.com|doubleclick\.net|connect\.facebook\.net/;

const STUBS: [RegExp, string][] = [
  [/adsbygoogle\.js/, 'window.__adsense = (window.__adsense || 0) + 1;'],
  [
    /gpt\.js/,
    `(function(){var g=window.googletag,q=g.cmd;g.cmd={push:function(f){f()}};
      g.pubads=function(){return {}};g.enableServices=function(){};g.destroySlots=function(){};
      g.defineSlot=function(p,s,id){window.__gptSlots=(window.__gptSlots||[]).concat([p]);return {addService:function(){return this}}};
      g.display=function(id){document.getElementById(id).textContent='GPT unit '+id};q.forEach(function(f){f()});})();`,
  ],
  [/fbevents\.js/, 'window.__metaPixel = true;'],
];

async function stubNetworks(page: Page) {
  const requests: string[] = [];
  await page.route(GOOGLE, (route) => {
    const url = route.request().url();
    requests.push(url);
    const stub = STUBS.find(([pattern]) => pattern.test(url));
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: stub?.[1] ?? '' });
  });
  return requests;
}

const PARAGRAPHS = Array.from({ length: 7 }, (_, index) => ({
  type: 'paragraph',
  content: [{ type: 'text', text: `Paragraph ${index + 1}. ${'The harvest moved prices across Java and Sumatra this week. '.repeat(4).trim()}` }],
}));

async function saveSlot(page: Page, name: string, fill: (page: Page) => Promise<void>) {
  await page.goto('/newsroom/ads');
  await page.getByRole('link', { name }).click();
  await page.getByRole('checkbox', { name: 'Show this slot' }).check();
  await fill(page);
  await page.getByRole('button', { name: 'Save slot' }).click();
  await expect(page.getByRole('main').getByText('Slot saved.')).toBeVisible();
}

test('sets up ads in the Newsroom, then shows them only after the reader accepts', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page, '/newsroom/ads');
  const main = page.getByRole('main');

  await page.getByRole('checkbox', { name: 'Show ads and run tracking code on the site' }).check();
  await page.getByRole('button', { name: 'Save ad settings' }).click();
  await expect(main.getByText(/Add the privacy policy link/).first()).toBeVisible();

  await page.getByRole('textbox', { name: 'Privacy policy link' }).fill('/privacy-policy');
  await page.getByRole('textbox', { name: 'Publisher ID' }).fill('pub-1234567890123456');
  await page.getByRole('textbox', { name: 'Pixel ID' }).fill('123456789012345');
  await page.getByRole('textbox', { name: 'Code for the <head>' }).fill('<script>window.__headCode = (window.__headCode || 0) + 1;</script>');
  await page.getByRole('textbox', { name: 'Verification tags' }).fill('<meta name="adnetwork-verification" content="e2e-check">');
  await page.getByRole('textbox', { name: 'Other lines' }).fill('adsterra.com, 98765, DIRECT');
  await page.getByRole('button', { name: 'Save ad settings' }).click();
  await expect(main.getByText('Ad settings saved.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Show ads and run tracking code on the site' })).toBeChecked();
  await expectNoAxeViolations(page);

  await saveSlot(page, 'Below the header', async (p) => {
    await p.getByRole('combobox', { name: 'Ad code' }).selectOption('adsense');
    await p.getByRole('textbox', { name: 'Ad unit number (data-ad-slot)' }).fill('data-ad-slot="1111111111"');
  });
  await saveSlot(page, 'In the article, first', async (p) => {
    await p.getByRole('combobox', { name: 'Ad code' }).selectOption('html');
    await p.getByRole('textbox', { name: 'Ad code' }).fill('<a href="https://example.com/sponsor">Sponsor banner</a>');
    await p.getByRole('spinbutton', { name: 'After paragraph' }).fill('2');
  });
  await saveSlot(page, 'After the article', async (p) => {
    await p.getByRole('combobox', { name: 'Ad code' }).selectOption('gpt');
    await p.getByRole('textbox', { name: 'Ad unit path' }).fill('/1234567/presscompass/end');
    await p.getByRole('textbox', { name: 'Sizes' }).fill('300x250, 336x280');
  });
  await expect(main.getByRole('row', { name: /Below the header.*AdSense display \(responsive\), unit 1111111111.*On/ })).toBeVisible();

  const { section } = await seedTaxonomy('Ads');
  const title = unique('Ads story');
  await seedArticle({ title, ready: true, status: 'published', sectionId: section.id, body: { type: 'doc', content: PARAGRAPHS } });
  await revalidateSite();
  const href = `/${section.slug}/${slugFor(title)}`;

  // A new reader: nothing from Google or Meta, no slots, the banner with two equal choices.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const reader = await context.newPage();
  const requests = await stubNetworks(reader);
  await expect(async () => {
    await reader.goto(href);
    await expect(reader.locator('aside[data-placement="article_inline_1"]')).toHaveCount(1);
  }).toPass({ timeout: 20_000 });
  const banner = reader.getByRole('region', { name: 'Cookies on PressCompass' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy-policy');
  await expect(reader.locator('aside[data-placement]').first()).toBeHidden();
  await expectNoAxeViolations(reader);
  expect(requests).toEqual([]);
  expect(await reader.evaluate(() => (window as unknown as { __headCode?: number }).__headCode)).toBeUndefined();

  // Accept all: the scripts load once, the slots appear and fill as they come into view.
  await banner.getByRole('button', { name: 'Accept all' }).click();
  await expect(banner).toBeHidden();
  await expect(reader.locator('aside[data-placement="top"]')).toBeVisible();
  await expect(reader.locator('aside[data-placement="top"] ins.adsbygoogle[data-ad-slot="1111111111"][data-ad-client="ca-pub-1234567890123456"]')).toHaveCount(1);
  await expect.poll(() => requests.some((url) => url.includes('adsbygoogle.js?client=ca-pub-1234567890123456'))).toBe(true);
  await expect.poll(() => reader.evaluate(() => (window as unknown as { __headCode?: number }).__headCode)).toBe(1);
  await expect.poll(() => reader.evaluate(() => (window as unknown as { fbq?: { queue?: unknown[][] } }).fbq?.queue?.map((call) => call.join(':')))).toEqual(
    expect.arrayContaining(['init:123456789012345', 'track:PageView']),
  );

  const inline = reader.locator('aside[data-placement="article_inline_1"]');
  await inline.scrollIntoViewIfNeeded();
  await expect(inline.frameLocator('iframe').getByRole('link', { name: 'Sponsor banner' })).toBeVisible();
  // After the second paragraph of text.
  expect(await reader.evaluate(() => document.querySelector('aside[data-placement="article_inline_1"]')?.previousElementSibling?.textContent ?? '')).toMatch(/^Paragraph 2\./);
  const end = reader.locator('aside[data-placement="article_end"]');
  await end.scrollIntoViewIfNeeded();
  await expect(end).toContainText('GPT unit pc-gpt-article_end');
  expect(await reader.evaluate(() => (window as unknown as { __gptSlots?: string[] }).__gptSlots)).toEqual(['/1234567/presscompass/end']);
  expect(await reader.evaluate(() => document.cookie)).toContain('pc_consent=all.1');

  // The choice is remembered; Cookie settings brings the banner back and Necessary only stops everything.
  await reader.reload();
  await expect(banner).toBeHidden();
  await expect(reader.locator('aside[data-placement="top"]')).toBeVisible();
  await reader.getByRole('button', { name: 'Cookie settings' }).click();
  await expect(banner).toBeVisible();
  const before = requests.length;
  await Promise.all([reader.waitForEvent('load'), banner.getByRole('button', { name: 'Necessary only' }).click()]);
  await expect(reader.locator('aside[data-placement="top"]')).toBeHidden();
  await expect(banner).toBeHidden();
  expect(await reader.evaluate(() => document.cookie)).toContain('pc_consent=necessary.1');
  expect(requests.length).toBe(before);
  await context.close();

  // Verification for networks, also in the page source.
  const html = await (await page.request.get(href)).text();
  expect(html).toContain('<meta name="google-adsense-account" content="ca-pub-1234567890123456"/>');
  expect(html).toContain('<meta name="adnetwork-verification" content="e2e-check"/>');
  await expect(async () => {
    const adsTxt = await page.request.get('/ads.txt');
    expect(adsTxt.headers()['content-type']).toContain('text/plain');
    expect(await adsTxt.text()).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\nadsterra.com, 98765, DIRECT\n');
  }).toPass({ timeout: 20_000 });

  // Switching ads off removes the slots and the banner, but keeps verification and ads.txt.
  await page.goto('/newsroom/ads');
  await page.getByRole('checkbox', { name: 'Show ads and run tracking code on the site' }).uncheck();
  await page.getByRole('button', { name: 'Save ad settings' }).click();
  await expect(main.getByText('Ad settings saved.')).toBeVisible();
  await expect(async () => {
    const source = await (await page.request.get(href)).text();
    expect(source).not.toContain('data-placement=');
    expect(source).not.toContain('data-consent-banner');
    expect(source).toContain('google-adsense-account');
  }).toPass({ timeout: 20_000 });
});
