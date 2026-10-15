import type { Metadata } from 'next'; import { InfoPage } from '@/components/info-page';
export const metadata: Metadata = { title: 'About' };
export default function Page() { return <InfoPage title="About CareerBridge"><p>CareerBridge connects students, graduates and professionals with employers, with a dedicated focus on SIWES, SWEP, internships and other student placements in Nigeria.</p><p>We publish only opportunities that employers submit, and label what has and has not been verified.</p></InfoPage>; }
