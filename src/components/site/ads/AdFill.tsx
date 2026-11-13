'use client';

import { useEffect, useRef } from 'react';
import type { AdSlotConfig } from '@/modules/ads/types';
import { parseGptSizes } from '@/modules/ads/validate';
import { whenConsented } from './loader';

// Fills one ad slot when the reader has accepted and the slot is about to scroll into view. Hidden slots
// (a page Next.js keeps in the background, or a size hidden on this screen) never fill.

type GoogleTag = {
  cmd: { push: (fn: () => void) => void };
  defineSlot: (path: string, sizes: unknown, id: string) => { addService: (service: unknown) => unknown } | null;
  pubads: () => unknown;
  enableServices: () => void;
  display: (id: string) => void;
  destroySlots: (slots: unknown[]) => void;
};

let gptServices = false;
let counter = 0;

const ADSENSE_ATTRS: Record<AdSlotConfig['adsenseFormat'], Record<string, string>> = {
  display: { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' },
  'in-article': { 'data-ad-layout': 'in-article', 'data-ad-format': 'fluid' },
  'in-feed': { 'data-ad-format': 'fluid' },
  multiplex: { 'data-ad-format': 'autorelaxed' },
};

function frameDocument(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{display:flex;justify-content:center;align-items:flex-start}</style></head><body>${html}</body></html>`;
}

function fill(box: HTMLDivElement, slot: AdSlotConfig, client: string, label: string): (() => void) | void {
  if (slot.kind === 'adsense') {
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    if (slot.adsenseFormat === 'in-article') ins.style.textAlign = 'center';
    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', slot.adsenseSlot);
    for (const [name, value] of Object.entries(ADSENSE_ATTRS[slot.adsenseFormat])) ins.setAttribute(name, value);
    if (slot.adsenseFormat === 'in-feed') ins.setAttribute('data-ad-layout-key', slot.adsenseLayoutKey);
    box.appendChild(ins);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    return;
  }
  if (slot.kind === 'gpt') {
    const id = `pc-gpt-${slot.placement}-${(counter += 1)}`;
    const div = document.createElement('div');
    div.id = id;
    box.appendChild(div);
    const sizes = parseGptSizes(slot.gptSizes) ?? [];
    window.googletag = window.googletag || { cmd: [] };
    const googletag = window.googletag as unknown as GoogleTag;
    let defined: unknown = null;
    googletag.cmd.push(() => {
      const gptSlot = googletag.defineSlot(slot.gptPath, sizes.length === 1 ? sizes[0] : sizes, id);
      if (!gptSlot) return;
      gptSlot.addService(googletag.pubads());
      defined = gptSlot;
      if (!gptServices) {
        gptServices = true;
        googletag.enableServices();
      }
      googletag.display(id);
    });
    return () => {
      if (defined) googletag.cmd.push(() => googletag.destroySlots([defined]));
    };
  }
  const frame = document.createElement('iframe');
  frame.title = label;
  frame.setAttribute('scrolling', 'no');
  frame.srcdoc = frameDocument(slot.html);
  box.appendChild(frame);
}

export function AdFill({
  slot,
  client,
  label,
  consentRequired,
  className,
}: {
  slot: AdSlotConfig;
  client: string;
  label: string;
  consentRequired: boolean;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let cleanup: (() => void) | void;
    let observer: IntersectionObserver | null = null;
    const stopConsent = whenConsented(consentRequired, () => {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting) || box.dataset.filled) return;
          box.dataset.filled = 'true';
          observer?.disconnect();
          cleanup = fill(box, slot, client, label);
        },
        { rootMargin: '400px 0px' },
      );
      observer.observe(box);
    });
    return () => {
      stopConsent();
      observer?.disconnect();
      cleanup?.();
    };
  }, [slot, client, label, consentRequired]);

  return <div ref={ref} className={className} data-ad-kind={slot.kind} />;
}
