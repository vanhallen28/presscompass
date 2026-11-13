'use client';

import { useId } from 'react';
import { AD_COOKIES, CONSENT_COOKIE, CONSENT_EVENT, CONSENT_MAX_AGE, CONSENT_VERSION, type ConsentChoice, consentSignals } from './consent';
import styles from './ads.module.css';

// The cookie banner: two equal choices, shown by CSS while <html data-consent="unset"> or when the reader opens
// Cookie settings (data-consent-open). Choosing writes the cookie, updates Google Consent Mode, and tells the
// ad runtime. Withdrawing consent removes the ad cookies on this domain and reloads the page, because scripts
// that already run cannot be stopped.

function removeCookie(name: string) {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`;
  }
}

export function choose(choice: ConsentChoice) {
  const html = document.documentElement;
  const before = html.getAttribute('data-consent');
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${choice}.${CONSENT_VERSION}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  html.removeAttribute('data-consent-open');
  window.gtag?.('consent', 'update', consentSignals(choice));
  if (before === 'all' && choice === 'necessary') {
    for (const name of AD_COOKIES) removeCookie(name);
    location.reload();
    return;
  }
  html.setAttribute('data-consent', choice);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function ConsentBanner({ privacyUrl }: { privacyUrl: string }) {
  const uid = useId();
  return (
    <section className={styles.banner} aria-labelledby={`${uid}-title`} data-consent-banner="">
      <div className={styles.bannerText}>
        <h2 id={`${uid}-title`} className={styles.bannerTitle}>
          Cookies on PressCompass
        </h2>
        <p>
          We and our advertising partners, including Google and Meta, would like to use cookies and similar technology to show and measure ads. Choose
          Accept all to allow this, or Necessary only to refuse it. You can change your choice at any time under Cookie settings at the bottom of
          every page.
          {privacyUrl && (
            <>
              {' '}
              <a href={privacyUrl}>Privacy policy</a>
            </>
          )}
        </p>
      </div>
      <div className={styles.bannerActions}>
        <button type="button" className={styles.choice} onClick={() => choose('necessary')}>
          Necessary only
        </button>
        <button type="button" className={styles.choice} onClick={() => choose('all')}>
          Accept all
        </button>
      </div>
    </section>
  );
}
