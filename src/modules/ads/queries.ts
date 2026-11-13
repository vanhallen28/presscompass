import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient, createSessionClient } from '@/lib/supabase/clients';
import { TAGS } from '@/modules/site/cache';
import { NO_ADS, PLACEMENT_KEYS, type AdSettings, type AdSlotRow, type Placement, type SiteAds } from './types';

// Ads data. The site reads site_ads() (cached with the rest of the site, tag `site`); the Newsroom reads the
// tables with the owner's session.

/** What the site needs. Falls back to no ads when the migration is missing, so pages still render. */
export async function getSiteAds(): Promise<SiteAds> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  const { data, error } = await createPublicClient().rpc('site_ads');
  if (error || !data) return NO_ADS;
  return { ...NO_ADS, ...(data as SiteAds) };
}

type SettingsRow = {
  enabled: boolean;
  consent_required: boolean;
  privacy_url: string;
  label: string;
  adsense_client: string;
  adsense_auto: boolean;
  meta_pixel_id: string;
  head_code: string;
  body_code: string;
  verification_meta: string;
  ads_txt: string;
};

type SlotDbRow = {
  placement: Placement;
  enabled: boolean;
  kind: AdSlotRow['kind'];
  adsense_slot: string;
  adsense_format: AdSlotRow['adsenseFormat'];
  adsense_layout_key: string;
  gpt_path: string;
  gpt_sizes: string;
  html: string;
  height_mobile: number;
  height_desktop: number;
  paragraph: number;
  updated_at: string;
};

export async function getAdSettings(): Promise<AdSettings> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('ad_settings').select('*').maybeSingle<SettingsRow>();
  if (error) throw new Error(`ad_settings: ${error.message}`);
  if (!data) throw new Error('ad_settings: the settings row is missing. Run npm run db:push.');
  return {
    enabled: data.enabled,
    consentRequired: data.consent_required,
    privacyUrl: data.privacy_url,
    label: data.label,
    adsenseClient: data.adsense_client,
    adsenseAuto: data.adsense_auto,
    metaPixelId: data.meta_pixel_id,
    headCode: data.head_code,
    bodyCode: data.body_code,
    verificationMeta: data.verification_meta,
    adsTxt: data.ads_txt,
  };
}

export async function getAdSlots(): Promise<AdSlotRow[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('ad_slots').select('*').returns<SlotDbRow[]>();
  if (error) throw new Error(`ad_slots: ${error.message}`);
  const rows = (data ?? []).map((row): AdSlotRow => ({
    placement: row.placement,
    enabled: row.enabled,
    kind: row.kind,
    adsenseSlot: row.adsense_slot,
    adsenseFormat: row.adsense_format,
    adsenseLayoutKey: row.adsense_layout_key,
    gptPath: row.gpt_path,
    gptSizes: row.gpt_sizes,
    html: row.html,
    heightMobile: row.height_mobile,
    heightDesktop: row.height_desktop,
    paragraph: row.paragraph,
    updatedAt: row.updated_at,
  }));
  return rows.sort((a, b) => PLACEMENT_KEYS.indexOf(a.placement) - PLACEMENT_KEYS.indexOf(b.placement));
}
