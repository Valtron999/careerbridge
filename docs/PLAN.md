# Implementation status

## Done (code exists; tested as noted in README)
- Phase 1: Next.js/TS/Tailwind foundation, brand config, Supabase clients, middleware, migrations (all tables in the master prompt, indexes, RLS, storage buckets, reference categories/plans).
- Phase 2 (partial): signup / login / logout / password-reset request / email-verification callback, role guards, candidate/employer/admin overview pages with real counts.
- Phase 3: landing page, `/jobs` and `/placements` search (URL filters, pagination, full-text search), detail pages with metadata + JobPosting JSON-LD, save, report, `robots`/`sitemap`.
- Phase 4 (partial): direct apply with employer questions via RPC, external apply (validated https link, mailto, self-reported tracking), status history, withdraw, in-app notifications list.

- Phase 7 (core): organisation onboarding and company profile, public company page, verification request, listing editor (draft / submit for review / pause / resume / close / archive, skills, application questions), applicant list with filters, applicant detail (answers, CV snapshot, status updates, internal notes, interview scheduling with time zones), upcoming interviews.
- Phase 8 (core): admin listing moderation queue, verification review, reported-listing handling, audit-log viewer. All decisions go through SECURITY DEFINER functions that write the audit log and notify the employer.

## Not built yet
- Employer onboarding polish (candidate onboarding is done).
- File uploads are built (see README) but only tested against a stand-in for Supabase storage, not a live project. No antivirus scanning. Uploading a generated CV PDF into the document library is not built.
- Career assistant chat. (Done: CV builder, 3 templates, PDF export, cover letters with tone, per-paragraph rewrite and PDF, Gemini AI service, per-user AI quotas. None of the AI features has been tested with a real Gemini key.)
- Employer: team management, subscription listing limits, recruitment analytics, rescheduling interviews (cancel + create new works), CV preview beyond the raw snapshot.
- Admin: user management/suspension, category and settings management, analytics charts.
- Email sending, notification preferences UI, subscriptions/Paystack/webhooks, cron jobs.
- Recommendations, employer marketing pages, pricing, legal text (placeholders flagged for review). Search by employer, skills and course is done (prefix matching, best-match ranking). Category renames do not refresh the search text of existing listings.
- Scroll-reveal animations from the standalone landing page.
- Rate limiting beyond Supabase Auth's built-in limits (AI endpoints have their own per-user limits).

## Route inventory (implemented)
/, /jobs, /jobs/[slug], /placements, /placements/[slug], /apply/[slug], /go/[slug], /auth/{login,signup,forgot-password,callback},
/dashboard, /dashboard/{applications,applications/[id],saved,notifications}, /employer, /admin, /about, /faq, /privacy, /terms (draft),
/contact, /pricing, /career-resources, /cv-builder, /employers, /employer-guidelines (placeholders), /robots.txt, /sitemap.xml
