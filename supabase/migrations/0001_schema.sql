-- CareerBridge schema. Run via `supabase db push` or the SQL editor, in order.

create type account_role as enum ('candidate','employer','admin','super_admin');
create type account_status as enum ('active','suspended');
create type opportunity_kind as enum ('job','placement');
create type opportunity_status as enum ('draft','pending_review','published','paused','closed','archived','rejected');
create type work_arrangement as enum ('onsite','hybrid','remote');
create type application_method as enum ('direct','external');
create type application_status as enum ('submitted','under_review','shortlisted','interview_scheduled','assessment','offer','hired','rejected','withdrawn');
create type verification_status as enum ('unverified','pending','needs_info','verified','rejected');
create type member_role as enum ('owner','admin','recruiter','viewer');
create type question_type as enum ('short_text','long_text','single_choice','yes_no','date','number');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────── Identity ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role account_role not null default 'candidate',
  status account_status not null default 'active',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table candidate_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  headline text, summary text, location text,
  is_student boolean not null default false,
  skills text[] not null default '{}',
  links jsonb not null default '[]',
  preferences jsonb not null default '{}',
  visibility jsonb not null default '{"contact_visible_to_employers": false}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table student_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  institution text, course text, faculty text, academic_level text,
  expected_graduation date,
  siwes_eligible boolean,
  required_duration_weeks int check (required_duration_weeks is null or required_duration_weeks between 1 and 104),
  preferred_locations text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table employers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 120),
  industry text, description text, website text, location text, logo_url text,
  public_email text, public_phone text,
  verification_status verification_status not null default 'unverified',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table employer_memberships (
  employer_id uuid not null references employers(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  primary key (employer_id, user_id)
);
create table employer_verification_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references employers(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  evidence jsonb not null default '{}',
  document_paths text[] not null default '{}',
  status verification_status not null default 'pending',
  reviewer_id uuid references profiles(id),
  review_note text,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);

-- ───────── Opportunities ─────────
create table opportunity_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  kind opportunity_kind not null,
  is_active boolean not null default true, sort_order int not null default 0
);
create table skills (id uuid primary key default gen_random_uuid(), name text not null unique);
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  employer_id uuid not null references employers(id) on delete cascade,
  category_id uuid references opportunity_categories(id),
  kind opportunity_kind not null default 'job',
  title text not null check (char_length(title) between 3 and 160),
  description text not null,
  responsibilities text, requirements text, qualifications text, benefits text,
  employment_type text check (employment_type in ('full_time','part_time','contract','internship','apprenticeship','volunteer','temporary')),
  work_arrangement work_arrangement not null default 'onsite',
  location_city text, location_state text, location_country text not null default 'Nigeria',
  experience_level text check (experience_level in ('none','entry','mid','senior','lead')),
  education_level text,
  salary_min numeric check (salary_min is null or salary_min >= 0),
  salary_max numeric check (salary_max is null or salary_max >= salary_min),
  salary_currency text default 'NGN',
  compensation_note text,
  is_unpaid boolean not null default false,
  placement_duration_weeks int check (placement_duration_weeks is null or placement_duration_weeks > 0),
  start_date date,
  eligible_courses text[] not null default '{}',
  eligible_institutions text[] not null default '{}',
  required_documents text[] not null default '{}',
  positions_available int check (positions_available is null or positions_available > 0),
  deadline timestamptz,
  application_method application_method not null default 'direct',
  external_url text, external_email text, application_instructions text,
  status opportunity_status not null default 'draft',
  moderation_note text,
  source text not null default 'employer' check (source in ('employer','import')),
  source_url text, last_verified_at timestamptz,
  featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(location_city,'') || ' ' || coalesce(location_state,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'C')) stored,
  constraint external_needs_destination check (
    application_method = 'direct' or external_url is not null or external_email is not null),
  constraint external_url_https check (external_url is null or external_url ~* '^https://')
);
create table opportunity_skills (
  opportunity_id uuid references opportunities(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (opportunity_id, skill_id)
);
create table saved_opportunities (
  user_id uuid references profiles(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create table opportunity_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (reason in ('scam','misleading','discriminatory','duplicate','expired','other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique (opportunity_id, reporter_id)
);

-- ───────── Career documents ─────────
create table candidate_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'My CV', template text not null default 'professional',
  is_default boolean not null default false,
  content jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_default_cv on candidate_cvs(user_id) where is_default;
create table cv_versions (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references candidate_cvs(id) on delete cascade,
  label text, content jsonb not null, created_at timestamptz not null default now()
);
create table cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  cv_id uuid references candidate_cvs(id) on delete set null,
  title text not null default 'Cover letter', body text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table candidate_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  doc_type text not null, file_name text not null, storage_path text not null unique,
  size_bytes int check (size_bytes > 0), created_at timestamptz not null default now()
);

-- ───────── Applications ─────────
create table application_questions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  prompt text not null, type question_type not null default 'short_text',
  required boolean not null default false, options jsonb, sort_order int not null default 0
);
create table applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete restrict,
  candidate_id uuid not null references profiles(id) on delete cascade,
  cv_id uuid references candidate_cvs(id) on delete set null,
  cv_snapshot jsonb,
  status application_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_application_per_opportunity unique (opportunity_id, candidate_id)
);
create table application_answers (
  application_id uuid references applications(id) on delete cascade,
  question_id uuid references application_questions(id) on delete cascade,
  answer text not null check (char_length(answer) <= 5000),
  primary key (application_id, question_id)
);
create table application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  doc_type text not null, file_name text not null, storage_path text not null,
  created_at timestamptz not null default now()
);
create table application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  from_status application_status, to_status application_status not null,
  changed_by uuid references profiles(id), note text,
  created_at timestamptz not null default now()
);
create table application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note text not null check (char_length(note) <= 4000),
  created_at timestamptz not null default now()
);
-- Self-reported / outbound tracking. Deliberately separate from `applications`.
create table external_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  state text not null default 'clicked' check (state in ('clicked','self_reported_applied')),
  applied_on date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);
