import { jsonLdText } from '@/modules/seo/jsonld';

// Structured data for search engines. A data block, so React neither runs it nor warns about it on the client.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
