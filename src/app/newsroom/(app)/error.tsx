'use client';

import { Button } from '@/components/ds/Button';
import { EmptyState } from '@/components/newsroom/ui';

// Shown when a Newsroom page cannot load, usually because Supabase cannot be reached.
export default function NewsroomError({ retry }: { error: Error; retry: () => void }) {
  return (
    <EmptyState icon="alert" title="This page could not load">
      <p>The Newsroom could not reach the database. Check your connection, then try again.</p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </EmptyState>
  );
}
