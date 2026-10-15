"""Runs the real migrations against an embedded Postgres (with Supabase auth/storage stubs) and checks RLS behaviour.
Usage: pip install pgserver psycopg2-binary && python3 tests/rls_harness.py"""
import glob, sys, tempfile, uuid, pgserver, psycopg2

srv = pgserver.get_server(tempfile.mkdtemp())
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor()
sys.path.insert(0, 'tests')
from dbsetup import bootstrap
bootstrap(cur)

passed = failed = 0
def check(name, ok):
    global passed, failed
    print(('PASS ' if ok else 'FAIL ') + name); passed += ok; failed += (not ok)
def as_user(uid, sql, params=None):
    """Run one statement as an authenticated user. Returns (rows|None, error|None)."""
    cur.execute("reset role"); cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uid) if uid else '',))
    cur.execute("set role " + ('authenticated' if uid else 'anon'))
    try:
        cur.execute(sql, params)
        rows = cur.fetchall() if cur.description else []
        return rows, None
    except Exception as e:
        return None, str(e).splitlines()[0]
    finally:
        cur.execute("reset role")
def su(sql, params=None):
    cur.execute("reset role"); cur.execute("select set_config('request.jwt.claim.sub','',false)"); cur.execute(sql, params); return cur.fetchall() if cur.description else []

def mkuser(email, kind):
    uid = str(uuid.uuid4())
    su("insert into auth.users (id,email,raw_user_meta_data) values (%s,%s,%s)", (uid, email, '{"account_type":"%s","full_name":"%s"}' % (kind, email)))
    return uid
A, B = mkuser('a@x.com', 'candidate'), mkuser('b@x.com', 'candidate')
E1, E2 = mkuser('e1@x.com', 'employer'), mkuser('e2@x.com', 'employer')
ADM = mkuser('adm@x.com', 'candidate'); su("update profiles set role='admin' where id=%s", (ADM,))
ESC = mkuser('esc@x.com', 'admin')  # a signup *requesting* admin

check('signup requesting admin becomes candidate', su("select role from profiles where id=%s", (ESC,))[0][0] == 'candidate')
check('candidate cannot promote themselves', as_user(A, "update profiles set role='admin' where id=%s", (A,))[1] is not None)
check('candidate cannot unsuspend/alter status', as_user(A, "update profiles set status='active', role='employer' where id=%s", (A,))[1] is not None)

org1 = str(uuid.uuid4()); org2 = str(uuid.uuid4())
check('employer can create organisation', as_user(E1, "insert into employers (id,slug,name,created_by) values (%s,'org1','Org One',%s)", (org1, E1))[1] is None)
as_user(E2, "insert into employers (id,slug,name,created_by) values (%s,'org2','Org Two',%s)", (org2, E2))
check('candidate cannot create organisation', as_user(A, "insert into employers (slug,name,created_by) values ('x','Nope Co',%s)", (A,))[1] is not None)
check('owner membership created by trigger', su("select count(*) from employer_memberships where employer_id=%s and user_id=%s and role='owner'", (org1, E1))[0][0] == 1)
check('employer cannot self-verify', as_user(E1, "update employers set verification_status='verified' where id=%s", (org1,))[1] is not None)

