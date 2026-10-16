import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { as, tokenFor } from './helpers';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
const sources = files('src').map((f) => ({ f, text: readFileSync(f, 'utf8') }));

describe('queries written in the app match the real schema', () => {
  it('every .from(table).select(columns) in the source is accepted by PostgREST', async () => {
    const found: { f: string; table: string; cols: string }[] = [];
    for (const { f, text } of sources) for (const m of text.matchAll(/\.from\('(\w+)'\)\s*\.select\(\s*(['`])([\s\S]*?)\2/g)) if (!m[3]!.includes('${')) found.push({ f, table: m[1]!, cols: m[3]!.replace(/\s+/g, ' ') });
    expect(found.length).toBeGreaterThan(25);
    const bad: string[] = [];
    for (const { f, table, cols } of found) { const { error } = await as('adm').from(table).select(cols).limit(0); if (error) bad.push(`${f}: ${table}.select(${cols.slice(0, 80)}) -> ${error.message}`); }
    expect(bad).toEqual([]);
  });
  it('every .rpc(name, args) call uses a function and argument names that exist', async () => {
    const res = await fetch(`${process.env.CB_REST_URL}/rest/v1/`, { headers: { Authorization: `Bearer ${tokenFor('adm')}` } }); // as a signed-in user: most RPCs are deliberately not callable anonymously
    const api = await res.json() as { paths: Record<string, { post?: { parameters?: { schema?: { properties?: Record<string, unknown> } }[] } }> };
    const bad: string[] = []; let n = 0;
    for (const { f, text } of sources) for (const m of text.matchAll(/\.rpc\('(\w+)'(?:,\s*(\{[^}]*\}|\w+))?/g)) {
      n++; const def = api.paths[`/rpc/${m[1]}`]; if (!def) { bad.push(`${f}: rpc ${m[1]} does not exist`); continue; }
      const known = Object.keys(def.post?.parameters?.find((p) => p.schema?.properties)?.schema?.properties ?? {});
      const given = [...(m[2]?.startsWith('{') ? m[2].matchAll(/\b(p_\w+)\s*[:,}]/g) : [])].map((x) => x[1]!);
      for (const g of given) if (!known.includes(g)) bad.push(`${f}: rpc ${m[1]} has no argument ${g} (has ${known.join(', ')})`);
    }
    expect(n).toBeGreaterThan(8); expect(bad).toEqual([]);
  });
});

describe('write flows used by the server actions', () => {
  let app = ''; const direct = '' as string;
  it('apply: required answers enforced, then success, then duplicate blocked', async () => {
    const ids = (await import('./helpers')).ids; const opp = ids.opps['direct-job']!;
    const { data: qs } = await as('a').from('application_questions').select('id').eq('opportunity_id', opp);
    const q = qs![0]!.id;
    const missing = await as('a').rpc('submit_application', { p_opportunity_id: opp, p_cv_id: null, p_answers: [] });
    expect(missing.error?.message).toContain('missing_required_answer');
    const ok = await as('a').rpc('submit_application', { p_opportunity_id: opp, p_cv_id: null, p_answers: [{ question_id: q, answer: 'Because I want to learn.' }] });
    expect(ok.error).toBeNull(); expect(ok.data).toMatch(/^[0-9a-f-]{36}$/); app = ok.data as string;
    const dup = await as('a').rpc('submit_application', { p_opportunity_id: opp, p_cv_id: null, p_answers: [{ question_id: q, answer: 'again' }] });
    expect(dup.error?.message).toContain('duplicate_application');
    const ext = await as('b').rpc('submit_application', { p_opportunity_id: ids.opps['external-job'], p_cv_id: null, p_answers: [] });
    expect(ext.error?.message).toContain('not_a_direct_listing');
    const expired = await as('b').rpc('submit_application', { p_opportunity_id: ids.opps['expired-job'], p_cv_id: null, p_answers: [] });
    expect(expired.error?.message).toMatch(/deadline_passed/);
    const draft = await as('b').rpc('submit_application', { p_opportunity_id: ids.opps['draft-job'], p_cv_id: null, p_answers: [] });
    expect(draft.error?.message).toContain('listing_not_open');
  });
  it('attach documents: batch insert from the library works, foreign files do not', async () => {
    const a = as('a'); const uid = (await import('./helpers')).ids.users.a;
    const lib = await a.from('candidate_documents').insert({ user_id: uid, doc_type: 'school_letter', file_name: 'letter.pdf', storage_path: `${uid}/l.pdf`, size_bytes: 10 });
    expect(lib.error).toBeNull();
    const att = await a.from('application_documents').insert([{ application_id: app, doc_type: 'School letter', file_name: 'letter.pdf', storage_path: `${uid}/l.pdf` }]);
    expect(att.error).toBeNull();
    const foreign = await a.from('application_documents').insert([{ application_id: app, doc_type: 'x', file_name: 'x.pdf', storage_path: `${(await import('./helpers')).ids.users.b}/x.pdf` }]);
    expect(foreign.error).not.toBeNull();
    expect((await as('e1').from('application_documents').select('id')).data).toHaveLength(1);
    expect((await as('e2').from('application_documents').select('id')).data).toEqual([]);
  });
  it('employer shortlists, candidate is notified and can read history; non-member is refused', async () => {
    expect((await as('e2').rpc('set_application_status', { p_application_id: app, p_status: 'shortlisted', p_note: null })).error).not.toBeNull();
    expect((await as('a').rpc('set_application_status', { p_application_id: app, p_status: 'hired', p_note: null })).error).not.toBeNull();
    expect((await as('e1').rpc('set_application_status', { p_application_id: app, p_status: 'shortlisted', p_note: 'good fit' })).error).toBeNull();
    const n = await as('a').from('notifications').select('type').eq('type', 'application_status'); expect(n.data).toHaveLength(1);
    const h = await as('a').from('application_status_history').select('to_status').eq('application_id', app).order('created_at'); expect(h.data!.map((r) => r.to_status)).toEqual(['submitted', 'shortlisted']);
    expect((await as('b').from('application_status_history').select('id').eq('application_id', app)).data).toEqual([]);
  });
  it('interviews: employer can schedule and cancel, candidate can see', async () => {
    const sch = await as('e1').rpc('schedule_interview', { p_application_id: app, p_at: '2030-01-10T09:00:00Z', p_tz: 'Africa/Lagos', p_format: 'online', p_details: 'Link to follow' });
    expect(sch.error).toBeNull();
    const seen = await as('a').from('interviews').select('id, status').eq('application_id', app); expect(seen.data).toHaveLength(1);
    expect((await as('a').rpc('cancel_interview', { p_interview_id: seen.data![0]!.id })).error).not.toBeNull();
    expect((await as('e1').rpc('cancel_interview', { p_interview_id: seen.data![0]!.id })).error).toBeNull();
  });
  it('candidate can withdraw once, not twice', async () => {
    expect((await as('a').rpc('withdraw_application', { p_application_id: app })).error).toBeNull();
    expect((await as('a').rpc('withdraw_application', { p_application_id: app })).error?.message).toContain('application_closed');
  });
  it('CVs: default switching and versions', async () => {
    const a = as('a'); const uid = (await import('./helpers')).ids.users.a;
    const ins = await a.from('candidate_cvs').insert([{ user_id: uid, title: 'one', is_default: true, content: { x: 1 } }, { user_id: uid, title: 'two', is_default: false, content: {} }]).select('id, title');
    expect(ins.error).toBeNull(); const two = ins.data!.find((c) => c.title === 'two')!.id;
    expect((await a.rpc('set_default_cv', { p_id: two })).error).toBeNull();
    const defs = await a.from('candidate_cvs').select('title').eq('is_default', true); expect(defs.data).toEqual([{ title: 'two' }]);
    expect((await a.from('cv_versions').insert({ cv_id: two, label: 'v', content: {} })).error).toBeNull();
    expect((await as('b').rpc('set_default_cv', { p_id: two })).error?.message).toContain('not_found');
    expect((await as('b').from('candidate_cvs').select('id')).data).toEqual([]);
  });
  it('saved listings, external applications, reports', async () => {
    const ids = (await import('./helpers')).ids; const b = as('b'); const uid = ids.users.b; const opp = ids.opps['external-job']!;
    expect((await b.from('saved_opportunities').insert({ user_id: uid, opportunity_id: opp })).error).toBeNull();
    expect((await b.from('saved_opportunities').select('opportunity_id').eq('user_id', uid).eq('opportunity_id', opp).maybeSingle()).data).not.toBeNull();
    expect((await b.from('saved_opportunities').delete().eq('user_id', uid).eq('opportunity_id', opp)).error).toBeNull();
    // outbound click, then self-report, then another click must not downgrade the status
    await b.from('external_applications').upsert({ user_id: uid, opportunity_id: opp, state: 'clicked' }, { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true });
    await b.from('external_applications').upsert({ user_id: uid, opportunity_id: opp, state: 'self_reported_applied', applied_on: '2026-10-01' }, { onConflict: 'user_id,opportunity_id' });
    await b.from('external_applications').upsert({ user_id: uid, opportunity_id: opp, state: 'clicked' }, { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true });
    const row = await b.from('external_applications').select('state, applied_on').eq('opportunity_id', opp); expect(row.data).toEqual([{ state: 'self_reported_applied', applied_on: '2026-10-01' }]);
    expect((await as('a').from('external_applications').select('id')).data).toEqual([]);
    const r1 = await b.from('opportunity_reports').insert({ opportunity_id: opp, reporter_id: uid, reason: 'scam', details: null }); expect(r1.error).toBeNull();
    expect((await b.from('opportunity_reports').insert({ opportunity_id: opp, reporter_id: uid, reason: 'scam' })).error?.code).toBe('23505');
    expect((await b.from('opportunity_reports').insert({ opportunity_id: opp, reporter_id: ids.users.a, reason: 'scam' })).error).not.toBeNull();
  });
  it('profile saves: the exact upserts the editor performs', async () => {
    const b = as('b'); const uid = (await import('./helpers')).ids.users.b;
    expect((await b.from('profiles').update({ full_name: 'Bola Ade', phone: '+2348012345678' }).eq('id', uid)).error).toBeNull();
    const c = await b.from('candidate_profiles').upsert({ user_id: uid, headline: 'Student', location: 'Ibadan', summary: null, skills: ['SQL', 'Excel'], links: [{ label: 'GitHub', url: 'https://github.com/b' }], is_student: true, visibility: { contact_visible_to_employers: true }, preferences: { arrangements: ['remote'], interests: 'data' } }, { onConflict: 'user_id' });
    expect(c.error).toBeNull();
    const s = await b.from('student_profiles').upsert({ user_id: uid, institution: 'UI', course: 'Statistics', faculty: null, academic_level: '300 level', expected_graduation: '2027-07-01', siwes_eligible: true, required_duration_weeks: 24, preferred_locations: ['Lagos'] }, { onConflict: 'user_id' });
    expect(s.error).toBeNull();
    expect((await b.from('student_profiles').upsert({ user_id: uid, required_duration_weeks: 999 }, { onConflict: 'user_id' })).error).not.toBeNull();
    expect((await b.from('profiles').update({ role: 'admin' }).eq('id', uid)).error).not.toBeNull();
    expect((await b.from('profiles').update({ onboarding_completed: true }).eq('id', uid)).error).toBeNull();
  });
  it('notifications: only read_at is editable', async () => {
    const a = as('a'); const n = (await a.from('notifications').select('id').limit(1)).data![0]!;
    expect((await a.from('notifications').update({ title: 'hacked' }).eq('id', n.id)).error).not.toBeNull();
    expect((await a.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)).error).toBeNull();
  });
  it('skills upsert with ignoreDuplicates (listing editor) works for employers', async () => {
    const r = await as('e1').from('skills').upsert([{ name: 'SQL' }, { name: 'Brand New Skill' }], { onConflict: 'name', ignoreDuplicates: true }); expect(r.error).toBeNull();
  });
  it('verification: request with paths, pending guard, admin review, moderation', async () => {
    const ids = (await import('./helpers')).ids;
    const req = await as('e2').rpc('submit_verification_request', { p_employer_id: ids.orgs.org2, p_evidence: { website: 'https://kano.example' }, p_document_paths: [`${ids.orgs.org2}/cac.pdf`] });
    expect(req.error).toBeNull();
    expect((await as('e2').rpc('submit_verification_request', { p_employer_id: ids.orgs.org2, p_evidence: {}, p_document_paths: [] })).error?.message).toContain('request_pending');
    expect((await as('e1').rpc('review_verification', { p_request_id: req.data, p_decision: 'approve', p_note: null })).error).not.toBeNull();
    expect((await as('adm').rpc('review_verification', { p_request_id: req.data, p_decision: 'reject', p_note: null })).error?.message).toContain('note_required');
    expect((await as('adm').rpc('review_verification', { p_request_id: req.data, p_decision: 'approve', p_note: null })).error).toBeNull();
    expect((await as('anon').from('employers').select('verification_status').eq('id', ids.orgs.org2)).data).toEqual([{ verification_status: 'verified' }]);
    // moderation: employer submits a draft for review, admin approves, search finds it
    const draft = ids.opps['draft-job']!;
    expect((await as('e1').from('opportunities').update({ status: 'pending_review' }).eq('id', draft)).error).toBeNull();
    expect((await as('e1').rpc('moderate_opportunity', { p_id: draft, p_decision: 'approve', p_note: null })).error).not.toBeNull();
    expect((await as('adm').rpc('moderate_opportunity', { p_id: draft, p_decision: 'approve', p_note: null })).error).toBeNull();
    expect((await as('anon').from('opportunities').select('status').eq('id', draft)).data).toEqual([{ status: 'published' }]);
    const logs = await as('adm').from('audit_logs').select('action').in('action', ['listing.approve', 'verification.approve']); expect(logs.data!.length).toBeGreaterThanOrEqual(2);
    expect((await as('e1').from('audit_logs').select('id')).data).toEqual([]);
  });
  it('search index follows edits: renaming an employer and adding a skill update results', async () => {
    const ids = (await import('./helpers')).ids; const { searchOpportunities } = await import('../../src/lib/data/opportunities'); const { searchSchema } = await import('../../src/lib/validation/search');
    const find = async (q: string) => (await searchOpportunities(searchSchema.parse({ q }), undefined, as('anon'))).items.map((i) => i.slug);
    expect(await find('kano')).toContain('swe-placement');
    expect((await as('e2').from('employers').update({ name: 'Arewa Digital' }).eq('id', ids.orgs.org2)).error).toBeNull();
    expect(await find('kano')).toEqual([]); expect(await find('arewa')).toContain('swe-placement');
    const sk = (await as('e1').from('skills').select('id').eq('name', 'Brand New Skill').single()).data!.id;
    expect((await as('e1').from('opportunity_skills').insert({ opportunity_id: ids.opps['remote-support'], skill_id: sk })).error).toBeNull();
    expect(await find('brand new')).toEqual(['remote-support']);
    expect((await as('e1').from('opportunity_skills').delete().eq('opportunity_id', ids.opps['remote-support']).eq('skill_id', sk)).error).toBeNull();
    expect(await find('brand new')).toEqual([]);
  });
});

describe('cover letter flows', () => {
  it('create, save, duplicate, privacy and limits behave as the actions expect', async () => {
    const { ids } = await import('./helpers'); const a = as('a'), b = as('b');
    const cv = (await a.from('candidate_cvs').select('id').limit(1)).data![0]!.id; const opp = ids.opps['direct-job']!;
    const created = await a.from('cover_letters').insert({ user_id: ids.users.a, opportunity_id: opp, cv_id: cv, title: 'Cover letter: Direct Apply Job', body: 'Dear Hiring Manager,\n\nSincerely,\nAda', tone: 'professional' }).select('id').single();
    expect(created.error).toBeNull(); const id = created.data!.id;
    const saved = await a.from('cover_letters').update({ title: 'Edited', body: 'Dear X,\n\nPara.', tone: 'enthusiastic', cv_id: cv, job_context: { title: 'T', employer: 'E', description: 'D' } }).eq('id', id).eq('user_id', ids.users.a).select('id').maybeSingle();
    expect(saved.error).toBeNull(); expect(saved.data?.id).toBe(id);
    const src = (await a.from('cover_letters').select('title, body, tone, cv_id, opportunity_id, job_context').eq('id', id).single()).data!;
    expect((await a.from('cover_letters').insert({ ...src, user_id: ids.users.a, title: `${src.title} (copy)` }).select('id').single()).error).toBeNull();
    const list = await a.from('cover_letters').select('id, title, tone, updated_at, opportunity:opportunities(title, employer:employers(name))').eq('user_id', ids.users.a); expect(list.data!.length).toBe(2);
    expect((await b.from('cover_letters').select('id')).data).toEqual([]);
    expect((await b.from('cover_letters').update({ title: 'x' }).eq('id', id).select('id')).data).toEqual([]);
    expect((await a.from('cover_letters').update({ body: 'x'.repeat(8001) }).eq('id', id)).error).not.toBeNull();
    expect((await a.from('cover_letters').update({ tone: 'angry' }).eq('id', id)).error).not.toBeNull();
    const bCv = (await b.from('candidate_cvs').insert({ user_id: ids.users.b, title: 'b cv', is_default: false, content: {} }).select('id').single()).data!.id;
    expect((await a.from('cover_letters').update({ cv_id: bCv }).eq('id', id)).error).not.toBeNull();
    expect((await a.from('cover_letters').delete().eq('id', id)).error).toBeNull();
  });
});
