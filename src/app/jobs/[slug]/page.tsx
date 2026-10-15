import type { Metadata } from 'next';
import { OpportunityDetail } from '@/components/opportunity-detail';
import { getOpportunity } from '@/lib/data/opportunities';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const o = await getOpportunity(params.slug);
  if (!o) return { title: 'Opportunity not found' };
  const title = `${o.title}${o.employer ? ` at ${o.employer.name}` : ''}`;
  return { title, description: o.description.slice(0, 155), alternates: { canonical: `/jobs/${o.slug}` }, openGraph: { title, description: o.description.slice(0, 155), type: 'article' } };
}
export default function Page({ params }: { params: { slug: string } }) {
  return <OpportunityDetail slug={params.slug} path={`/jobs/${params.slug}`} />;
}
