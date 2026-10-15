import type { Metadata } from 'next';
import { requireOrg, canManage } from '@/lib/employer/context';
import { ActionForm } from '@/components/action-form';
import { Input, Textarea } from '@/components/form-bits';
import { updateOrganisation } from '@/lib/employer/actions';

export const metadata: Metadata = { title: 'Company profile', robots: { index: false } };
export default async function Company() {
  const { org, role } = await requireOrg('/employer/company');
  if (!canManage(role)) return <p className="text-ink-muted">Only owners and admins can edit the company profile.</p>;
  return (
    <div className="max-w-xl"><h1 className="text-3xl font-bold tracking-tight">Company profile</h1>
      <p className="mt-2 text-sm text-ink-muted">Public page: <a className="font-semibold text-brand" href={`/companies/${org.slug}`}>/companies/{org.slug}</a></p>
      <div className="mt-6"><ActionForm action={updateOrganisation} buttons={[{ label: 'Save changes' }]}>
        <Input name="name" label="Organisation name" defaultValue={org.name} required />
        <Input name="industry" label="Industry" defaultValue={org.industry} />
        <Input name="location" label="Headquarters location" defaultValue={org.location} />
        <Input name="website" label="Website" type="url" defaultValue={org.website} hint="Must start with https://" />
        <Textarea name="description" label="About the organisation" rows={5} defaultValue={org.description} />
        <Input name="public_email" label="Public contact email" type="email" defaultValue={org.public_email} />
        <Input name="public_phone" label="Public phone" defaultValue={org.public_phone} />
      </ActionForm></div></div>
  );
}