opp = str(uuid.uuid4())
ins = "insert into opportunities (id,slug,employer_id,title,description,status,created_by,deadline) values (%s,%s,%s,'Dev Intern','Build things','%s',%s,%s)"
check('employer cannot insert as published', as_user(E1, ins % ('%s','%s','%s','published','%s','%s'), (opp, 's1', org1, E1, None))[1] is not None)
check('employer can insert draft', as_user(E1, ins % ('%s','%s','%s','draft','%s','%s'), (opp, 's1', org1, E1, None))[1] is None)
check('employer cannot publish own draft', as_user(E1, "update opportunities set status='published' where id=%s", (opp,))[1] is not None)
check('employer 2 cannot post for org 1', as_user(E2, ins % ('%s','%s','%s','draft','%s','%s'), (str(uuid.uuid4()), 's2', org1, E2, None))[1] is not None)
check('anon cannot see draft', as_user(None, "select id from opportunities where id=%s", (opp,))[0] == [])
check('admin can publish', as_user(ADM, "update opportunities set status='published' where id=%s", (opp,))[1] is None)
check('anon sees published listing', len(as_user(None, "select id from opportunities where id=%s", (opp,))[0]) == 1)
check('external listing needs https destination', as_user(ADM, "insert into opportunities (slug,employer_id,title,description,application_method,external_url) values ('bad',%s,'Bad','x','external','http://insecure.com')", (org1,))[1] is not None)

q = str(uuid.uuid4()); su("insert into application_questions (id,opportunity_id,prompt,required) values (%s,%s,'Why us?',true)", (q, opp))
r, e = as_user(A, "select submit_application(%s,null,'[]')", (opp,)); check('required question enforced', e is not None and 'missing_required_answer' in e)
r, e = as_user(A, "select submit_application(%s,null,%s)", (opp, '[{"question_id":"%s","answer":"Because"}]' % q)); app = r[0][0] if r else None
check('candidate can submit application', e is None and app is not None)
r, e = as_user(A, "select submit_application(%s,null,%s)", (opp, '[{"question_id":"%s","answer":"again"}]' % q)); check('duplicate application blocked', e is not None and 'duplicate_application' in e)
check('direct insert into applications is denied', as_user(B, "insert into applications (opportunity_id,candidate_id) values (%s,%s)", (opp, B))[1] is not None)
check('candidate sees own application', len(as_user(A, "select id from applications")[0]) == 1)
check('other candidate sees none', as_user(B, "select id from applications")[0] == [])
check('other employer sees none', as_user(E2, "select id from applications")[0] == [])
check('owning employer sees application', len(as_user(E1, "select id from applications")[0]) == 1)
check('employer sees applicant answers', len(as_user(E1, "select * from application_answers")[0]) == 1)
check('other employer cannot read answers', as_user(E2, "select * from application_answers")[0] == [])
check('employer was notified', su("select count(*) from notifications n join employer_memberships m on m.user_id=n.user_id where n.type='application_received' and m.employer_id=%s", (org1,))[0][0] == 1)

check('candidate cannot set status', as_user(A, "select set_application_status(%s,'hired',null)", (app,))[1] is not None)
check('other employer cannot set status', as_user(E2, "select set_application_status(%s,'shortlisted',null)", (app,))[1] is not None)
check('owning employer can shortlist', as_user(E1, "select set_application_status(%s,'shortlisted','good fit')", (app,))[1] is None)
check('history recorded (submitted + shortlisted)', su("select count(*) from application_status_history where application_id=%s", (app,))[0][0] == 2)
check('candidate notified of status change', su("select count(*) from notifications where user_id=%s and type='application_status'", (A,))[0][0] == 1)
check('candidate cannot direct-update status', as_user(A, "update applications set status='hired' where id=%s", (app,))[0] in (None, []) )
cur.execute("reset role"); check('status unchanged after direct update attempt', su("select status from applications where id=%s", (app,))[0][0] == 'shortlisted')

su("insert into application_notes (application_id,author_id,note) values (%s,%s,'internal only')", (app, E1))
check('candidate cannot read internal notes', as_user(A, "select * from application_notes")[0] == [])
check('other employer cannot read internal notes', as_user(E2, "select * from application_notes")[0] == [])
check('owning employer can read notes', len(as_user(E1, "select * from application_notes")[0]) == 1)

cv = str(uuid.uuid4()); su("insert into candidate_cvs (id,user_id,title) values (%s,%s,'Mine')", (cv, A))
check('other candidate cannot read my CV', as_user(B, "select id from candidate_cvs")[0] == [])
check('employer cannot read CV table directly', as_user(E1, "select id from candidate_cvs")[0] == [])
check('cannot submit someone else\'s CV', 'cv_not_found' in (as_user(B, "select submit_application(%s,%s,%s)", (opp, cv, '[{"question_id":"%s","answer":"x"}]' % q))[1] or ''))

