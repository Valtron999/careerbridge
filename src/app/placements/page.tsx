import type { Metadata } from 'next';
import { Explorer } from '@/components/explorer';
export const metadata: Metadata = { title: 'Student placements: SIWES, IT, SWEP and internships', description: 'Find SIWES, industrial training, SWEP and internship placements for Nigerian students.' };
export default function PlacementsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <Explorer basePath="/placements" rawParams={searchParams} kind="placement" title="Student placements"
    intro="SIWES, Industrial Training, SWEP and internships. Eligibility, duration and documents differ between schools and organisations, so read each listing's requirements carefully." />;
}
