# Status (verified commands)
- `tsc --noEmit`: clean. `vitest`: 72 passed. `tests/rls_harness.py`: 131 passed (SQL harness); integration: 34 passed, 0 failed (embedded Postgres, stubbed Supabase schemas).
- `next build`: compiles (Google Fonts download is skipped offline; fonts load from Google in the browser).
- Not run: live Supabase project, Vercel deploy, browser/E2E tests, accessibility audit, responsive review of the Next.js pages.

# Routes present
Public: / /jobs /jobs/[slug] /placements /placements/[slug] /companies/[slug] /about /faq /privacy /terms /auth/* ; placeholders: /contact /pricing /career-resources /cv-builder /employers /employer-guidelines.
Candidate: /dashboard, /applications, /applications/[id], /saved, /notifications, /apply/[slug].
Employer: /employer, /onboarding, /company, /verification, /opportunities (+new, edit, applicants), /applicants/[id], /interviews.
Admin: /admin, /opportunities, /verifications, /reports, /audit-logs.

# Migrations
0001 schema, 0002 helpers/RLS/application RPCs/storage, 0003 reference data (categories, plans, no fake listings), 0004 employer + admin RPCs (interviews, verification, moderation).

# CV builder (added)
Routes: /cv-builder, /dashboard/cvs, /dashboard/cvs/new, /dashboard/cvs/[id]/edit, /api/cv/[id]/pdf, /api/ai/cv. Migration 0005 adds set_default_cv.
Verified: PDF text extraction (selectable text) for all 3 templates, header layout inspected visually, AI layer unit-tested with mocked provider/fetch.
Not verified: real Gemini calls (no key in this environment), editor behaviour in a browser, mobile layout of the editor, PDF export on Vercel.

# Profile, password and onboarding (added)
Routes: /auth/update-password, /dashboard/profile, /dashboard/settings, /dashboard/onboarding. Verified: validation + completion unit tests, DB checks for profile ownership. Not verified: live email links, browser behaviour.
A test caught and fixed a link bug (ftp:// was accepted as https://ftp//...); links now go through one shared toWebUrl().

# File uploads (added)
Routes: /dashboard/documents, /api/files/[kind]/[id]; profile photo on /dashboard/profile; attachments on /apply/[slug]; evidence on /employer/verification and /admin/verifications. Migration 0006.
Verified: file validation + avatar processing unit tests (incl. EXIF/GPS stripping, decompression guard); 32 new database checks for storage and attachment rules.
Not verified: real Supabase Storage, real uploads from a browser, mobile file picker behaviour, large-file behaviour on Vercel.

# Search + diagnosis pass (added)
Migration 0007: employer/skills/category/courses are searchable, relevance ranking, course filter, one `search_opportunities` function.
Diagnosis: started the production build and requested 26 routes; built a real Postgres + PostgREST integration harness (tests/integration) that checks every select() string and RPC call in the source and the write flows the server actions use.
Bugs found and fixed: /go and /auth/callback crashed (500) without database config; search keywords over 120 characters crashed /jobs; a latent guard bug blocked non-admin updates to rejected listings.
Still not verified: Supabase Auth (signup, email links, sessions), real Storage, Gemini, rendering in a browser, mobile layouts.

# Cover letters (added)
Routes: /dashboard/cover-letters, /new, /[id]; /api/ai/letter; /api/cover-letters/[id]/pdf. Migration 0008. Listing pages link to 'Write a cover letter for this role'.
Verified: model + assistant unit tests (contact data never sent, job text marked untrusted, invented figures flagged), DB rules (ownership, CV link check, limits), write flows on real PostgREST, PDF text extraction.
Bug caught by tests: a paragraph starting with 'Hello.' was deleted as if it were a greeting; fixed.
Docs fix: the README migration range was stale (said 0001-0004); now 0001-0008.
Not verified: real Gemini output quality, the editor in a browser, mobile layout.
