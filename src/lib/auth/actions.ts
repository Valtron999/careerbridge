'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { brand } from '@/lib/config/brand';
import { forgotSchema, loginSchema, signupSchema, updatePasswordSchema } from '@/lib/validation/auth';
import { safeNextPath } from '@/lib/validation/safe-url';
import { destinationAfterLogin, type Role } from './redirect';

export type FormState = { error?: string; fieldErrors?: Record<string, string>; message?: string };
const NOT_CONFIGURED: FormState = { error: 'The service is not configured yet. Add the Supabase environment variables (see README).' };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) { const k = String(i.path[0] ?? ''); if (k && !out[k]) out[k] = i.message; }
  return out;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const { email, password, full_name, account_type } = parsed.data;
  const supabase = createClient();
  // account_type is only a *request*; the database trigger accepts candidate/employer and nothing else.
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, account_type }, emailRedirectTo: `${brand.siteUrl}/auth/callback?next=${account_type === 'employer' ? '/employer/onboarding' : '/dashboard/onboarding'}` } });
  if (error) {
    if (/rate/i.test(error.message)) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
    return { error: 'We could not create your account. Check your details and try again.' };
  }
  // Same response whether or not the email already exists (no account enumeration).
  return { message: 'Check your email for a verification link to finish creating your account.' };
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes('not confirmed')) return { error: 'Verify your email first. Check your inbox for the link.' };
    return { error: 'Incorrect email or password.' };
  }
  const { data: profile } = await supabase.from('profiles').select('status, role').eq('id', data.user.id).single();
  if (profile?.status === 'suspended') { await supabase.auth.signOut(); return { error: 'This account has been suspended. Contact support if you think this is a mistake.' }; }
  const wanted = safeNextPath(String(form.get('next') ?? ''), '');
  redirect(destinationAfterLogin(wanted || null, (profile?.role ?? 'candidate') as Role)); // an employer never lands on the candidate dashboard, and nobody is sent into an area their role cannot open
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  await createClient().auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${brand.siteUrl}/auth/callback?next=/auth/update-password` });
  return { message: 'If an account exists for that email, a reset link is on its way.' };
}

export async function signOut() {
  if (supabaseConfigured()) await createClient().auth.signOut();
  redirect('/');
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one from the sign-in page.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return { fieldErrors: { password: 'Choose a password you have not used before' } };
    if (error.code === 'weak_password') return { fieldErrors: { password: 'That password is too easy to guess. Try a longer one.' } };
    return { error: 'We could not update your password. Please try again.' };
  }
  await supabase.auth.signOut({ scope: 'global' }); // end every session, including any an attacker may hold
  redirect('/auth/login?notice=password-updated');
}