create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  scheduled_at timestamptz not null, timezone text not null default 'Africa/Lagos',
  format text not null check (format in ('online','physical')),
  details text, status text not null default 'scheduled' check (status in ('scheduled','rescheduled','cancelled','completed')),
  created_by uuid references profiles(id), created_at timestamptz not null default now()
);

-- ───────── Notifications, billing, admin ─────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null, title text not null, body text, link text,
  dedupe_key text, read_at timestamptz, created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_enabled boolean not null default true, deadline_reminders boolean not null default true,
  marketing boolean not null default false
);
create table email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  template text not null, provider_message_id text,
  status text not null check (status in ('queued','sent','delivered','failed')),
  error text, created_at timestamptz not null default now()
);
create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  price_ngn_kobo bigint not null default 0 check (price_ngn_kobo >= 0),
  interval text not null default 'month' check (interval in ('month','year')),
  limits jsonb not null default '{}', features jsonb not null default '[]',
  is_active boolean not null default true
);
create table employer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references employers(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
  current_period_end timestamptz, created_at timestamptz not null default now()
);
create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references employers(id),
  subscription_id uuid references employer_subscriptions(id),
  provider text not null, provider_reference text not null,
  amount_kobo bigint not null check (amount_kobo >= 0), currency text not null default 'NGN',
  status text not null default 'initiated' check (status in ('initiated','succeeded','failed','refunded')),
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);
create table payment_events (  -- webhook idempotency
  provider text not null, event_id text not null, received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id), action text not null,
  target_type text, target_id text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table platform_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table ai_usage_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  feature text not null, input_chars int, created_at timestamptz not null default now()
);

-- ───────── Indexes ─────────
create index on opportunities using gin (search_vector);
create index on opportunities (status, published_at desc);
create index on opportunities (kind, status);
create index on opportunities (employer_id);
create index on opportunities (deadline);
create index on opportunities (location_state, location_city);
create index on opportunities using gin (eligible_courses);
create index on applications (candidate_id);
create index on applications (opportunity_id, status);
create index on application_status_history (application_id, created_at);
create index on notifications (user_id, read_at, created_at desc);
create index on employer_memberships (user_id);
create index on audit_logs (created_at desc);
create index on ai_usage_records (user_id, created_at desc);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','candidate_profiles','student_profiles','employers','opportunities','candidate_cvs','cover_letters','applications','external_applications'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at()', t);
  end loop; end $$;
