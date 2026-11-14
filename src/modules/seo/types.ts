// Shared shapes of the SEO and readability analysis (src/modules/seo/analysis.ts).

export type Rating = 'good' | 'ok' | 'bad';

/** One line of the analysis: a traffic light and what to do about it. */
export type Check = { id: string; rating: Rating; text: string; details?: string[] };

export type Assessment = { score: number; rating: Rating; checks: Check[] };

export type Scores = { seo: number; readability: number };

export const RATING_LABELS: Record<Rating, string> = { good: 'Good', ok: 'OK', bad: 'Needs work' };

/** Points per light (stricter than Yoast's 9, 6, 3, so a few red lights keep an article from Good): the score is
 * the share of the best possible total. */
const POINTS: Record<Rating, number> = { good: 9, ok: 5, bad: 0 };

export function assess(checks: Check[]): Assessment {
  if (!checks.length) return { score: 0, rating: 'bad', checks };
  const score = Math.round((checks.reduce((sum, check) => sum + POINTS[check.rating], 0) / (checks.length * POINTS.good)) * 100);
  return { score, rating: ratingFor(score), checks };
}

export function ratingFor(score: number): Rating {
  return score >= 75 ? 'good' : score >= 45 ? 'ok' : 'bad';
}
