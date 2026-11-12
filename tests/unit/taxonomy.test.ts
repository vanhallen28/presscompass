import { describe, expect, it } from 'vitest';
import { parseAuthor, parseSection, parseTag } from '@/modules/taxonomy/validate';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe('parseSection', () => {
  it('fills the address from the name and trims the text', () => {
    expect(parseSection(form({ name: '  Business & Economy ', slug: '', description: ' Money. ', in_nav: 'on' }))).toEqual({
      values: { name: 'Business & Economy', slug: 'business-and-economy', description: 'Money.', inNav: true },
      errors: {},
    });
    expect(parseSection(form({ name: 'Law', slug: 'law-and-courts', description: '' })).values).toMatchObject({ slug: 'law-and-courts', inNav: false });
  });

  it('explains what is wrong with each field', () => {
    expect(parseSection(form({ name: '', slug: 'Bad Slug', description: 'x'.repeat(301) })).errors).toEqual({
      name: 'Give the section a name.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      description: 'Keep the description under 300 characters.',
    });
    expect(parseSection(form({ name: 'Search', slug: '', description: '' })).errors).toEqual({
      slug: 'The site already uses /search. Choose another address.',
    });
  });
});

describe('parseTag', () => {
  it('accepts a tag and limits the name', () => {
    expect(parseTag(form({ name: 'El Niño', slug: '', description: '' }))).toEqual({
      values: { name: 'El Niño', slug: 'el-nino', description: '' },
      errors: {},
    });
    expect(parseTag(form({ name: 'x'.repeat(61), slug: 'x', description: '' })).errors).toEqual({ name: 'Keep the name under 60 characters.' });
  });
});

describe('parseAuthor', () => {
  it('collects the profile links that are filled in', () => {
    const result = parseAuthor(
      form({
        name: 'Rani Prameswari',
        slug: '',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        link_label_0: 'X',
        link_url_0: 'https://x.com/rani',
        link_label_1: '',
        link_url_1: '',
      }),
    );
    expect(result).toEqual({
      values: {
        name: 'Rani Prameswari',
        slug: 'rani-prameswari',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        links: [{ label: 'X', url: 'https://x.com/rani' }],
      },
      errors: {},
    });
  });

  it('refuses links that are not web addresses', () => {
    const result = parseAuthor(form({ name: 'Rani', slug: '', role: '', bio: '', link_label_0: 'Mail', link_url_0: 'javascript:alert(1)' }));
    expect(result.errors).toEqual({ links: 'Each link needs a label and an address that starts with https:// or http://.' });
  });
});
