import type { Metadata } from 'next'; import { InfoPage } from '@/components/info-page';
export const metadata: Metadata = { title: 'Coming soon' };
export default function Page() { return <InfoPage title="Coming soon"><p>This page is part of a later build phase and has no content yet.</p></InfoPage>; }
