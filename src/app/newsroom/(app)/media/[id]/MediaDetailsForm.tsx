'use client';

import { useActionState, useId } from 'react';
import { TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { Notice } from '@/components/newsroom/ui';
import { type MediaFormState, updateMedia } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { MEDIA_LIMITS } from '@/modules/media/validate';

export function MediaDetailsForm({ media }: { media: MediaItem }) {
  const [state, action] = useActionState<MediaFormState, FormData>(updateMedia, { errors: {} });
  const uid = useId();
  const values = state.values ?? { alt: media.alt, caption: media.caption, credit: media.credit };
  return (
    <form action={action} className={forms.form} noValidate>
      {state.saved && <Notice tone="success">Details saved.</Notice>}
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="id" value={media.id} />
      <TextArea
        id={`${uid}-alt`}
        name="alt"
        label="Alt text"
        rows={3}
        defaultValue={values.alt}
        maxLength={MEDIA_LIMITS.alt}
        error={state.errors.alt}
        hint="What the image shows, for readers who cannot see it. Needed before an article that uses it can be published."
      />
      <TextArea
        id={`${uid}-caption`}
        name="caption"
        label="Default caption"
        optional
        rows={2}
        defaultValue={values.caption}
        maxLength={MEDIA_LIMITS.caption}
        error={state.errors.caption}
        hint="Suggested when the image is added to an article. Each article can change it."
      />
      <TextField
        id={`${uid}-credit`}
        name="credit"
        label="Credit"
        optional
        defaultValue={values.credit}
        maxLength={MEDIA_LIMITS.credit}
        error={state.errors.credit}
        placeholder="Rani Prameswari/PressCompass"
        hint="Shown as “Photo: …”. Start with a label to change it, for example “Illustration: PressCompass”."
      />
      <div className={forms.actions}>
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}
