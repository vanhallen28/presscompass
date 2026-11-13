// How an image credit reads under a picture. Credits usually hold just the name ("Reuters"), shown as
// "Photo: Reuters". A credit that already says what it is ("Illustration: PressCompass") is shown as typed.

const LABELLED = /^(photo|photograph|illustration|image|graphic|chart|map|video|screenshot)s?(\s+by)?\s*:/i;

export function creditLine(credit: string): string {
  const text = credit.trim();
  if (!text) return '';
  return LABELLED.test(text) ? text : `Photo: ${text}`;
}
