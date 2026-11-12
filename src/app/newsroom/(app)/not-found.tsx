import { ButtonLink } from '@/components/ds/Button';
import { EmptyState } from '@/components/newsroom/ui';

export default function NewsroomNotFound() {
  return (
    <EmptyState icon="search" title="Not found">
      <p>This item does not exist any more, or the link is incomplete.</p>
      <ButtonLink href="/newsroom" variant="primary">
        Back to the Dashboard
      </ButtonLink>
    </EmptyState>
  );
}
