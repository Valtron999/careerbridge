'use client';
import { ActionForm } from './action-form';
import { Field } from './form-bits';
import { btn, field } from './ui';
import { removeAvatar, uploadAvatar } from '@/lib/files/actions';

export function AvatarUploader({ url, name }: { url: string | null; name: string }) {
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <section className="flex flex-wrap items-start gap-5 rounded-xl border border-surface-line p-5" aria-labelledby="photo-h">
      {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="Your profile photo" width={80} height={80} className="h-20 w-20 rounded-full object-cover" /> : <span aria-hidden className="grid h-20 w-20 place-items-center rounded-full bg-brand-tint text-xl font-bold text-brand">{initials}</span>}
      <div className="min-w-[240px] flex-1"><h2 id="photo-h" className="font-semibold">Profile photo</h2>
        <ActionForm action={uploadAvatar} buttons={[{ label: 'Upload photo' }]} className="mt-2 space-y-3">
          <Field name="file" label="Choose an image" hint="JPG, PNG or WebP, up to 2 MB. We resize it and remove location data from the file."><input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className={`${field} py-2.5`} /></Field>
        </ActionForm>
        {url && <form action={removeAvatar} className="mt-2"><button className={btn('ghost', '!min-h-[40px] !px-3 text-red-700')}>Remove photo</button></form>}</div>
    </section>
  );
}
