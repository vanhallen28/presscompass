'use client';

import { useState } from 'react';
import { Button } from '@/components/ds/Button';
import forms from '@/components/newsroom/forms.module.css';
import type { MediaItem } from '@/modules/media/types';
import { CloudImage } from './CloudImage';
import { ImagePickerDialog } from './ImagePickerDialog';
import styles from './media.module.css';

/** The author's profile photo: chosen from the media library, sent with the form as `photo_media_id`. */
export function AuthorPhotoField({ initial }: { initial: MediaItem | null }) {
  const [photo, setPhoto] = useState<MediaItem | null>(initial);
  const [picking, setPicking] = useState(false);

  return (
    <fieldset className={forms.fieldset}>
      <legend className={forms.label}>
        Photo <span className={forms.optional}>(optional)</span>
      </legend>
      <input type="hidden" name="photo_media_id" value={photo?.id ?? ''} />
      <div className={styles.photoField}>
        {photo ? (
          <CloudImage image={photo} alt="" preset="square" sizes="96px" className={styles.photo} />
        ) : (
          <span className={styles.photoEmpty} aria-hidden="true" />
        )}
        <div className={styles.photoSide}>
          <p className={photo && !photo.alt ? styles.noAltText : forms.hint}>
            {photo ? (photo.alt ? `Alt text: ${photo.alt}` : 'No alt text yet. Add it so screen readers can describe the photo.') : 'Shown on the author page and next to the byline. A square crop is made automatically.'}
          </p>
          <div className={styles.photoButtons}>
            <Button size="sm" icon="image" onClick={() => setPicking(true)}>
              {photo ? 'Change photo' : 'Choose photo'}
            </Button>
            {photo && (
              <Button size="sm" variant="quiet" onClick={() => setPhoto(null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      {picking && (
        <ImagePickerDialog
          title="Author photo"
          initial={photo}
          caption={null}
          submitLabel="Use as photo"
          onClose={() => setPicking(false)}
          onSave={({ media }) => {
            setPhoto(media);
            setPicking(false);
          }}
        />
      )}
    </fieldset>
  );
}