check('notification content is not editable by user', as_user(A, "update notifications set title='hacked' where user_id=%s", (A,))[1] is not None)
check('user can mark notification read', as_user(A, "update notifications set read_at=now() where user_id=%s", (A,))[1] is None)
check('user cannot read others\' notifications', as_user(B, "select * from notifications where user_id=%s", (A,))[0] == [])
check('audit log hidden from non-admin', as_user(A, "select * from audit_logs")[0] == [])
check('log_audit refused for non-admin', as_user(A, "select log_audit('x','y','z')")[1] is not None)
check('admin can write audit log', as_user(ADM, "select log_audit('listing.approve','opportunity',%s)", (opp,))[1] is None)
check('payment_events locked down', as_user(E1, "select * from payment_events")[1] is not None or as_user(E1, "select * from payment_events")[0] == [])
check('withdraw works for owner only', as_user(B, "select withdraw_application(%s)", (app,))[1] is not None and as_user(A, "select withdraw_application(%s)", (app,))[1] is None)

# ── employer/admin RPCs (migration 0004) ──
opp2 = str(uuid.uuid4())
as_user(E1, ins % ('%s','%s','%s','pending_review','%s','%s'), (opp2, 's-mod', org1, E1, None))
check('non-admin cannot moderate', as_user(E1, "select moderate_opportunity(%s,'approve',null)", (opp2,))[1] is not None)
check('reject requires a note', 'note_required' in (as_user(ADM, "select moderate_opportunity(%s,'reject',null)", (opp2,))[1] or ''))
check('admin approves listing', as_user(ADM, "select moderate_opportunity(%s,'approve',null)", (opp2,))[1] is None and su("select status from opportunities where id=%s", (opp2,))[0][0] == 'published')
check('moderation is audit-logged', su("select count(*) from audit_logs where action='listing.approve'")[0][0] >= 1)
check('employer notified of moderation', su("select count(*) from notifications where type='listing_moderated' and user_id=%s", (E1,))[0][0] >= 1)
as_user(E1, "update opportunities set title='Changed title' where id=%s", (opp2,))
check('editing a live listing title sends it back to review', su("select status from opportunities where id=%s", (opp2,))[0][0] == 'pending_review')
check('employer can pause then close own published listing', as_user(E1, "update opportunities set status='paused' where id=%s", (opp,))[1] is None and as_user(E1, "update opportunities set status='closed' where id=%s", (opp,))[1] is None)
check('closed listing cannot be republished by employer', as_user(E1, "update opportunities set status='published' where id=%s", (opp,))[1] is not None)
check('closed listing rejects new applications', 'listing_not_open' in (as_user(B, "select submit_application(%s,null,'[]')", (opp,))[1] or ''))

r, e = as_user(E2, "select submit_verification_request(%s,'{\"website\":\"https://x.com\"}')", (org1,)); check('other employer cannot request verification for my org', e is not None)
r, e = as_user(E1, "select submit_verification_request(%s,'{\"website\":\"https://x.com\"}')", (org1,)); vid = r[0][0] if r else None
check('owner submits verification request', e is None and su("select verification_status from employers where id=%s", (org1,))[0][0] == 'pending')
check('duplicate pending request blocked', 'request_pending' in (as_user(E1, "select submit_verification_request(%s,'{}')", (org1,))[1] or ''))
check('employer still cannot self-verify after submitting', as_user(E1, "update employers set verification_status='verified' where id=%s", (org1,))[1] is not None)
check('non-admin cannot review verification', as_user(E1, "select review_verification(%s,'approve',null)", (vid,))[1] is not None)
check('admin approves verification', as_user(ADM, "select review_verification(%s,'approve',null)", (vid,))[1] is None and su("select verification_status from employers where id=%s", (org1,))[0][0] == 'verified')
check('other employer cannot read my verification evidence', as_user(E2, "select * from employer_verification_requests")[0] == [])

