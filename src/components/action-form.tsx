'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/auth/actions';
import { btn } from './ui';

export type FormButton = { label: string; value?: string; variant?: 'primary' | 'secondary' };
function Buttons({ buttons }: { buttons: FormButton[] }) {
  const { pending } = useFormStatus();
  return (<div className="flex flex-wrap gap-3">{buttons.map((b) => (
    <button key={b.label} type="submit" name="intent" value={b.value ?? ''} disabled={pending} className={btn(b.variant ?? 'primary')}>{pending ? 'Please wait…' : b.label}</button>))}</div>);
}
/** Generic form shell: server-rendered fields go in as children; this adds pending state and an accessible error summary. */
export function ActionForm({ action, buttons, children, className }: { action: (s: FormState, f: FormData) => Promise<FormState>; buttons: FormButton[]; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useFormState(action, {} as FormState);
  const errs = Object.values(state.fieldErrors ?? {});
  return (
    <form action={formAction} className={className ?? 'space-y-5'}>
      {(state.error || errs.length > 0) && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {state.error && <p>{state.error}</p>}
          {errs.length > 0 && <ul className="list-disc pl-5">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>)}
      {state.message && <p role="status" className="rounded-lg bg-ok-tint p-3 text-sm text-ok">{state.message}</p>}
      {children}
      <Buttons buttons={buttons} />
    </form>
  );
}
