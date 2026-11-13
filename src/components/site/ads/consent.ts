// Reader consent for ads and tracking. Shared by the server (the early script) and the browser (banner, loaders),
// so this module has no 'use client' (exports of a client module become client references on the server).
//
// The choice lives in the cookie `pc_consent` (`all.1` or `necessary.1`, 12 months). The early script runs before
// the page paints: it sets Google Consent Mode defaults (everything denied) and writes the state to
// <html data-consent="unset | necessary | all">, which CSS uses to show the banner or the ad slots. Pages stay
// static because the server never reads the cookie.

export type ConsentState = 'unset' | 'necessary' | 'all';
export type ConsentChoice = Exclude<ConsentState, 'unset'>;

export const CONSENT_COOKIE = 'pc_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_EVENT = 'pc-consent';
export const CONSENT_MAX_AGE = 365 * 24 * 3600;

/** Cookies that Google and Meta write on this site's own domain, removed when a reader withdraws consent. */
export const AD_COOKIES = ['__gads', '__gpi', '__gpi_optout', '__eoi', '_fbp', '_fbc', '_gcl_au'];

const GRANTED = "{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}";
const DENIED = "{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'}";

/** Reads the stored choice from a cookie header string. */
export function readConsent(cookie: string, required: boolean): ConsentState {
  if (!required) return 'all';
  const match = new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(all|necessary)\\.${CONSENT_VERSION}(?:;|$)`).exec(cookie);
  return (match?.[1] as ConsentChoice | undefined) ?? 'unset';
}

/** The inline script for the start of every site page. */
export function consentScript(required: boolean): string {
  return [
    '(function(){',
    'var d=document.documentElement;',
    'window.dataLayer=window.dataLayer||[];',
    'window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};',
    required
      ? `var m=/(?:^|;\\s*)${CONSENT_COOKIE}=(all|necessary)\\.${CONSENT_VERSION}(?:;|$)/.exec(document.cookie);var s=m?m[1]:'unset';`
      : "var s='all';",
    `window.gtag('consent','default',${required ? DENIED : GRANTED});`,
    required ? `if(s==='all')window.gtag('consent','update',${GRANTED});` : '',
    "d.setAttribute('data-consent',s);",
    '})();',
  ].join('');
}

/** Consent Mode signals for a choice (browser). */
export function consentSignals(choice: ConsentChoice): Record<string, 'granted' | 'denied'> {
  const value = choice === 'all' ? 'granted' : 'denied';
  return { ad_storage: value, ad_user_data: value, ad_personalization: value, analytics_storage: value };
}