app3 = str(uuid.uuid4()); su("insert into opportunities (id,slug,employer_id,title,description,status) values (%s,'s-int',%s,'Int role','d','published')", (str(uuid.uuid4()), org1)) 
iopp = su("select id from opportunities where slug='s-int'")[0][0]
r, e = as_user(B, "select submit_application(%s,null,'[]')", (iopp,)); iapp = r[0][0] if r else None
check('candidate B applies to second listing', iapp is not None)
check('candidate cannot schedule interview', as_user(B, "select schedule_interview(%s, now() + interval '2 days','Africa/Lagos','online','link')", (iapp,))[1] is not None)
check('other employer cannot schedule interview', as_user(E2, "select schedule_interview(%s, now() + interval '2 days','Africa/Lagos','online','link')", (iapp,))[1] is not None)
check('past interview rejected', 'interview_in_past' in (as_user(E1, "select schedule_interview(%s, now() - interval '1 day','Africa/Lagos','online','x')", (iapp,))[1] or ''))
r, e = as_user(E1, "select schedule_interview(%s, now() + interval '2 days','Africa/Lagos','online','https://meet.example/abc')", (iapp,)); iid = r[0][0] if r else None
check('employer schedules interview, status moves', e is None and su("select status from applications where id=%s", (iapp,))[0][0] == 'interview_scheduled')
check('candidate sees own interview', len(as_user(B, "select id from interviews")[0]) == 1)
check('other candidate cannot see interview', as_user(A, "select id from interviews")[0] == [])
check('candidate notified of interview', su("select count(*) from notifications where user_id=%s and type='interview_scheduled'", (B,))[0][0] == 1)
check('employer cancels interview', as_user(E1, "select cancel_interview(%s)", (iid,))[1] is None and su("select status from interviews where id=%s", (iid,))[0][0] == 'cancelled')


# ── CV default switching ──
cv1, cv2, cvb = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
su("insert into candidate_cvs (id,user_id,title,is_default) values (%s,%s,'one',true)", (cv1, B))
su("insert into candidate_cvs (id,user_id,title) values (%s,%s,'two')", (cv2, B))
su("insert into candidate_cvs (id,user_id,title) values (%s,%s,'other user')", (cvb, A))
check('two default CVs for one user are impossible', as_user(B, "update candidate_cvs set is_default=true where id=%s", (cv2,))[1] is not None)
check('set_default_cv switches default atomically', as_user(B, "select set_default_cv(%s)", (cv2,))[1] is None and su("select id from candidate_cvs where user_id=%s and is_default", (B,)) == [(cv2,)])
check('cannot set default on another user\'s CV', 'not_found' in (as_user(B, "select set_default_cv(%s)", (cvb,))[1] or ''))
check('failed attempt did not clear my default', su("select count(*) from candidate_cvs where user_id=%s and is_default", (B,))[0][0] == 1)
check('cv_versions follow CV ownership', as_user(A, "insert into cv_versions (cv_id,content) values (%s,'{}')", (cv2,))[1] is not None and as_user(B, "insert into cv_versions (cv_id,content) values (%s,'{}')", (cv2,))[1] is None)
check('ai usage can only be recorded for yourself', as_user(A, "insert into ai_usage_records (user_id,feature,input_chars) values (%s,'cv.summary',10)", (B,))[1] is not None and as_user(A, "insert into ai_usage_records (user_id,feature,input_chars) values (%s,'cv.summary',10)", (A,))[1] is None)
check('ai usage is private to its owner', as_user(B, "select * from ai_usage_records")[0] == [])

