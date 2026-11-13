'use client';

import { createContext } from 'react';
import type { MediaItem } from '@/modules/media/types';

/** Media items the editor knows about (loaded with the article, picked or uploaded since), by id. */
export type MediaLookup = { get: (id: string) => MediaItem | undefined; remember: (item: MediaItem) => void };

export const MediaLookupContext = createContext<MediaLookup>({ get: () => undefined, remember: () => {} });
