'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveProfile } from '@/lib/profile/actions';
import type { FormState } from '@/lib/auth/actions';
import type { ProfileBundle } from '@/lib/profile/data';
import { ACADEMIC_LEVELS, ARRANGEMENTS } from '@/lib/validation/profile';
import { btn, field } from './ui';

export type Section = 'basics' | 'student' | 'interests';
function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className={btn('primary')}>{pending ? 'Saving…' : label}</button>; }

export function ProfileForm({ data, sections, submitLabel = 'Save profile', next, finish, skipHref, backHref }: { data: ProfileBundle; sections: Section[]; submitLabel?: string; next?: string; finish?: boolean; skipHref?: string; backHref?: string }) {
  const [state, action] = useFormState(saveProfile, {} as FormState);
  const [isStudent, setIsStudent] = useState(Boolean(data.is_student));
  const fe = state.fieldErrors ?? {};
  const F = ({ name, label, defaultValue, type = 'text', placeholder, hint, max = 200, inputMode }: { name: string; label: string; defaultValue?: string | null; type?: string; placeholder?: string; hint?: string; max?: number; inputMode?: 'tel' | 'numeric' }) => (
    <div><label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} maxLength={max} inputMode={inputMode} className={field} aria-invalid={Boolean(fe[name])} aria-describedby={fe[name] ? `${name}-e` : hint ? `${name}-h` : undefined} />
      {hint && !fe[name] && <p id={`${name}-h`} className="mt-1 text-xs text-ink-muted">{hint}</p>}{fe[name] && <p id={`${name}-e`} className="mt-1 text-sm text-red-700">{fe[name]}</p>}</div>);
  const show = (s: Section) => sections.includes(s);
  const studentVisible = show('student') && (show('basics') ? isStudent : true);

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="sections" value={sections.filter((s) => s !== 'student' || studentVisible).join(',')} />
      {!show('basics') && <input type="hidden" name="student_flag" value={data.is_student ? '1' : '0'} />}
      {next && <input type="hidden" name="next" value={next} />}{finish && <input type="hidden" name="finish" value="1" />}
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg bg-ok-tint p-3 text-sm text-ok">{state.message}</p>}

      {show('basics') && <fieldset className="space-y-4"><legend className="mb-1 text-lg font-semibold">About you</legend>
        <div className="grid gap-4 sm:grid-cols-2"><F name="full_name" label="Full name" defaultValue={data.full_name} /><F name="phone" label="Phone (optional)" type="tel" inputMode="tel" defaultValue={data.phone} placeholder="+234…" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><F name="headline" label="Headline" defaultValue={data.headline} max={160} placeholder="e.g. Computer Science student" /><F name="location" label="Where are you based?" defaultValue={data.location} placeholder="City, state" max={120} /></div>
        <div><label htmlFor="summary" className="mb-1 block text-sm font-medium">Short summary (optional)</label><textarea id="summary" name="summary" rows={4} maxLength={1200} defaultValue={data.summary ?? ''} className={`${field} py-2`} aria-describedby="summary-h" />
          <p id="summary-h" className="mt-1 text-xs text-ink-muted">2 to 4 sentences. This pre-fills your CV, and you can edit it there.</p>{fe.summary && <p className="mt-1 text-sm text-red-700">{fe.summary}</p>}</div>
        <label className="flex min-h-[44px] items-start gap-3"><input type="checkbox" name="is_student" checked={isStudent} onChange={(e) => setIsStudent(e.target.checked)} className="mt-1 h-5 w-5" /><span><b>I am currently a student</b><br /><span className="text-sm text-ink-muted">Shows student placement details below and helps match SIWES, IT and SWEP listings.</span></span></label>
        <div className="space-y-3"><p className="text-sm font-medium">Links (optional)</p>
          {[1, 2, 3].map((n) => <div key={n} className="grid gap-3 sm:grid-cols-[1fr_2fr]"><F name={`link_label_${n}`} label={`Link ${n} label`} defaultValue={data.link_rows[n - 1]?.label} max={40} placeholder="LinkedIn" /><F name={`link_url_${n}`} label={`Link ${n} address`} defaultValue={data.link_rows[n - 1]?.url} max={300} placeholder="linkedin.com/in/you" /></div>)}</div>
        <label className="flex min-h-[44px] items-start gap-3"><input type="checkbox" name="contact_visible" defaultChecked={data.contact_visible} className="mt-1 h-5 w-5" /><span><b>Share my email and phone with employers I apply to</b><br /><span className="text-sm text-ink-muted">Off by default. Your contact details are never shown publicly.</span></span></label>
      </fieldset>}

      {studentVisible && <fieldset className="space-y-4"><legend className="mb-1 text-lg font-semibold">Student details</legend>
        <div className="grid gap-4 sm:grid-cols-2"><F name="institution" label="Institution" defaultValue={data.institution} max={160} /><F name="course" label="Course of study" defaultValue={data.course} max={160} /><F name="faculty" label="Department or faculty (optional)" defaultValue={data.faculty} max={160} />
          <div><label htmlFor="academic_level" className="mb-1 block text-sm font-medium">Current level</label><select id="academic_level" name="academic_level" defaultValue={data.academic_level ?? ''} className={field}><option value="">Select</option>{ACADEMIC_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>{fe.academic_level && <p className="mt-1 text-sm text-red-700">{fe.academic_level}</p>}</div>
          <F name="expected_graduation" label="Expected graduation" type="date" defaultValue={data.expected_graduation} />
          <F name="required_duration_weeks" label="Placement length your school requires (weeks)" defaultValue={data.required_duration_weeks} inputMode="numeric" hint="Check your school's SIWES or IT requirement. Leave blank if unsure." /></div>
        <div><label htmlFor="siwes_eligible" className="mb-1 block text-sm font-medium">Is a SIWES or IT placement part of your course?</label><select id="siwes_eligible" name="siwes_eligible" defaultValue={data.siwes_eligible} className={field}><option value="">Prefer not to say</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure yet</option></select></div>
        <F name="preferred_locations" label="Preferred placement locations (comma separated)" defaultValue={data.preferred_locations.join(', ')} max={400} placeholder="Lagos, Abuja, Remote" />
        <p className="text-xs text-ink-muted">Eligibility and documentation rules differ between schools and organisations. CareerBridge cannot confirm school approval.</p></fieldset>}

      {show('interests') && <fieldset className="space-y-4"><legend className="mb-1 text-lg font-semibold">Skills and preferences</legend>
        <F name="skills" label="Skills (comma separated)" defaultValue={(data.skills ?? []).join(', ')} max={1500} placeholder="Excel, Python, customer service" hint="Add real skills only. They pre-fill your CV and improve suggestions." />{fe.skills && <p className="text-sm text-red-700">{fe.skills}</p>}
        <fieldset><legend className="mb-2 text-sm font-medium">Work arrangements you would consider</legend><div className="flex flex-wrap gap-2">{ARRANGEMENTS.map((a) => <label key={a} className="cursor-pointer"><input type="checkbox" name="arrangements" value={a} defaultChecked={data.arrangements?.includes(a)} className="peer sr-only" /><span className="inline-block min-h-[44px] rounded-full border border-surface-line px-4 py-2.5 text-sm font-medium capitalize peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand">{a}</span></label>)}</div></fieldset>
        <div><label htmlFor="interests" className="mb-1 block text-sm font-medium">Roles or areas that interest you (optional)</label><textarea id="interests" name="interests" rows={3} maxLength={600} defaultValue={data.interests} className={`${field} py-2`} /></div></fieldset>}

      <div className="flex flex-wrap items-center gap-4">
        {backHref && <Link href={backHref} className={btn('secondary')}>Back</Link>}<Submit label={submitLabel} />
        {skipHref && <Link href={skipHref} className="text-sm font-medium text-ink-muted hover:text-ink">Skip this step</Link>}
      </div>
    </form>
  );
}
