"""Integration harness: real Postgres + the real migrations + real PostgREST, then the app's own queries (vitest) against it.
Usage: python3 tests/integration/run.py   (needs: pip install pgserver psycopg2-binary, and a PostgREST binary at $POSTGREST or /tmp/pgrst/postgrest)"""
import json, os, subprocess, sys, tempfile, time, urllib.request, uuid
import pgserver, psycopg2
sys.path.insert(0, 'tests'); from dbsetup import bootstrap

SECRET = 'integration-test-secret-integration-test-secret'
srv = pgserver.get_server(tempfile.mkdtemp())
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True; cur = conn.cursor()
bootstrap(cur)

def one(sql, *a): cur.execute(sql, a); return cur.fetchone()[0]
def user(email, kind): u = str(uuid.uuid4()); cur.execute("insert into auth.users (id,email,raw_user_meta_data) values (%s,%s,%s)", (u, email, json.dumps({'account_type': kind, 'full_name': email.split('@')[0]}))); return u
U = {k: user(f'{k}@x.com', 'employer' if k.startswith('e') else 'candidate') for k in ['a', 'b', 'e1', 'e2', 'adm']}
cur.execute("update profiles set role='admin' where id=%s", (U['adm'],))
org1, org2 = str(uuid.uuid4()), str(uuid.uuid4())
cur.execute("insert into employers (id,slug,name,created_by,verification_status) values (%s,'zenith-labs','Zenith Labs',%s,'verified')", (org1, U['e1']))
cur.execute("insert into employers (id,slug,name,created_by) values (%s,'kano-tech','Kano Tech',%s)", (org2, U['e2']))
cat = {r[0]: r[1] for r in (cur.execute("select slug,id from opportunity_categories") or cur.fetchall())}
skills = {n: one("insert into skills (name) values (%s) returning id", n) for n in ['SQL', 'Excel', 'Welding']}
opps, visible = {}, []
def opp(slug, org, title, desc='A role.', category='full-time', kind='job', status='published', days=0, skill_names=(), visible_=True, **cols):
    oid = str(uuid.uuid4())
    cols = {'id': oid, 'employer_id': org, 'slug': slug, 'title': title, 'description': desc, 'category_id': cat[category], 'kind': kind, 'status': status, **cols}
    names = list(cols)
    cur.execute(f"insert into opportunities ({', '.join(names)}) values ({', '.join(['%s'] * len(names))})", [cols[n] for n in names])
    cur.execute("update opportunities set published_at = now() - make_interval(days => %s) where id = %s and published_at is not null", (days, oid))
    for sk in skill_names: cur.execute("insert into opportunity_skills values (%s,%s)", (oid, skills[sk]))
    opps[slug] = oid
    if visible_ and status == 'published': visible.append(slug)
opp('data-analyst', org1, 'Data Analyst', 'Prepare weekly reporting dashboards', skill_names=['SQL', 'Excel'], location_city='Lagos', location_state='Lagos', days=1)
opp('swe-placement', org2, 'Software Engineering Placement', 'Build web features', category='siwes', kind='placement', location_city='Abuja', eligible_courses=['Computer Science', 'Software Engineering'], placement_duration_weeks=24, is_unpaid=True, days=2)
opp('civil-placement', org1, 'Civil Site Placement', 'Site supervision support', category='siwes', kind='placement', location_city='Port Harcourt', location_state='Rivers', eligible_courses=['Civil Engineering'], placement_duration_weeks=12, salary_min=50000, salary_max=80000, skill_names=['Welding'], days=3)
opp('office-placement', org2, 'General Office Placement', 'Admin support for all courses', category='swep', kind='placement', location_city='Lagos', location_state='Lagos', placement_duration_weeks=8, days=4)
opp('remote-support', org1, 'Remote Support Agent', 'Answer customer questions', work_arrangement='remote', days=5)
opp('engineer-title', org2, 'Engineer Trainee', 'Learn on the job', category='graduate-trainee', days=6)
opp('engineer-desc', org2, 'Operations Associate', 'You will work closely with the engineer team and support them daily', days=7)
opp('external-job', org1, 'External Apply Job', 'Apply on our site', application_method='external', external_url='https://example.com/apply', days=8)
opp('direct-job', org1, 'Direct Apply Job', 'Apply here', required_documents=['School letter'], days=9)
opp('draft-job', org1, 'Hidden Draft', status='draft')
opp('expired-job', org1, 'Expired Role', deadline="2000-01-01T00:00:00Z", days=10, visible_=False)
opp('closed-job', org1, 'Closed Role', status='closed', days=11)
for n in range(14): opp(f'filler-{n}', org2, f'Filler Role {n}', 'Filler listing', days=20 + n)
cur.execute("insert into application_questions (opportunity_id,prompt,required) values (%s,'Why us?',true)", (opps['direct-job'],))
cfile = os.path.join(tempfile.mkdtemp(), 'ids.json')
json.dump({'secret': SECRET, 'users': U, 'orgs': {'org1': org1, 'org2': org2}, 'opps': opps, 'visible': visible, 'categories': cat}, open(cfile, 'w'))

pg = os.environ.get('POSTGREST', '/tmp/pgrst/postgrest')
conf = os.path.join(tempfile.mkdtemp(), 'pgrst.conf')
open(conf, 'w').write(f'db-uri = "{srv.get_uri()}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "{SECRET}"\nserver-host = "127.0.0.1"\nserver-port = 3001\ndb-pool = 4\n')
procs = [subprocess.Popen([pg, conf], stdout=subprocess.DEVNULL, stderr=open('/tmp/pgrst.err', 'w'))]
for _ in range(60):
    try: urllib.request.urlopen('http://127.0.0.1:3001/', timeout=1); break
    except Exception: time.sleep(0.25)
else: print(open('/tmp/pgrst.err').read()); sys.exit('PostgREST did not start')
procs.append(subprocess.Popen(['node', 'tests/integration/proxy.mjs']))
time.sleep(0.5)
try:
    rc = subprocess.call(['npx', 'vitest', 'run', '--config', 'vitest.integration.config.mts'], env={**os.environ, 'CB_INT_FILE': cfile, 'CB_REST_URL': 'http://127.0.0.1:3002'})
finally:
    for p in procs: p.terminate()
sys.exit(rc)
