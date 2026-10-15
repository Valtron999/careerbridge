'use client';
import { useId } from 'react';
import { field } from '@/components/ui';

export function Input({ label, value, onChange, placeholder, type = 'text', maxLength = 200 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number }) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">{label}</label><input id={id} type={type} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={field} /></div>;
}
export function Area({ label, value, onChange, rows = 3, placeholder, maxLength = 1200, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number; hint?: string }) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">{label}</label><textarea id={id} value={value} rows={rows} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${field} py-2 leading-snug`} />{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>;
}
export const lines = (b: string[]) => b.join('\n');
export const toLines = (v: string) => v.split('\n').slice(0, 10);
export const csv = (a: string[]) => a.join(', ');
export const toCsv = (v: string) => v.split(',').map((s) => s.replace(/^\s+/, ''));

export function RowCard({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (<div className="rounded-lg border border-surface-line bg-surface-soft p-3"><div className="grid gap-3 sm:grid-cols-2">{children}</div>
    <button type="button" onClick={onRemove} className="mt-3 min-h-[36px] text-sm font-medium text-red-700 hover:underline" aria-label={`Remove ${label}`}>Remove</button></div>);
}
export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="min-h-[44px] rounded-[10px] border border-dashed border-slate-300 px-4 text-sm font-semibold text-brand hover:bg-brand-tint">+ {children}</button>;
}
