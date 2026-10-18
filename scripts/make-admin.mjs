#!/usr/bin/env node
// Gives an existing CareerBridge account the admin role.   Usage: npm run make-admin -- you@example.com
// Admins can only be created this way (or with SQL), never from the website. The person must sign up and confirm their email first.
import { existsSync, readFileSync } from 'node:fs';
for (const f of ['.env.local', '.env']) if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) continue;
  let v = m[2]; if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}
const email = (process.argv[2] ?? '').trim().toLowerCase();
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const fail = (m) => { console.error(`\n✘ ${m}\n`); process.exit(1); };
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Give the email address of an existing account:  npm run make-admin -- you@example.com');
if (!url || !key) fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local. The service role key is in Supabase under Project Settings > API. Keep it secret and never put it in the browser or on GitHub.');
const h = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
const find = await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role,status`, { headers: h });
if (!find.ok) fail(`Could not look up the account (HTTP ${find.status}). Check the URL and service role key.`);
const rows = await find.json();
if (rows.length === 0) fail(`No account found for ${email}. Sign up on the website first, confirm the email, then run this again.`);
const [p] = rows;
if (p.status !== 'active') fail(`That account is ${p.status}, so it cannot be made an admin.`);
if (p.role === 'admin' || p.role === 'super_admin') { console.log(`\n✔ ${email} is already an admin. Sign in, then open /admin.\n`); process.exit(0); }
const upd = await fetch(`${url}/rest/v1/profiles?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, prefer: 'return=representation' }, body: JSON.stringify({ role: 'admin' }) });
const out = upd.ok ? await upd.json() : [];
if (out.length !== 1 || out[0].role !== 'admin') fail(`The change was not saved (HTTP ${upd.status}). Check the service role key.`);
console.log(`\n✔ ${email} is now an admin (it was: ${p.role}).\n  Sign in at /auth/login, then open /admin. You can also use the "Dashboard" button in the header.\n`);
