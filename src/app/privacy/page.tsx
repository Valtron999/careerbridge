import type { Metadata } from 'next'; import { InfoPage } from '@/components/info-page';
export const metadata: Metadata = { title: 'Privacy Policy' };
export default function Page() { return <InfoPage title="Privacy Policy" legal><p>This is placeholder text. It must describe what personal data CareerBridge collects (account details, CVs, application records), why, who it is shared with (employers you apply to), how long it is kept, and how users can request access or deletion.</p></InfoPage>; }
