// npm run check: reads .env and checks Supabase, the migrations, Cloudinary, and what content exists, then says
// what to fix. Changes nothing.
import { checkCloudinary, checkEnvValues, checkSupabase, contentCounts, readEnv } from './lib/setup.mjs';

const e = readEnv();
let problems = 0;
const print = (result) => {
  console.log(`${result.ok ? '  ✓' : '  ✗'} ${result.message}`);
  if (!result.ok) {
    problems += 1;
    console.log(`      → ${result.fix}`);
  }
};

console.log('\nPressCompass setup check\n\n.env');
for (const result of checkEnvValues(e)) print(result);

console.log('\nServices');
const supabase = await checkSupabase(e);
print(supabase);
print(await checkCloudinary(e));

if (supabase.ok) {
  const counts = await contentCounts(e);
  console.log('\nContent');
  print(
    counts.staff > 0
      ? { ok: true, message: `Newsroom users: ${counts.staff}` }
      : {
          ok: false,
          message: 'No Newsroom user yet.',
          fix: 'Create a user in Supabase (Authentication, Users), then run npm run staff:grant -- your@email.',
        },
  );
  print(
    counts.published > 0
      ? { ok: true, message: `Published articles: ${counts.published} (drafts: ${counts.drafts})` }
      : {
          ok: false,
          message: `No published articles (drafts: ${counts.drafts}). The front page shows "The first stories are on their way".`,
          fix: 'Run npm run content:starter, or publish an article in the Newsroom.',
        },
  );
  print(
    counts.pagesPublished > 0
      ? { ok: true, message: `Published pages: ${counts.pagesPublished} (drafts: ${counts.pagesDraft})` }
      : {
          ok: false,
          message: `No published pages (drafts: ${counts.pagesDraft}).`,
          fix: 'Run npm run content:starter -- --email <your contact address>, or publish them in the Newsroom, Pages.',
        },
  );
}

console.log(problems ? `\n${problems} thing(s) to fix.\n` : '\nEverything looks right.\n');
process.exit(problems && !supabase.ok ? 1 : 0);
