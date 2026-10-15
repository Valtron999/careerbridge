import { ActionForm } from './action-form';
import { Card, Input, Select, Textarea, Field } from './form-bits';
import { saveOpportunity } from '@/lib/employer/actions';

type Cat = { id: string; name: string; kind: string };
export type OppValues = Record<string, unknown> & { id?: string };
const v = (o: OppValues | undefined, k: string) => (o?.[k] as string | number | null | undefined) ?? '';
const arr = (o: OppValues | undefined, k: string) => ((o?.[k] as string[] | undefined) ?? []).join(', ');

export function OpportunityForm({ o, categories, skills, questions, locked }: { o?: OppValues; categories: Cat[]; skills: string[]; questions: string; locked: boolean }) {
  const deadline = o?.deadline ? new Date(o.deadline as string).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }) : '';
  return (
    <ActionForm action={saveOpportunity} buttons={[{ label: 'Save', value: 'save', variant: 'secondary' }, { label: 'Submit for review', value: 'submit' }]} className="space-y-6">
      {o?.id && <input type="hidden" name="id" value={o.id as string} />}
      <Card title="Basics">
        <div className="space-y-4">
          <Input name="title" label="Title" required defaultValue={v(o, 'title')} maxLength={160} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="kind" label="Opportunity kind" defaultValue={v(o, 'kind') || 'job'} options={[['job', 'Job'], ['placement', 'Student placement']]} />
            <Select name="category_id" label="Category" defaultValue={v(o, 'category_id')} placeholder="Select a category" options={categories.map((c) => [c.id, `${c.name} (${c.kind})`])} />
            <Select name="employment_type" label="Employment type" defaultValue={v(o, 'employment_type')} placeholder="Not specified" options={[['full_time', 'Full-time'], ['part_time', 'Part-time'], ['contract', 'Contract'], ['internship', 'Internship'], ['apprenticeship', 'Apprenticeship'], ['volunteer', 'Volunteer'], ['temporary', 'Temporary']]} />
            <Select name="experience_level" label="Experience level" defaultValue={v(o, 'experience_level')} placeholder="Not specified" options={[['none', 'No experience needed'], ['entry', 'Entry level'], ['mid', 'Mid level'], ['senior', 'Senior'], ['lead', 'Lead']]} />
          </div>
          <Textarea name="description" label="Description" rows={7} required defaultValue={v(o, 'description')} hint="At least 30 characters." />
          <Textarea name="responsibilities" label="Responsibilities" defaultValue={v(o, 'responsibilities')} />
          <Textarea name="requirements" label="Requirements" defaultValue={v(o, 'requirements')} />
          <Textarea name="qualifications" label="Qualifications" rows={3} defaultValue={v(o, 'qualifications')} />
          <Textarea name="benefits" label="Benefits" rows={3} defaultValue={v(o, 'benefits')} />
          <Input name="skills" label="Skills" defaultValue={skills.join(', ')} hint="Comma-separated." />
        </div>
      </Card>
      <Card title="Location and pay">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="work_arrangement" label="Work arrangement" defaultValue={v(o, 'work_arrangement') || 'onsite'} options={[['onsite', 'Onsite'], ['hybrid', 'Hybrid'], ['remote', 'Remote']]} />
          <Input name="location_country" label="Country" defaultValue={v(o, 'location_country') || 'Nigeria'} />
          <Input name="location_state" label="State / region" defaultValue={v(o, 'location_state')} />
          <Input name="location_city" label="City" defaultValue={v(o, 'location_city')} />
          <Input name="salary_min" label="Minimum pay (per month)" type="number" min={0} defaultValue={v(o, 'salary_min')} hint="Leave empty if you do not want to state it." />
          <Input name="salary_max" label="Maximum pay (per month)" type="number" min={0} defaultValue={v(o, 'salary_max')} />
          <Select name="salary_currency" label="Currency" defaultValue={v(o, 'salary_currency') || 'NGN'} options={[['NGN', 'Naira (NGN)'], ['USD', 'US dollar'], ['GBP', 'Pound'], ['EUR', 'Euro']]} />
          <Input name="compensation_note" label="Pay note" defaultValue={v(o, 'compensation_note')} placeholder="e.g. Transport allowance included" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="is_unpaid" defaultChecked={Boolean(o?.is_unpaid)} className="h-5 w-5" /> This placement is unpaid (shown clearly to candidates)</label>
      </Card>
      <Card title="Student placement details (optional)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="placement_duration_weeks" label="Duration (weeks)" type="number" min={1} max={104} defaultValue={v(o, 'placement_duration_weeks')} />
          <Input name="start_date" label="Start date" type="date" defaultValue={v(o, 'start_date')} />
          <Input name="positions_available" label="Positions available" type="number" min={1} defaultValue={v(o, 'positions_available')} />
          <Input name="education_level" label="Required academic level" defaultValue={v(o, 'education_level')} placeholder="e.g. 300 level, ND II" />
        </div>
        <div className="mt-4 space-y-4">
          <Input name="eligible_courses" label="Eligible courses" defaultValue={arr(o, 'eligible_courses')} hint="Comma-separated. Leave empty if open to all." />
          <Input name="eligible_institutions" label="Eligible institutions" defaultValue={arr(o, 'eligible_institutions')} hint="Only if restricted." />
          <Input name="required_documents" label="Documents the student should have" defaultValue={arr(o, 'required_documents')} hint="e.g. SIWES introduction letter, acceptance letter. File upload is not available yet." />
        </div>
      </Card>
      <Card title="How to apply">
        <div className="space-y-4">
          <Select name="application_method" label="Application method" defaultValue={v(o, 'application_method') || 'direct'} options={[['direct', 'Apply on CareerBridge'], ['external', 'External link or email']]} />
          <Input name="deadline" label="Application deadline" type="date" defaultValue={deadline} hint="Applications close at the end of this day (Nigeria time)." />
          <Input name="external_url" label="External application link" type="url" placeholder="https://" defaultValue={v(o, 'external_url')} hint="Only used for external applications. Must start with https://" />
          <Input name="external_email" label="Application email" type="email" defaultValue={v(o, 'external_email')} />
          <Textarea name="application_instructions" label="Instructions for applicants" rows={3} defaultValue={v(o, 'application_instructions')} />
          {locked ? <Field name="questions" label="Application questions"><p className="rounded-lg bg-surface-soft p-3 text-sm text-ink-muted">Questions are locked because applications have been received. <input type="hidden" name="questions" value={questions} /></p></Field>
            : <Textarea name="questions" label="Application questions (direct applications)" rows={4} defaultValue={questions} hint="One per line: question | type | required. Types: short, long, yes_no, date, number. Example: Why do you want this role? | long | required" />}
        </div>
      </Card>
    </ActionForm>
  );
}
