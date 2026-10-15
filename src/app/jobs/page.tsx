import type { Metadata } from 'next';
import { Explorer } from '@/components/explorer';
export const metadata: Metadata = { title: 'Find jobs and opportunities', description: 'Search jobs, internships, graduate programmes and student placements.' };
export default function JobsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <Explorer basePath="/jobs" rawParams={searchParams} title="Find opportunities" intro="Jobs, internships, graduate programmes and student placements. Filters are saved in the address bar, so you can share or return to a search." />;
}
