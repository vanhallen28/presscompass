'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import { type AdsFormState, saveAdSettings } from '@/modules/ads/actions';
import type { AdSettings } from '@/modules/ads/types';
import { adsenseAdsTxtLine } from '@/modules/ads/validate';
import { CheckboxField, TextArea, TextField } from '../Field';
import forms from '../forms.module.css';
import { SubmitButton } from '../SubmitButton';
import { Notice } from '../ui';
import styles from './ads.module.css';

/** All site-wide ad and tracking settings: the switch, consent, AdSense, Meta Pixel, extra code, verification and ads.txt. */
export function AdSettingsForm({ initial }: { initial: AdSettings }) {
  const [state, action] = useActionState<AdsFormState, FormData>(saveAdSettings, { errors: {} });
  const uid = useId();
  const values = { ...initial, ...(state.values as Partial<AdSettings> | undefined) };
  const errors = state.errors;

  return (
    <form action={action} className={styles.page} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}

      <fieldset className={styles.card}>
        <legend>Status</legend>
        <div className={styles.intro} role="note">
          <p>
            Ads make the site commercial, which Vercel allows on the Pro plan (PressCompass runs on Pro). Keep the project on Pro while ads are
            on.
          </p>
          <p>
            While ads are off, the AdSense verification tag, other verification tags and ads.txt still work, so you can apply to ad networks first.
          </p>
        </div>
        {errors.enabled && <Notice tone="error">{errors.enabled}</Notice>}
        <CheckboxField
          id={`${uid}-enabled`}
          name="enabled"
          label="Show ads and run tracking code on the site"
          defaultChecked={values.enabled}
          hint={'Turns on the ad slots below, AdSense Auto ads, the Meta Pixel and the extra code. The Newsroom preview never shows ads.'}
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Consent</legend>
        <p className={styles.intro}>
          Readers in the EU, the UK and Switzerland must agree before ad and tracking cookies are used, and Indonesia&apos;s data protection law (UU
          PDP) asks for consent too. With consent on, readers see a banner with two equal choices, and nothing from Google, Meta or other networks
          loads until they choose Accept all.
        </p>
        <CheckboxField
          id={`${uid}-consent`}
          name="consent_required"
          label="Ask readers before loading ads and tracking code"
          defaultChecked={values.consentRequired}
          hint="Recommended. Turning it off loads everything straight away for every reader; that is your legal decision."
        />
        <TextField
          id={`${uid}-privacy`}
          name="privacy_url"
          label="Privacy policy link"
          defaultValue={values.privacyUrl}
          error={errors.privacyUrl}
          placeholder="/privacy-policy"
          hint={
            <>
              Shown in the banner. Publish the page under <Link href="/newsroom/pages">Pages</Link> first.
            </>
          }
          mono
        />
        <TextField
          id={`${uid}-label`}
          name="label"
          label="Label above ads"
          defaultValue={values.label}
          error={errors.label}
          maxLength={40}
          hint="AdSense asks for “Advertisement” or “Sponsored links”."
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Google AdSense</legend>
        <TextField
          id={`${uid}-client`}
          name="adsense_client"
          label="Publisher ID"
          optional
          defaultValue={values.adsenseClient}
          error={errors.adsenseClient}
          placeholder="ca-pub-1234567890123456"
          hint="From AdSense: Account, Settings, Account information. Adds the AdSense verification tag and the ads.txt line, even while ads are off."
          mono
        />
        {errors.adsenseAuto && <Notice tone="error">{errors.adsenseAuto}</Notice>}
        <CheckboxField
          id={`${uid}-auto`}
          name="adsense_auto"
          label="Load AdSense on every page for Auto ads"
          defaultChecked={values.adsenseAuto}
          hint={
            'Auto ads choose their own places, including anchor and vignette ads. Turn them on or off for presscompass.site in AdSense: Ads, By site. Leave this off to show ads only in your slots.'
          }
        />
        <p className={styles.intro}>
          Ad units (Display, In-article, In-feed, Multiplex) go into the slots below: create the unit in AdSense (Ads, By ad unit) and copy its
          data-ad-slot number into a slot.
        </p>
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Meta Pixel</legend>
        <TextField
          id={`${uid}-pixel`}
          name="meta_pixel_id"
          label="Pixel ID"
          optional
          defaultValue={values.metaPixelId}
          error={errors.metaPixelId}
          placeholder="123456789012345"
          hint="From Meta Events Manager: Data sources, your pixel. Sends PageView on every page a reader opens."
          mono
          inputMode="numeric"
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Other code</legend>
        <p className={styles.intro}>
          For networks without their own field here (Google Ad Manager setup, Adsterra, Media.net, PropellerAds, Google Tag Manager, analytics). The
          code loads after consent, on every site page. Paste it exactly as the network gives it.
        </p>
        <TextArea
          id={`${uid}-head`}
          name="head_code"
          label="Code for the <head>"
          optional
          defaultValue={values.headCode}
          error={errors.headCode}
          rows={6}
          className={styles.code}
          mono
          spellCheck={false}
        />
        <TextArea
          id={`${uid}-body`}
          name="body_code"
          label="Code for the end of the <body>"
          optional
          defaultValue={values.bodyCode}
          error={errors.bodyCode}
          rows={6}
          className={styles.code}
          mono
          spellCheck={false}
          hint="For social bars, pop-unders and similar codes that networks ask you to place before </body>."
        />
        <TextArea
          id={`${uid}-verify`}
          name="verification_meta"
          label="Verification tags"
          optional
          defaultValue={values.verificationMeta}
          error={errors.verificationMeta}
          rows={3}
          mono
          spellCheck={false}
          placeholder={'<meta name="network-site-verification" content="abc123">'}
          hint="One <meta> tag per line. These are always in the page source, even while ads are off, so networks can verify the site."
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>ads.txt</legend>
        <p className={styles.intro}>
          Published at{' '}
          <a href="/ads.txt" target="_blank" rel="noopener">
            presscompass.site/ads.txt
          </a>
          . The AdSense line is added for you from the publisher ID:
        </p>
        <pre className={styles.preview}>{adsenseAdsTxtLine(values.adsenseClient) || 'No AdSense line yet: add the publisher ID above.'}</pre>
        <TextArea
          id={`${uid}-adstxt`}
          name="ads_txt"
          label="Other lines"
          optional
          defaultValue={values.adsTxt}
          error={errors.adsTxt}
          rows={5}
          mono
          spellCheck={false}
          placeholder="adsterra.com, 1234567, DIRECT"
          hint="One line per network, exactly as the network gives it. Comments start with #."
        />
      </fieldset>

      <div className={forms.actions}>
        <SubmitButton pendingLabel="Saving…">Save ad settings</SubmitButton>
      </div>
    </form>
  );
}
