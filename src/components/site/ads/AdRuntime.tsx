'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { injectCode, loadScript, whenConsented } from './loader';

// Site-wide ad and tracking code, mounted once in the site layout. Nothing loads before the reader accepts
// (or straight away when consent is off). The Meta Pixel counts a PageView for every page the reader opens,
// also when Next.js changes pages without a full load.

export type RuntimeConfig = {
  consentRequired: boolean;
  adsenseClient: string;
  /** Load adsbygoogle.js: Auto ads are on, or a slot uses AdSense. */
  adsense: boolean;
  /** Load gpt.js: a slot uses Ad Manager. */
  gpt: boolean;
  metaPixelId: string;
  headCode: string;
  bodyCode: string;
};

let started = false;

function installPixel(id: string) {
  if (window.fbq) return;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  }) as NonNullable<Window['fbq']>;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  loadScript('https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', id);
}

function start(config: RuntimeConfig) {
  if (started) return;
  started = true;
  if (config.adsense && config.adsenseClient) {
    loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsenseClient}`, { crossorigin: 'anonymous' });
  }
  if (config.gpt) {
    window.googletag = window.googletag || { cmd: [] };
    loadScript('https://securepubads.g.doubleclick.net/tag/js/gpt.js', { crossorigin: 'anonymous' });
  }
  if (config.metaPixelId) installPixel(config.metaPixelId);
  if (config.headCode) injectCode(document.head, config.headCode);
  if (config.bodyCode) injectCode(document.body, config.bodyCode);
}

export function AdRuntime({ config }: { config: RuntimeConfig }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => whenConsented(config.consentRequired, () => start(config)), [config]);

  useEffect(() => {
    if (!config.metaPixelId) return;
    return whenConsented(config.consentRequired, () => {
      if (lastPath.current === pathname) return;
      lastPath.current = pathname;
      window.fbq?.('track', 'PageView');
    });
  }, [config, pathname]);

  return null;
}