# ── Profile editing ──
su("insert into student_profiles (user_id,institution) values (%s,'Uni A')", (A,))
check('candidate can edit own candidate profile', as_user(B, "update candidate_profiles set headline='mine' where user_id=%s", (B,))[1] is None and su("select headline from candidate_profiles where user_id=%s", (B,))[0][0] == 'mine')
r, e = as_user(B, "update candidate_profiles set headline='hacked' where user_id=%s returning 1", (A,)); check("cannot edit another candidate's profile", e is None and r == [] and su("select coalesce(headline,'') from candidate_profiles where user_id=%s", (A,))[0][0] != 'hacked')
r, e = as_user(B, "update student_profiles set institution='hacked' where user_id=%s returning 1", (A,)); check("cannot edit another student's details", r == [] or e is not None)
check('candidate can upsert own student profile', as_user(B, "insert into student_profiles (user_id,course,required_duration_weeks) values (%s,'CS',24)", (B,))[1] is None)
check('student duration is range-checked in the database', as_user(B, "update student_profiles set required_duration_weeks=500 where user_id=%s", (B,))[1] is not None)
check('other candidates cannot read my student profile', as_user(A, "select * from student_profiles where user_id=%s", (B,))[0] == [])
check('employer without an application cannot read student profile', as_user(E2, "select * from student_profiles where user_id=%s", (A,))[0] == [])
check('applicant can only change their own onboarding flag', as_user(B, "update profiles set onboarding_completed=true where id=%s", (B,))[1] is None and as_user(B, "update profiles set onboarding_completed=true where id=%s returning 1", (A,))[0] == [])

# ── File storage rules ──
def put(uid, bucket, name): return as_user(uid, "insert into storage.objects (bucket_id,name) values (%s,%s)", (bucket, name))[1]
def can_see(uid, bucket, name): r, e = as_user(uid, "select 1 from storage.objects where bucket_id=%s and name=%s", (bucket, name)); return bool(r)
check('candidate can upload into own documents folder', put(A, 'documents', f'{A}/letter.pdf') is None)
check("candidate cannot upload into someone else's folder", put(B, 'documents', f'{A}/evil.pdf') is not None)
check("other candidate cannot read my file", not can_see(B, 'documents', f'{A}/letter.pdf'))
check('anonymous visitors cannot read private files', not can_see(None, 'documents', f'{A}/letter.pdf'))
check('employer cannot read a candidate file that is not attached', not can_see(E1, 'documents', f'{A}/letter.pdf'))
check('document type must be known', as_user(A, "insert into candidate_documents (user_id,doc_type,file_name,storage_path,size_bytes) values (%s,'virus','x.pdf',%s,10)", (A, f'{A}/letter.pdf'))[1] is not None)
check('document path must be in own folder (DB constraint)', as_user(A, "insert into candidate_documents (user_id,doc_type,file_name,storage_path,size_bytes) values (%s,'other','x.pdf',%s,10)", (A, f'{B}/stolen.pdf'))[1] is not None)
doc = str(uuid.uuid4())
check('candidate can register a document', as_user(A, "insert into candidate_documents (id,user_id,doc_type,file_name,storage_path,size_bytes) values (%s,%s,'school_letter','letter.pdf',%s,1000)", (doc, A, f'{A}/letter.pdf'))[1] is None)
su("insert into candidate_documents (user_id,doc_type,file_name,storage_path,size_bytes) values (%s,'other','b.pdf',%s,10)", (B, f'{B}/b.pdf'))
app_a = su("select id from applications where candidate_id=%s limit 1", (A,))[0][0]
check("cannot attach another user's document to my application", as_user(A, "insert into application_documents (application_id,doc_type,file_name,storage_path) values (%s,'other','b.pdf',%s)", (app_a, f'{B}/b.pdf'))[1] is not None)
check('cannot attach a file that is not in my library', as_user(A, "insert into application_documents (application_id,doc_type,file_name,storage_path) values (%s,'other','x.pdf',%s)", (app_a, f'{A}/not-registered.pdf'))[1] is not None)
check('candidate can attach own document to own application', as_user(A, "insert into application_documents (application_id,doc_type,file_name,storage_path) values (%s,'School letter','letter.pdf',%s)", (app_a, f'{A}/letter.pdf'))[1] is None)
check('same file cannot be attached twice', as_user(A, "insert into application_documents (application_id,doc_type,file_name,storage_path) values (%s,'x','letter.pdf',%s)", (app_a, f'{A}/letter.pdf'))[1] is not None)
check('other candidate cannot attach to my application', as_user(B, "insert into application_documents (application_id,doc_type,file_name,storage_path) values (%s,'x','b.pdf',%s)", (app_a, f'{B}/b.pdf'))[1] is not None)
check('employer who received the application can read the attached file', can_see(E1, 'documents', f'{A}/letter.pdf'))
check('a different employer cannot', not can_see(E2, 'documents', f'{A}/letter.pdf'))
check('other candidates still cannot', not can_see(B, 'documents', f'{A}/letter.pdf'))
check('employer sees the attachment record, other employer does not', len(as_user(E1, "select * from application_documents")[0]) == 1 and as_user(E2, "select * from application_documents")[0] == [])
check('attached document cannot be deleted from the library', 'document_in_use' in (as_user(A, "delete from candidate_documents where id=%s", (doc,))[1] or ''))
check('unattached document can be deleted', as_user(B, "delete from candidate_documents where user_id=%s", (B,))[1] is None)

