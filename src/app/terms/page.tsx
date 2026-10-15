import type { Metadata } from 'next'; import { InfoPage } from '@/components/info-page';
export const metadata: Metadata = { title: 'Terms of Service' };
export default function Page() { return <InfoPage title="Terms of Service" legal><p>This is placeholder text. It must cover acceptable use, employer responsibilities, listing moderation, liability limits and governing law.</p></InfoPage>; }
