import { ADSENSE_FORMATS, AD_KINDS, type AdKind, type AdSettings, type AdSlotConfig, type AdsenseFormat, type Placement } from './types';

// Checks what the Ads forms send. Pure functions, shared by the Server Actions, the site and the tests.

export type Errors = Partial<Record<string, string>>;

export const LIMITS = { code: 50_000, slotHtml: 20_000, verification: 5_000, adsTxt: 20_000, label: 40, height: 1200, paragraph: 60 } as const;

const PRIVACY_URL = /^(\/[a-z0-9/-]*|https?:\/\/\S+)$/;
const GPT_PATH = /^\/[0-9]+(,[0-9]+)?(\/[A-Za-z0-9_.-]+)+$/;
const LAYOUT_KEY = /^[-+a-z0-9]{4,60}$/i;
const DOMAIN = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;
const VARIABLE = /^(contact|subdomain|inventorypartnerdomain|ownerdomain|managerdomain)\s*=\s*\S/i;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};
const checked = (form: FormData, key: string) => form.get(key) === 'on' || form.get(key) === 'true';

/** `ca-pub-` and 10 to 20 digits. Accepts `pub-…`, the bare digits, or a pasted line that contains the ID. */
export function normalizeAdsenseClient(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /(?:ca-)?pub-(\d{10,20})/.exec(trimmed) ?? /^(\d{10,20})$/.exec(trimmed);
  return match ? `ca-pub-${match[1]}` : null;
}

