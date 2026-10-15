import { field } from './ui';
type Common = { name: string; label: string; hint?: string; defaultValue?: string | number | null; required?: boolean };
export function Field({ name, label, hint, children }: { name: string; label: string; hint?: string; children: React.ReactNode }) {
  return (<div><label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>{children}{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</div>);
}
export function Input({ name, label, hint, defaultValue, required, type = 'text', ...rest }: Common & { type?: string; placeholder?: string; maxLength?: number; min?: number; max?: number }) {
  return <Field name={name} label={label} hint={hint}><input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} className={field} {...rest} /></Field>;
}
export function Textarea({ name, label, hint, defaultValue, required, rows = 4 }: Common & { rows?: number }) {
  return <Field name={name} label={label} hint={hint}><textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ''} required={required} className={`${field} py-2`} /></Field>;
}
export function Select({ name, label, hint, defaultValue, options, placeholder }: Common & { options: [string, string][]; placeholder?: string }) {
  return (<Field name={name} label={label} hint={hint}><select id={name} name={name} defaultValue={defaultValue ?? ''} className={field}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>);
}
export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-surface-line p-5">{title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}{children}</section>;
}
