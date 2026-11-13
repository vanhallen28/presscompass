'use server';

import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { refreshSite } from '@/modules/site/invalidate';
import { PLACEMENT_KEYS, type Placement } from './types';
import { type Errors, parseAdSettings, parseAdSlot } from './validate';

// Server Actions for the Ads pages. Each one checks the session itself.

export type AdsFormState = { errors: Errors; values?: Record<string, unknown>; message?: string };

export async function saveAdSettings(_prev: AdsFormState, form: FormData): Promise<AdsFormState> {
  await requireStaff();
  const { values, errors } = parseAdSettings(form);
  if (Object.keys(errors).length) return { errors, values, message: 'Check the fields marked below.' };
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from('ad_settings')
    .update({
      enabled: values.enabled,
      consent_required: values.consentRequired,
      privacy_url: values.privacyUrl,
      label: values.label,
      adsense_client: values.adsenseClient,
      adsense_auto: values.adsenseAuto,
      meta_pixel_id: values.metaPixelId,
      head_code: values.headCode,
      body_code: values.bodyCode,
      verification_meta: values.verificationMeta,
      ads_txt: values.adsTxt,
    })
    .eq('id', true);
  if (error) return { errors: {}, values, message: `The settings could not be saved. ${error.message}` };
  refreshSite();
  redirect('/newsroom/ads?notice=updated');
}

export async function saveAdSlot(_prev: AdsFormState, form: FormData): Promise<AdsFormState> {
  await requireStaff();
  const placement = form.get('placement');
  if (typeof placement !== 'string' || !PLACEMENT_KEYS.includes(placement as Placement)) redirect('/newsroom/ads');
  const { values, errors } = parseAdSlot(form, placement as Placement);
  const supabase = await createSessionClient();
  if (values.enabled && values.kind === 'adsense' && !errors.adsenseSlot) {
    const { data } = await supabase.from('ad_settings').select('adsense_client').maybeSingle<{ adsense_client: string }>();
    if (!data?.adsense_client) errors.kind = 'Add the AdSense publisher ID on the Ads page first.';
  }
  if (Object.keys(errors).length) return { errors, values, message: 'Check the fields marked below.' };
  const { error } = await supabase
    .from('ad_slots')
    .update({
      enabled: values.enabled,
      kind: values.kind,
      adsense_slot: values.adsenseSlot,
      adsense_format: values.adsenseFormat,
      adsense_layout_key: values.adsenseLayoutKey,
      gpt_path: values.gptPath,
      gpt_sizes: values.gptSizes,
      html: values.html,
      height_mobile: values.heightMobile,
      height_desktop: values.heightDesktop,
      paragraph: values.paragraph,
    })
    .eq('placement', values.placement);
  if (error) return { errors: {}, values, message: `The slot could not be saved. ${error.message}` };
  refreshSite();
  redirect('/newsroom/ads?notice=slot-updated#slots');
}
