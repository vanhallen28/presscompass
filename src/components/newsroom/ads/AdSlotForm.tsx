'use client';

import { useActionState, useId, useState } from 'react';
import { ButtonLink } from '@/components/ds/Button';
import { type AdsFormState, saveAdSlot } from '@/modules/ads/actions';
import { ADSENSE_FORMATS, AD_KINDS, type AdKind, type AdSlotRow, type AdsenseFormat, INLINE_PLACEMENTS } from '@/modules/ads/types';
import { CheckboxField, SelectField, TextArea, TextField } from '../Field';
import forms from '../forms.module.css';
import { SubmitButton } from '../SubmitButton';
import { Notice } from '../ui';
import styles from './ads.module.css';

/** One ad placement: on or off, which kind of code, and how much room it keeps on phones and wide screens. */
export function AdSlotForm({ initial, hasAdsense }: { initial: AdSlotRow; hasAdsense: boolean }) {
  const [state, action] = useActionState<AdsFormState, FormData>(saveAdSlot, { errors: {} });
  const uid = useId();
  const values = { ...initial, ...(state.values as Partial<AdSlotRow> | undefined) };
  const errors = state.errors;
  const [kind, setKind] = useState<AdKind>(values.kind);
  const [format, setFormat] = useState<AdsenseFormat>(values.adsenseFormat);
  const inline = INLINE_PLACEMENTS.includes(initial.placement);

  return (
    <form action={action} className={styles.page} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="placement" value={initial.placement} />

      <fieldset className={styles.card}>
        <legend>Slot</legend>
        <CheckboxField
          id={`${uid}-enabled`}
          name="enabled"
          label="Show this slot"
          defaultChecked={values.enabled}
          hint="Slots only appear while ads are on (Ads page, Status), and after the reader accepts cookies when consent is on."
        />
        <SelectField
          id={`${uid}-kind`}
          name="kind"
          label="Ad code"
          value={kind}
          onChange={(event) => setKind(event.target.value as AdKind)}
          error={errors.kind}
        >
          {AD_KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </fieldset>

      <fieldset className={styles.card} hidden={kind !== 'adsense'}>
        <legend>AdSense unit</legend>
        {!hasAdsense && <Notice tone="info">Add the AdSense publisher ID on the Ads page first.</Notice>}
        <SelectField
          id={`${uid}-format`}
          name="adsense_format"
          label="Unit type"
          value={format}
          onChange={(event) => setFormat(event.target.value as AdsenseFormat)}
          hint="Use the same type as the unit you created in AdSense (Ads, By ad unit)."
        >
          {ADSENSE_FORMATS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${uid}-slot`}
          name="adsense_slot"
          label="Ad unit number (data-ad-slot)"
          defaultValue={values.adsenseSlot}
          error={errors.adsenseSlot}
          placeholder="1234567890"
          hint="Copy the number after data-ad-slot= in the unit's code. Pasting the whole data-ad-slot attribute also works."
          mono
        />
        <div hidden={format !== 'in-feed'}>
          <TextField
            id={`${uid}-layout`}
            name="adsense_layout_key"
            label="Layout key (data-ad-layout-key)"
            defaultValue={values.adsenseLayoutKey}
            error={errors.adsenseLayoutKey}
            placeholder="-fb+5w+4e-db+86"
            hint="In-feed units only."
            mono
          />
        </div>
      </fieldset>

      <fieldset className={styles.card} hidden={kind !== 'gpt'}>
        <legend>Google Ad Manager unit</legend>
        <TextField
          id={`${uid}-path`}
          name="gpt_path"
          label="Ad unit path"
          defaultValue={values.gptPath}
          error={errors.gptPath}
          placeholder="/1234567/presscompass/top"
          hint="From Ad Manager: Inventory, Ad units, Tags. The network code and the unit code, starting with a slash."
          mono
        />
        <TextField
          id={`${uid}-sizes`}
          name="gpt_sizes"
          label="Sizes"
          defaultValue={values.gptSizes}
          error={errors.gptSizes}
          placeholder="300x250, 336x280"
          hint="Width x height, separated by commas. fluid for native ads."
          mono
        />
      </fieldset>

      <fieldset className={styles.card} hidden={kind !== 'html'}>
        <legend>Code from another network</legend>
        <TextArea
          id={`${uid}-html`}
          name="html"
          label="Ad code"
          defaultValue={values.html}
          error={errors.html}
          rows={8}
          className={styles.code}
          mono
          spellCheck={false}
          hint="Banner code from Adsterra, Media.net, PropellerAds and similar, or your own sponsor banner. It runs in its own frame the size of the slot; links open in a new tab."
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Room on the page</legend>
        <p className={styles.intro}>
          The slot keeps this much height before the ad loads, so the page does not jump. Match the size of the ad unit. 0 hides the slot on that
          screen size.
        </p>
        <div className={forms.row}>
          <TextField
            id={`${uid}-mobile`}
            name="height_mobile"
            label="Height on phones (px)"
            type="number"
            min={0}
            max={1200}
            defaultValue={values.heightMobile}
            error={errors.heightMobile}
          />
          <TextField
            id={`${uid}-desktop`}
            name="height_desktop"
            label="Height on wide screens (px)"
            type="number"
            min={0}
            max={1200}
            defaultValue={values.heightDesktop}
            error={errors.heightDesktop}
          />
        </div>
        {inline ? (
          <TextField
            id={`${uid}-paragraph`}
            name="paragraph"
            label="After paragraph"
            type="number"
            min={1}
            max={60}
            defaultValue={values.paragraph}
            error={errors.paragraph}
            hint="Counts paragraphs of text only. The ad is left out when fewer than two paragraphs follow."
          />
        ) : (
          <input type="hidden" name="paragraph" value={values.paragraph} />
        )}
      </fieldset>

      <div className={forms.actions}>
        <SubmitButton pendingLabel="Saving…">Save slot</SubmitButton>
        <ButtonLink href="/newsroom/ads#slots" variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
