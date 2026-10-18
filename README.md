# CareerBridge

Jobs, student placements (SIWES, IT, SWEP, internships), applications and recruitment on Next.js 14 (App Router) + Supabase.

## Status
Built and verified so far (see `docs/STATUS.md` for the detail): foundation, auth, database + RLS + transactional RPCs, public marketplace,
direct/external application flow, candidate dashboard basics, employer workspace and admin moderation screens.
CV builder with live preview, three templates, section reordering, versions, default CV, PDF export and optional Gemini AI help (summary, bullet polish, skill finder, gap questions, tailor-to-job as a new copy).
Also done: a student-first landing page (SIWES, internships and CV builder lead; jobs stay one click away), cover letters (general or per listing, tone choice, per-paragraph rewrite, copy and PDF), search by employer, skills and course, file uploads (profile photo, document library, application attachments, employer verification evidence), password reset + update page, candidate profile and student-details editor, 3-step candidate onboarding (resumable), profile completeness.
**Not built yet:** career assistant chat, email sending,
payments/subscriptions, team management, user/category admin screens, employer marketing + pricing pages, company-profile polish.

## Setup
```bash
npm install
cp .env.example .env.local        # fill in Supabase values
npm run dev
```
0. (Optional AI) Get a free Gemini key at https://aistudio.google.com/apikey, then set `AI_PROVIDER=gemini`, `AI_API_KEY=...`, `AI_MODEL=<a current free-tier model>`. Without these the AI buttons show a clear "not set up" message and the rest of the builder works.
1. Create a Supabase project. Put the URL and anon key in `.env.local`; put the service-role key in `SUPABASE_SERVICE_ROLE_KEY` (server only).
2. Apply **all** migrations in order, `supabase/migrations/0001` to `0009` (`supabase db push`, or paste each into the SQL editor). The app will not work with only some of them:
   - 0001 schema, 0002 security rules and application functions, 0003 reference data, 0004 employer and admin functions,
   - 0005 default-CV function, 0006 file upload rules, 0007 search (employer, skills, courses), 0008 cover letters, 0009 entry-level search.
3. Auth > URL configuration: set Site URL and add `<site>/auth/callback` as a redirect URL. Keep "Confirm email" ON.
4. Make the first admin by SQL (admins can never be created from the app): `update profiles set role='admin' where email='you@example.com';`
5. Deploy: import the repo in Vercel, add the same environment variables, deploy.

## Environment variables
Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Server only: `SUPABASE_SERVICE_ROLE_KEY`, `AI_*`, `EMAIL_*`, `PAYSTACK_*`, `CRON_SECRET`. The last four groups are placeholders for later phases.

## Tests
```bash
# Integration: real Postgres + real migrations + real PostgREST, running the app's own queries (needs a PostgREST binary)
curl -L -o pgrst.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar -xJf pgrst.tar.xz -C /tmp/pgrst
python3 tests/integration/run.py
```
```bash
npm run typecheck && npm run lint && npm test && npm run build
pip install pgserver psycopg2-binary && python3 tests/rls_harness.py   # applies the real migrations to an embedded Postgres
```
The RLS harness uses stubs for Supabase's `auth` and `storage` schemas. Run the policies against a real Supabase project before launch.

## Security model
- Roles live in `profiles.role`. The signup trigger only ever assigns `candidate` or `employer`; a DB trigger blocks role/status changes by non-admins.
- Applications are created and moved between statuses only through `SECURITY DEFINER` functions that check ownership, deadline and duplicates.
- Employer internal notes and candidate CVs have no policy for anyone but their owners/employer members.
- The service-role client (`src/lib/supabase/admin.ts`) is server-only.
- External apply links must be `https://`; `/go/[slug]` redirects only to the URL stored in the database.

## Known limitations
- Search covers title, description, location, employer name, category, skills and eligible courses, with prefix matching and best-match ranking. Words are matched as prefixes, so "engineer" also finds "Engineering".
- Required application documents are listed to applicants but cannot be uploaded yet.
- Legal pages are placeholder text and need professional review.
- Landing-page scroll-reveal animations from the static prototype are not ported.

## CV builder and AI notes
- AI code is provider-independent: `src/lib/ai/types.ts` (interface), `gemini.ts` (adapter), `index.ts` (selection by env). Add another provider there without touching CV features.
- Each AI call is user-triggered, rate limited per user (`AI_PER_MINUTE_LIMIT`, `AI_DAILY_LIMIT`), and sends no name, email, phone or links. Output is schema-validated, and numbers not present in the CV are flagged.
- **Model names:** Google retires models on a schedule (gemini-2.0 and 1.x are gone; gemini-2.5 was scheduled to shut down on 16 October 2026, and retired models return 404). The default is `gemini-flash-latest`, an alias for the current Flash model. Set `AI_MODEL` to a specific model if you prefer.
- **Troubleshooting:** run `npm run ai:check`. It uses your real settings, never prints the key, and says which part Google rejects. The server log also shows Google's reason on a line starting with `ai failed`. Google returns HTTP 400 for several different problems: an invalid API key (`API key not valid`), the free tier not being available where the server runs unless billing is enabled (`FAILED_PRECONDITION`), a model that does not support JSON mode or system instructions (for example Gemma models), or a malformed request. Hosting dashboards sometimes keep quotes around pasted values, so paste the key without quotes.
- Gemini free tier: limits vary by model and project, and Google states free-tier content may be used to improve its products. The editor tells users this before they click. Consider a paid key for production.
- PDFs use standard PDF fonts (Helvetica / Times). Characters outside Western European encodings (for example some Yoruba tone marks) may not render until a custom font is embedded.
- The live preview approximates the PDF; the PDF is authoritative.

## File uploads
- Buckets (created by migration 0002): `documents` (private), `verification` (private), `avatars` (public, re-encoded images only), `cvs` (reserved, unused so far). Run migrations through 0006 for the storage rules.
- Every upload is checked on the server: size (4 MB documents/evidence, 2 MB photos), real file type from the first bytes (PDF, JPG, PNG; WebP for photos), and a heuristic for PDFs that contain scripts or embedded files. Names supplied by users never become storage paths.
- Profile photos are re-encoded to 512px WebP, which removes EXIF/GPS data.
- Downloads go through `/api/files/...`, which runs the lookup as the signed-in user (RLS) and returns a 60-second signed link. Employers can open a candidate's file only when it is attached to an application on their listing.
- A document attached to an application cannot be deleted from the library.
- The 4 MB limit follows serverless request-body limits (for example Vercel's 4.5 MB). Raise it only if you move uploads to direct-to-storage signed uploads.
- This is not a virus scan. For production, add a scanning step (for example a scanning service on upload) before relying on user files.