# verification evidence
check('org owner can upload evidence to the org folder', put(E1, 'verification', f'{org1}/id.pdf') is None)
check("another employer cannot upload to that org's folder", put(E2, 'verification', f'{org1}/fake.pdf') is not None)
check('a folder that is not a uuid is simply denied, not an error', 'violates row-level security' in (put(E1, 'verification', 'not-a-uuid/x.pdf') or ''))
check("another employer cannot read the org's evidence", not can_see(E2, 'verification', f'{org1}/id.pdf'))
check('candidates cannot read evidence', not can_see(A, 'verification', f'{org1}/id.pdf'))
check('admin can read evidence', can_see(ADM, 'verification', f'{org1}/id.pdf'))
r, e = as_user(ADM, "delete from storage.objects where bucket_id='verification' returning 1"); check('admin cannot delete evidence', r == [] and e is None)
check('verification request rejects files from another folder', 'bad_file_path' in (as_user(E1, "select submit_verification_request(%s,'{}'::jsonb,%s)", (org1, [f'{org2}/x.pdf']))[1] or ''))
check('verification request rejects more than 3 files', 'too_many_files' in (as_user(E1, "select submit_verification_request(%s,'{}'::jsonb,%s)", (org1, [f'{org1}/{i}.pdf' for i in range(4)]))[1] or ''))
E3 = mkuser('e3@x.com', 'employer'); org3 = str(uuid.uuid4())
as_user(E3, "insert into employers (id,slug,name,created_by) values (%s,'org3','Org Three',%s)", (org3, E3))
check('already-verified organisations cannot resubmit', 'already_verified' in (as_user(E1, "select submit_verification_request(%s,'{}'::jsonb,%s)", (org1, [f'{org1}/id.pdf']))[1] or ''))
check('evidence upload is limited to the org folder for a new org', put(E3, 'verification', f'{org3}/cac.pdf') is None)
r, e = as_user(E3, "select submit_verification_request(%s,'{}'::jsonb,%s)", (org3, [f'{org3}/cac.pdf'])); check('verification request stores the evidence paths', e is None and su("select document_paths from employer_verification_requests where employer_id=%s", (org3,))[0][0] == [f'{org3}/cac.pdf'])
check('org status becomes pending after submitting', su("select verification_status from employers where id=%s", (org3,))[0][0] == 'pending')

print(f"\n{passed} passed, {failed} failed"); sys.exit(1 if failed else 0)
