// Site-wide SEO settings (Newsroom, SEO settings), stored in layouts key 'seo'. Pure: parse the form, read
// the stored JSON with defaults, and build robots.txt.

export type SeoSettings = {
  /** Let search engines index the site. Off until launch: every page says noindex. */
  indexing: boolean;
  siteName: string;
  /** Title of every page except the front page; %s is the page's own title. */
  titleTemplate: string;
  homeTitle: string;
  /** The front page's description, and the fallback for pages without one. */
  description: string;
  /** Publication name for the Google News sitemap; must match the name on news.google.com. */
  newsName: string;
  /** Profiles of the publication elsewhere (social networks, Wikipedia), for the organisation's sameAs. */
  sameAs: string[];
  /** Addresses of the editorial standards and corrections pages (path on this site or full address). */
  publishingPrinciples: string;
  correctionsPolicy: string;
  /** Extra robots.txt lines, added after the built-in rules. */
  robots: string;
};

export const DEFAULT_SEO: SeoSettings = {
  indexing: false,
  siteName: 'PressCompass',
  titleTemplate: '%s · PressCompass',
  homeTitle: 'PressCompass · News with a sense of direction',
  description: 'Independent, English-language news about Indonesia. Facts verified, context explained.',
  newsName: 'PressCompass',
  sameAs: [],
  publishingPrinciples: '',
  correctionsPolicy: '',
  robots: '',
};

const LIMITS = { siteName: 60, titleTemplate: 80, homeTitle: 120, description: 320, newsName: 100, sameAs: 10, url: 500, robotsLines: 50 } as const;

const HTTPS = /^https:\/\/[^\s/]+\.[^\s]+$/i;
const ADDRESS = (value: string) => value === '' || (value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value)) || HTTPS.test(value);
const ROBOTS_LINE = /^(?:#.*|(?:user-agent|allow|disallow|crawl-delay|sitemap)\s*:\s*\S.*)$/i;

const text = (value: unknown, max: number, fallback = '') => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : fallback);

/** The stored settings with defaults for anything missing or malformed. */
export function readSeoSettings(raw: unknown): SeoSettings {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const template = text(r.titleTemplate, LIMITS.titleTemplate);
  return {
    indexing: r.indexing === true,
    siteName: text(r.siteName, LIMITS.siteName) || DEFAULT_SEO.siteName,
    titleTemplate: template.includes('%s') ? template : DEFAULT_SEO.titleTemplate,
    homeTitle: text(r.homeTitle, LIMITS.homeTitle) || DEFAULT_SEO.homeTitle,
    description: text(r.description, LIMITS.description) || DEFAULT_SEO.description,
    newsName: text(r.newsName, LIMITS.newsName) || DEFAULT_SEO.newsName,
    sameAs: Array.isArray(r.sameAs) ? r.sameAs.filter((u): u is string => typeof u === 'string' && HTTPS.test(u)).slice(0, LIMITS.sameAs) : [],
    publishingPrinciples: typeof r.publishingPrinciples === 'string' && ADDRESS(r.publishingPrinciples) ? r.publishingPrinciples : '',
    correctionsPolicy: typeof r.correctionsPolicy === 'string' && ADDRESS(r.correctionsPolicy) ? r.correctionsPolicy : '',
    robots: typeof r.robots === 'string' ? r.robots.slice(0, 4000) : '',
  };
}

export type SeoSettingsErrors = Partial<Record<keyof SeoSettings, string>>;

export function parseSeoSettings(form: FormData): { ok: true; value: SeoSettings } | { ok: false; errors: SeoSettingsErrors; value: SeoSettings } {
  const get = (key: string) => String(form.get(key) ?? '');
  const errors: SeoSettingsErrors = {};
  const value: SeoSettings = {
    indexing: form.get('indexing') === 'on',
    siteName: get('siteName').replace(/\s+/g, ' ').trim(),
    titleTemplate: get('titleTemplate').replace(/\s+/g, ' ').trim(),
    homeTitle: get('homeTitle').replace(/\s+/g, ' ').trim(),
    description: get('description').replace(/\s+/g, ' ').trim(),
    newsName: get('newsName').replace(/\s+/g, ' ').trim(),
    sameAs: get('sameAs')
      .split(/\s+/)
      .map((u) => u.trim())
      .filter(Boolean),
    publishingPrinciples: get('publishingPrinciples').trim(),
    correctionsPolicy: get('correctionsPolicy').trim(),
    robots: get('robots')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n'),
  };
  if (!value.siteName || value.siteName.length > LIMITS.siteName) errors.siteName = `Enter the site name, up to ${LIMITS.siteName} characters.`;
  if ((value.titleTemplate.match(/%s/g) ?? []).length !== 1 || value.titleTemplate.length > LIMITS.titleTemplate)
    errors.titleTemplate = 'Use %s once where the page title goes, for example "%s · PressCompass".';
  if (!value.homeTitle || value.homeTitle.length > LIMITS.homeTitle)
    errors.homeTitle = `Enter the front page title, up to ${LIMITS.homeTitle} characters.`;
  if (!value.description || value.description.length > LIMITS.description)
    errors.description = `Enter a description, up to ${LIMITS.description} characters.`;
  if (!value.newsName || value.newsName.length > LIMITS.newsName || /[()]/.test(value.newsName))
    errors.newsName = 'Enter the publication name as Google News shows it, without brackets.';
  if (value.sameAs.length > LIMITS.sameAs || value.sameAs.some((u) => !HTTPS.test(u) || u.length > LIMITS.url))
    errors.sameAs = `Enter up to ${LIMITS.sameAs} full addresses starting with https://, one per line.`;
  for (const key of ['publishingPrinciples', 'correctionsPolicy'] as const) {
    if (!ADDRESS(value[key]) || value[key].length > LIMITS.url)
      errors[key] = 'Use an address on this site such as /editorial-standards, or a full https:// address.';
  }
  const lines = value.robots ? value.robots.split('\n') : [];
  const bad = lines.find((line) => !ROBOTS_LINE.test(line));
  if (lines.length > LIMITS.robotsLines) errors.robots = `Keep it to ${LIMITS.robotsLines} lines.`;
  else if (bad) errors.robots = `"${bad.slice(0, 60)}" is not a robots.txt rule. Use User-agent, Allow, Disallow, Crawl-delay or Sitemap lines.`;
  return Object.keys(errors).length ? { ok: false, errors, value } : { ok: true, value };
}

/** robots.txt: crawl everything readers see; keep the Newsroom, the API and search results out. */
export function robotsTxt(settings: SeoSettings, origin: string, production: boolean): string {
  if (!production) return 'User-agent: *\nDisallow: /\n';
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /newsroom', 'Disallow: /api/', 'Disallow: /search'];
  if (settings.robots) lines.push('', settings.robots);
  lines.push('', `Sitemap: ${origin}/sitemap.xml`, `Sitemap: ${origin}/news-sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** An address from the settings as an absolute URL. */
export function absolute(origin: string, address: string): string {
  return address.startsWith('/') ? `${origin}${address}` : address;
}
