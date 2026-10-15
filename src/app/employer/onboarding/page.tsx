import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { Input, Textarea } from '@/components/form-bits';
import { createOrganisation } from '@/lib/employer/actions';

export const metadata: Metadata = { title: 'Set up your organisation', robots: { index: false } };
export default async function Onboarding() {
  const { userId } = await requireRole(['employer'], '/employer/onboarding');
  const { data } = await createClient().from('employer_memberships').select('employer_id').eq('user_id', userId).limit(1);
  if (data?.length) redirect('/employer');
  return (
    <div className="max-w-xl"><h1 className="text-3xl font-bold tracking-tight">Set up your organisation</h1>
      <p className="mt-2 text-ink-muted">Candidates see this information on your listings. Next you can ask us to verify the organisation; until then it is labelled as not yet verified.</p>
      <div className="mt-6"><ActionForm action={createOrganisation} buttons={[{ label: 'Create organisation' }]}>
        <Input name="name" label="Organisation name" required maxLength={120} />
        <Input name="industry" label="Industry" placeholder="e.g. Software, Banking, Education" />
        <Input name="location" label="Headquarters location" placeholder="City, State" />
        <Input name="website" label="Website" type="url" placeholder="https://" hint="Must start with https://" />
        <Textarea name="description" label="About the organisation" rows={5} />
        <Input name="public_email" label="Public contact email (optional)" type="email" hint="Shown publicly on your company page. Leave empty to keep it private." />
      </ActionForm></div></div>
  );
}
