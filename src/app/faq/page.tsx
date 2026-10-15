import type { Metadata } from 'next'; import Link from 'next/link'; import { InfoPage } from '@/components/info-page';
export const metadata: Metadata = { title: 'FAQ' };
export default function Page() { return <InfoPage title="Frequently asked questions"><p>Common questions are answered on the <Link className="font-semibold text-brand" href="/#faq">home page</Link>.</p></InfoPage>; }
