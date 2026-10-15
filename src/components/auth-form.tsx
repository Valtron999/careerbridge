'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/auth/actions';
import { btn, field } from './ui';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={btn('primary', 'w-full')}>{pending ? 'Please wait…' : label}</button>;
}
export type FieldDef = { name: string; label: string; type?: string; autoComplete?: string; hint?: string };

export function AuthForm({ action, fields, submitLabel, hidden, children }: {
  action: (s: FormState, f: FormData) => Promise<FormState>; fields: FieldDef[]; submitLabel: string; hidden?: Record<string, string>; children?: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, {} as FormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-ok-tint p-3 text-sm text-ok">{state.message}</p>}
      {fields.map((f) => {
        const err = state.fieldErrors?.[f.name];
        return (
          <div key={f.name}>
            <label htmlFor={f.name} className="mb-1 block text-sm font-medium">{f.label}</label>
            <input id={f.name} name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} className={field}
              aria-invalid={Boolean(err)} aria-describedby={err ? `${f.name}-err` : f.hint ? `${f.name}-hint` : undefined} />
            {f.hint && !err && <p id={`${f.name}-hint`} className="mt-1 text-xs text-ink-muted">{f.hint}</p>}
            {err && <p id={`${f.name}-err`} className="mt-1 text-sm text-red-700">{err}</p>}
          </div>);
      })}
      {children}
      <Submit label={submitLabel} />
    </form>
  );
}