/** The ads.txt line AdSense asks for, from the publisher ID. */
export function adsenseAdsTxtLine(client: string): string {
  return client ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0` : '';
}

/** Checks extra ads.txt lines (IAB ads.txt 1.1): records, variables, comments and blank lines. */
export function checkAdsTxt(value: string): { lines: string[]; error?: string } {
  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  for (const [index, line] of lines.entries()) {
    if (!line || line.startsWith('#') || VARIABLE.test(line)) continue;
    const fields = line
      .replace(/#.*$/, '')
      .split(',')
      .map((field) => field.trim());
    const [domain, account, relation, cert] = fields;
    if (
      (fields.length !== 3 && fields.length !== 4) ||
      !DOMAIN.test(domain) ||
      !/^\S+$/.test(account) ||
      !/^(direct|reseller)$/i.test(relation) ||
      (cert !== undefined && !/^[a-z0-9]{1,40}$/i.test(cert))
    ) {
      return {
        lines,
        error: `Line ${index + 1}: write it as "domain, account ID, DIRECT or RESELLER" with an optional certification ID, as the network gives it.`,
      };
    }
  }
  return { lines };
}

/** The whole ads.txt file: the AdSense line, then the extra lines. Empty when there is nothing to declare. */
export function adsTxtBody(settings: Pick<AdSettings, 'adsenseClient' | 'adsTxt'>): string {
  const lines = [adsenseAdsTxtLine(settings.adsenseClient), ...checkAdsTxt(settings.adsTxt).lines].filter((line, index) => index > 0 || line);
  const body = lines.join('\n').trim();
  return body && lines.some((line) => line && !line.startsWith('#')) ? `${body}\n` : '';
}

export type MetaTag = { name: string; content: string };

const BLOCKED_META = new Set(['viewport', 'robots', 'googlebot', 'description', 'theme-color', 'color-scheme', 'referrer']);

/** Verification tags, one `<meta name="…" content="…">` per line (as networks give them). */
export function parseVerificationMeta(value: string): { tags: MetaTag[]; error?: string } {
  const tags: MetaTag[] = [];
  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const tag = /^<meta\s+([^<>]*?)\s*\/?>$/i.exec(line);
    const attrs: Record<string, string> = {};
    for (const match of (tag?.[1] ?? '').matchAll(/([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))
      attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
    const name = attrs.name ?? '';
    const keys = Object.keys(attrs);
    if (
      !tag ||
      !name ||
      !attrs.content ||
      keys.some((key) => !['name', 'content'].includes(key)) ||
      name.length > 100 ||
      attrs.content.length > 500
    ) {
      return { tags, error: `Line ${index + 1}: paste one tag per line, like <meta name="network-verification" content="abc123">.` };
    }
    if (BLOCKED_META.has(name.toLowerCase())) return { tags, error: `Line ${index + 1}: the site sets "${name}" itself.` };
    tags.push({ name, content: attrs.content });
  }
  return { tags };
}

/** Ad Manager sizes: `300x250, 336x280, fluid`. Null when empty or invalid. */
export function parseGptSizes(value: string): (number[] | 'fluid')[] | null {
  const parts = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length || parts.length > 10) return null;
  const sizes: (number[] | 'fluid')[] = [];
  for (const part of parts) {
    if (part === 'fluid') {
      sizes.push('fluid');
      continue;
    }
    const match = /^(\d{1,4})\s*x\s*(\d{1,4})$/.exec(part);
    if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) return null;
    sizes.push([Number(match[1]), Number(match[2])]);
  }
  return sizes;
}

export function parseAdSettings(form: FormData): { values: AdSettings; errors: Errors } {
  const errors: Errors = {};
  const client = normalizeAdsenseClient(text(form, 'adsense_client'));
  const values: AdSettings = {
    enabled: checked(form, 'enabled'),
    consentRequired: checked(form, 'consent_required'),
    privacyUrl: text(form, 'privacy_url').trim(),
    label: text(form, 'label').trim() || 'Advertisement',
    adsenseClient: client ?? text(form, 'adsense_client').trim(),
    adsenseAuto: checked(form, 'adsense_auto'),
    metaPixelId: text(form, 'meta_pixel_id').trim(),
    headCode: text(form, 'head_code').trim(),
    bodyCode: text(form, 'body_code').trim(),
    verificationMeta: text(form, 'verification_meta').trim(),
    adsTxt: text(form, 'ads_txt').trim(),
  };
  if (values.privacyUrl && !PRIVACY_URL.test(values.privacyUrl))
    errors.privacyUrl = 'Use an address on this site such as /privacy-policy, or a full link that starts with https://.';
  if (values.label.length > LIMITS.label) errors.label = `Keep the label under ${LIMITS.label} characters.`;
  if (client === null) errors.adsenseClient = 'Use the publisher ID from AdSense, for example ca-pub-1234567890123456.';
  if (values.metaPixelId && !/^\d{6,20}$/.test(values.metaPixelId)) errors.metaPixelId = 'The Pixel ID is a number, for example 123456789012345.';
  if (values.headCode.length > LIMITS.code) errors.headCode = 'This code is too long (at most 50,000 characters).';
  if (values.bodyCode.length > LIMITS.code) errors.bodyCode = 'This code is too long (at most 50,000 characters).';
  if (values.verificationMeta.length > LIMITS.verification) errors.verificationMeta = 'Too many tags (at most 5,000 characters).';
  else {
    const meta = parseVerificationMeta(values.verificationMeta);
    if (meta.error) errors.verificationMeta = meta.error;
  }
  if (values.adsTxt.length > LIMITS.adsTxt) errors.adsTxt = 'Too many lines (at most 20,000 characters).';
  else {
    const adsTxt = checkAdsTxt(values.adsTxt);
    if (adsTxt.error) errors.adsTxt = adsTxt.error;
  }
  if (values.adsenseAuto && !values.adsenseClient) errors.adsenseAuto = 'Add the AdSense publisher ID first.';
  if (values.enabled && !values.privacyUrl)
    errors.enabled = 'Add the privacy policy link (under Consent) before turning ads on. AdSense and Meta require one.';
  return { values, errors };
}

const int = (value: string, fallback: number) => (/^\s*\d+\s*$/.test(value) ? Number(value) : fallback);

export function parseAdSlot(form: FormData, placement: Placement): { values: AdSlotConfig & { enabled: boolean }; errors: Errors } {
  const errors: Errors = {};
  const kind = text(form, 'kind') as AdKind;
  const format = text(form, 'adsense_format') as AdsenseFormat;
  const slotField = text(form, 'adsense_slot').trim();
  const layoutField = text(form, 'adsense_layout_key').trim();
  const values = {
    placement,
    enabled: checked(form, 'enabled'),
    kind: AD_KINDS.some((k) => k.value === kind) ? kind : 'adsense',
    adsenseSlot: /data-ad-slot\s*=\s*["']?(\d+)/.exec(slotField)?.[1] ?? slotField,
    adsenseFormat: ADSENSE_FORMATS.some((f) => f.value === format) ? format : 'display',
    adsenseLayoutKey: /data-ad-layout-key\s*=\s*["']?([^"'\s>]+)/.exec(layoutField)?.[1] ?? layoutField,
    gptPath: text(form, 'gpt_path').trim(),
    gptSizes: text(form, 'gpt_sizes').trim(),
    html: text(form, 'html').trim(),
    heightMobile: int(text(form, 'height_mobile'), -1),
    heightDesktop: int(text(form, 'height_desktop'), -1),
    paragraph: int(text(form, 'paragraph'), -1),
  } satisfies AdSlotConfig & { enabled: boolean };

  if (values.adsenseSlot && !/^\d{6,20}$/.test(values.adsenseSlot))
    errors.adsenseSlot = 'Use the number from data-ad-slot in the AdSense code, for example 1234567890.';
  if (values.adsenseLayoutKey && !LAYOUT_KEY.test(values.adsenseLayoutKey))
    errors.adsenseLayoutKey = 'Use the value of data-ad-layout-key from the AdSense code, for example -fb+5w+4e-db+86.';
  if (values.gptPath && !GPT_PATH.test(values.gptPath))
    errors.gptPath = 'Use the full ad unit path from Ad Manager, for example /1234567/presscompass/top.';
  if (values.gptSizes && !parseGptSizes(values.gptSizes))
    errors.gptSizes = 'List sizes as width x height, separated by commas, for example 300x250, 336x280 (or fluid).';
  if (values.html.length > LIMITS.slotHtml) errors.html = 'This code is too long (at most 20,000 characters).';
  for (const key of ['heightMobile', 'heightDesktop'] as const) {
    if (values[key] < 0 || values[key] > LIMITS.height)
      errors[key] = `Use a number of pixels from 0 to ${LIMITS.height}. 0 hides the slot on this screen size.`;
  }
  if (values.paragraph < 1 || values.paragraph > LIMITS.paragraph) errors.paragraph = `Use a paragraph number from 1 to ${LIMITS.paragraph}.`;

  if (values.enabled) {
    if (values.kind === 'adsense' && !values.adsenseSlot) errors.adsenseSlot ??= 'Add the ad unit number to turn this slot on.';
    if (values.kind === 'adsense' && values.adsenseFormat === 'in-feed' && !values.adsenseLayoutKey)
      errors.adsenseLayoutKey ??= 'In-feed units need their layout key.';
    if (values.kind === 'gpt' && !values.gptPath) errors.gptPath ??= 'Add the ad unit path to turn this slot on.';
    if (values.kind === 'gpt' && !values.gptSizes) errors.gptSizes ??= 'Add at least one size to turn this slot on.';
    if (values.kind === 'html' && !values.html) errors.html ??= 'Paste the ad code to turn this slot on.';
    if (values.heightMobile === 0 && values.heightDesktop === 0)
      errors.heightMobile ??= 'Give at least one screen size a height, or turn the slot off.';
  }
  return { values, errors };
}

/** Where in-article slots go: the index of the top-level block after which each placement is inserted. */
export function inlinePositions(blockTypes: string[], wanted: { placement: Placement; paragraph: number }[]): Map<number, Placement[]> {
  const paragraphs: number[] = [];
  blockTypes.forEach((type, index) => {
    if (type === 'paragraph') paragraphs.push(index);
  });
  const result = new Map<number, Placement[]>();
  const used = new Set<number>();
  for (const { placement, paragraph } of [...wanted].sort((a, b) => a.paragraph - b.paragraph)) {
    const index = paragraphs[paragraph - 1];
    // Only where at least two more paragraphs follow, and never two slots after the same block.
    if (index === undefined || paragraphs.filter((p) => p > index).length < 2 || used.has(index)) continue;
    used.add(index);
    result.set(index, [...(result.get(index) ?? []), placement]);
  }
  return result;
}
