import { ActionForm } from './action-form';
import { Select, Textarea } from './form-bits';
import type { FormState } from '@/lib/auth/actions';

export function ReviewForm({ id, action, decisions }: { id: string; action: (s: FormState, f: FormData) => Promise<FormState>; decisions: [string, string][] }) {
  return (
    <ActionForm action={action} buttons={[{ label: 'Save decision' }]} className="mt-4 space-y-3 border-t border-surface-line pt-4">
      <input type="hidden" name="id" value={id} />
      <Select name="decision" label="Decision" placeholder="Choose…" options={decisions} />
      <Textarea name="note" label="Note to the employer" rows={2} hint="Required for anything other than approval." />
    </ActionForm>
  );
}
