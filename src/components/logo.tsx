import Link from 'next/link';
import { brand } from '@/lib/config/brand';
export function LogoMark({ size = 30 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#315EFB" /><path d="M6 21c3-8 7-10 10-10s7 2 10 10" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><path d="M9 21v-3M16 21v-6M23 21v-3" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>);
}
export function Logo() {
  return (<Link href="/" className="flex items-center gap-2 text-[1.15rem] font-bold tracking-tight" aria-label={`${brand.name} home`}><LogoMark />{brand.name}</Link>);
}
