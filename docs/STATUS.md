# Status (verified commands)
- `tsc --noEmit`: clean. `vitest`: 98 passed. `tests/rls_harness.py`: 131 passed (SQL harness); integration: 34 passed, 0 failed (embedded Postgres, stubbed Supabase schemas).
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

# Student-first landing page (added)
Page order: hero (SIWES, internships, CV) -> three action cards -> SIWES/internship listings with a smaller "Looking for a job instead?" strip -> CV builder with a real preview -> how it works -> student checklist -> trust -> employer band -> FAQ -> closing call to action. Jobs remain in the navigation, search, listing strip and footer.
Migration 0009: the entry-level filter also covers listings marked "no experience needed" (powers the "Entry-level jobs" option).
Verified in a headless browser (tests/ui/landing.py, 68 checks, against a seeded database): no horizontal overflow at 320, 360, 375, 390, 430, 640, 768, 1024 and 1280px; both hero CTAs inside the first screen on phones; card layouts (1/2/3 columns); mobile menu open/close/Escape/navigation; hero search sends type, keyword and location; entry-level and SIWES searches return the right listings; FAQ and template switch work; all 31 internal links on the page resolve; reduced motion shows everything with no entrance animation; the page is fully visible with JavaScript off.
Test-setup bugs found along the way (not app bugs): a non-JWT anon key made every query fail silently; hero-CTA check measured during smooth scrolling.
Limits: sample CV text on phones is small (about 8 to 10px effective at 320 to 390px, a thumbnail, not full size). Google Fonts could not be loaded in the test sandbox, so the page was checked with the fallback font. The /employers and /career-resources pages are still "Coming soon" placeholders: the page's employer button therefore goes to employer sign-up, and the checklist is written inline instead of linking to articles that do not exist.
Not verified: real devices, other browsers (only Chromium), real Supabase auth for signed-in variants of the page.

# Gemini 400 diagnosis (added)
Report: `cv ai failed provider_rejected gemini status 400`. The app hid Google's reason, so the cause could not be read from the log. Google documents HTTP 400 for: invalid API key, free tier unavailable in the region without billing, and malformed requests (which includes models that reject JSON mode or system instructions).
Changes: errors are now classified (provider_auth / provider_region / provider_model / provider_rejected) and the log shows Google's status and reason, never the key or CV text; `npm run ai:check` diagnoses a real setup; default model is now `gemini-flash-latest` because gemini-2.5-flash was scheduled for shutdown on 16 Oct 2026.
Verified: 13 classification cases and key redaction (unit tests); the check script against a mock Google for good key, invalid key, region/billing, retired model, Gemma, quoted key and missing key.
Not verified: the real cause on the reporter's machine (needs their `npm run ai:check` output), anything against the real Google API.

# Employer and admin entry points (added)
Reported: no employer business login and no way to find the admin panel. Both existed but nothing led to them: /employers was a "Coming soon" page, sign-in was one shared page that always sent people to the student dashboard, and there was no way to create an admin.
Changes: real /employers page; employer and admin variants of the sign-in page; role-aware redirect after sign-in (an employer lands on /employer, nobody is sent into an area their role cannot open); employer sign-in/sign-up and staff links in the footer; `npm run make-admin -- email`.
Verified: redirect rules (unit tests); the admin command against a real database stack (promotes an account, refuses unknown/invalid emails and missing keys, and a normal user's key cannot promote anyone); 29 browser checks (pages, headings, links, overflow at 320/390/768/1280px, signed-out /admin goes to sign-in, open redirects ignored).
Not verified: real sign-in and email confirmation (needs a live Supabase project), so the redirect after an actual login has only been unit-tested.
