// Ads on the public site: the fixed placements, what the Newsroom edits, and what the site reads
// (site_ads() in supabase/migrations/20261117000100_ads_pages.sql).

export const PLACEMENTS = [
  { key: 'top', name: 'Below the header', where: 'Every site page, under the navigation and the Latest strip.' },
  { key: 'home_middle', name: 'Front page, between sections', where: 'After the second section row of the front page.' },
  { key: 'list', name: 'Story lists', where: 'Section, author, tag and search pages, after the sixth story.' },
  { key: 'article_inline_1', name: 'In the article, first', where: 'Inside the article text, after the paragraph you choose.' },
  { key: 'article_inline_2', name: 'In the article, second', where: 'Further down the article text, only when at least two more paragraphs follow.' },
  { key: 'article_end', name: 'After the article', where: 'Below the article text, before the sources.' },
  { key: 'article_rail', name: 'Article sidebar', where: 'In the right-hand column under Related. Wide screens only.' },
  { key: 'footer', name: 'Above the footer', where: 'Every site page, above the navy footer.' },
] as const;

export type Placement = (typeof PLACEMENTS)[number]['key'];
export const PLACEMENT_KEYS = PLACEMENTS.map((p) => p.key) as readonly Placement[];
export const INLINE_PLACEMENTS: readonly Placement[] = ['article_inline_1', 'article_inline_2'];

export type AdKind = 'adsense' | 'gpt' | 'html';
export const AD_KINDS: { value: AdKind; label: string }[] = [
  { value: 'adsense', label: 'Google AdSense unit' },
  { value: 'gpt', label: 'Google Ad Manager (GPT)' },
  { value: 'html', label: 'Code from another network' },
];

export type AdsenseFormat = 'display' | 'in-article' | 'in-feed' | 'multiplex';
export const ADSENSE_FORMATS: { value: AdsenseFormat; label: string }[] = [
  { value: 'display', label: 'Display (responsive)' },
  { value: 'in-article', label: 'In-article' },
  { value: 'in-feed', label: 'In-feed' },
  { value: 'multiplex', label: 'Multiplex' },
];

export type AdSettings = {
  enabled: boolean;
  consentRequired: boolean;
  privacyUrl: string;
  label: string;
  adsenseClient: string;
  adsenseAuto: boolean;
  metaPixelId: string;
  headCode: string;
  bodyCode: string;
  verificationMeta: string;
  adsTxt: string;
};

export type AdSlotConfig = {
  placement: Placement;
  kind: AdKind;
  adsenseSlot: string;
  adsenseFormat: AdsenseFormat;
  adsenseLayoutKey: string;
  gptPath: string;
  gptSizes: string;
  html: string;
  heightMobile: number;
  heightDesktop: number;
  paragraph: number;
};

export type AdSlotRow = AdSlotConfig & { enabled: boolean; updatedAt: string };

/** What the site reads. Code fields are empty and `slots` is empty while ads are off. */
export type SiteAds = Omit<AdSettings, 'adsenseAuto'> & { adsenseAuto: boolean; slots: AdSlotConfig[] };

export const NO_ADS: SiteAds = {
  enabled: false,
  consentRequired: true,
  privacyUrl: '',
  label: 'Advertisement',
  adsenseClient: '',
  adsenseAuto: false,
  metaPixelId: '',
  headCode: '',
  bodyCode: '',
  verificationMeta: '',
  adsTxt: '',
  slots: [],
};

/** Ads, Meta Pixel or extra code will run on the site (and the consent banner is needed). */
export function adsActive(ads: SiteAds): boolean {
  return ads.enabled && (ads.slots.length > 0 || ads.adsenseAuto || Boolean(ads.metaPixelId || ads.headCode || ads.bodyCode));
}

/** The slot for a placement while ads are on, or undefined. */
export function slotFor(ads: SiteAds, placement: Placement): AdSlotConfig | undefined {
  return ads.enabled ? ads.slots.find((slot) => slot.placement === placement) : undefined;
}
