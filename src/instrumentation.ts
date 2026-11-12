export async function register() {
  // Only on Vercel, only in the Node.js server runtime, never during `next build`.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.VERCEL_ENV) return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertEnvironment } = await import('@/lib/environment-guard');
  await assertEnvironment();
}
