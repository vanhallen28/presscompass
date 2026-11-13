import { describe, expect, it } from 'vitest';
import { consentScript, readConsent } from '@/components/site/ads/consent';
import {
  adsTxtBody,
  adsenseAdsTxtLine,
  checkAdsTxt,
  inlinePositions,
  normalizeAdsenseClient,
  parseAdSettings,
  parseAdSlot,
  parseGptSizes,
  parseVerificationMeta,
} from '@/modules/ads/validate';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('AdSense IDs and ads.txt', () => {
  it('accepts the publisher ID in the forms AdSense shows it', () => {
    expect(normalizeAdsenseClient('ca-pub-1234567890123456')).toBe('ca-pub-1234567890123456');
    expect(normalizeAdsenseClient(' pub-1234567890123456 ')).toBe('ca-pub-1234567890123456');
    expect(normalizeAdsenseClient('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0')).toBe('ca-pub-1234567890123456');
    expect(normalizeAdsenseClient('')).toBe('');
    expect(normalizeAdsenseClient('ca-pub-123')).toBeNull();
  });

  it('builds the AdSense line and checks extra lines', () => {
    expect(adsenseAdsTxtLine('ca-pub-1234567890123456')).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0');
    expect(
      checkAdsTxt('# partners\nadsterra.com, 123, DIRECT\nexample.org, abc, RESELLER, 1a2b # note\ncontact=ads@example.com\n').error,
    ).toBeUndefined();
    expect(checkAdsTxt('adsterra.com 123 DIRECT').error).toMatch(/^Line 1:/);
    expect(checkAdsTxt('ok.com, 1, DIRECT\nbad, 1, OWNER').error).toMatch(/^Line 2:/);
  });

  it('serves ads.txt only when there is at least one record', () => {
    expect(adsTxtBody({ adsenseClient: 'ca-pub-1234567890123456', adsTxt: 'adsterra.com, 1, DIRECT' })).toBe(
      'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\nadsterra.com, 1, DIRECT\n',
    );
    expect(adsTxtBody({ adsenseClient: '', adsTxt: 'adsterra.com, 1, DIRECT' })).toBe('adsterra.com, 1, DIRECT\n');
    expect(adsTxtBody({ adsenseClient: '', adsTxt: '# nothing yet' })).toBe('');
    expect(adsTxtBody({ adsenseClient: '', adsTxt: '' })).toBe('');
  });
});

describe('verification tags and Ad Manager sizes', () => {
  it('reads one meta tag per line and refuses anything else', () => {
    expect(parseVerificationMeta('<meta name="a-verify" content="x1">\n\n<meta content=\'y2\' name=\'b-verify\' />').tags).toEqual([
      { name: 'a-verify', content: 'x1' },
      { name: 'b-verify', content: 'y2' },
    ]);
    expect(parseVerificationMeta('<script>alert(1)</script>').error).toMatch(/^Line 1/);
    expect(parseVerificationMeta('<meta name="robots" content="noindex">').error).toMatch(/sets "robots" itself/);
    expect(parseVerificationMeta('<meta http-equiv="refresh" content="0;url=x">').error).toMatch(/^Line 1/);
  });

  it('parses GPT sizes', () => {
    expect(parseGptSizes('300x250, 336 x 280, fluid')).toEqual([[300, 250], [336, 280], 'fluid']);
    expect(parseGptSizes('')).toBeNull();
    expect(parseGptSizes('300by250')).toBeNull();
  });
});

describe('settings and slot forms', () => {
  it('needs a privacy policy link before ads go on', () => {
    expect(parseAdSettings(form({ enabled: 'on', consent_required: 'on' })).errors.enabled).toMatch(/privacy policy/);
    const ok = parseAdSettings(form({ enabled: 'on', privacy_url: '/privacy-policy', adsense_client: 'pub-1234567890123456', label: '' }));
    expect(ok.errors).toEqual({});
    expect(ok.values).toMatchObject({ enabled: true, consentRequired: false, adsenseClient: 'ca-pub-1234567890123456', label: 'Advertisement' });
    expect(parseAdSettings(form({ privacy_url: 'javascript:alert(1)' })).errors.privacyUrl).toBeDefined();
    expect(parseAdSettings(form({ adsense_auto: 'on' })).errors.adsenseAuto).toBeDefined();
    expect(parseAdSettings(form({ meta_pixel_id: 'abc' })).errors.metaPixelId).toBeDefined();
  });

  it('checks a slot for its kind, and reads numbers out of pasted AdSense code', () => {
    const base = { height_mobile: '250', height_desktop: '250', paragraph: '3' };
    const adsense = parseAdSlot(
      form({
        ...base,
        enabled: 'on',
        kind: 'adsense',
        adsense_format: 'in-feed',
        adsense_slot: 'data-ad-slot="9876543210"',
        adsense_layout_key: 'data-ad-layout-key="-fb+5w+4e-db+86"',
      }),
      'list',
    );
    expect(adsense.errors).toEqual({});
    expect(adsense.values).toMatchObject({ adsenseSlot: '9876543210', adsenseLayoutKey: '-fb+5w+4e-db+86' });
    expect(parseAdSlot(form({ ...base, enabled: 'on', kind: 'gpt', gpt_path: 'top', gpt_sizes: '300x250' }), 'top').errors.gptPath).toBeDefined();
    expect(parseAdSlot(form({ ...base, enabled: 'on', kind: 'html' }), 'top').errors.html).toBeDefined();
    expect(
      parseAdSlot(form({ ...base, enabled: 'on', kind: 'html', html: '<b>x</b>', height_mobile: '0', height_desktop: '0' }), 'top').errors
        .heightMobile,
    ).toBeDefined();
    expect(parseAdSlot(form({ ...base, kind: 'html', height_mobile: '5000' }), 'top').errors.heightMobile).toBeDefined();
    expect(parseAdSlot(form({ ...base, kind: 'adsense' }), 'top').errors).toEqual({});
  });
});

describe('in-article positions', () => {
  const types = ['paragraph', 'paragraph', 'heading', 'paragraph', 'keyFigures', 'paragraph', 'paragraph', 'paragraph', 'empty', 'paragraph'];
  it('places slots after the chosen text paragraph when two more follow', () => {
    const positions = inlinePositions(types, [
      { placement: 'article_inline_1', paragraph: 3 },
      { placement: 'article_inline_2', paragraph: 6 },
    ]);
    expect([...positions]).toEqual([[3, ['article_inline_1']]]);
    expect([...inlinePositions(types, [{ placement: 'article_inline_1', paragraph: 1 }])]).toEqual([[0, ['article_inline_1']]]);
    expect(inlinePositions(types, [{ placement: 'article_inline_1', paragraph: 20 }]).size).toBe(0);
  });
});

describe('consent', () => {
  it('reads the stored choice and writes the early script', () => {
    expect(readConsent('a=1; pc_consent=all.1; b=2', true)).toBe('all');
    expect(readConsent('pc_consent=necessary.1', true)).toBe('necessary');
    expect(readConsent('pc_consent=all.0', true)).toBe('unset');
    expect(readConsent('', false)).toBe('all');
    expect(consentScript(true)).toContain("window.gtag('consent','default',{ad_storage:'denied'");
    expect(consentScript(false)).toContain("var s='all'");
  });
});
