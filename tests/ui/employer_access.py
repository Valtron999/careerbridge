from playwright.sync_api import sync_playwright
BASE='http://localhost:3120'; fails=[]
def check(n, ok, d=''):
    print(('PASS ' if ok else 'FAIL ')+n+(f'  [{d}]' if d else ''))
    if not ok: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (320, 390, 768, 1280):
        ctx=b.new_context(viewport={'width':w,'height':800}); pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        for path in ('/employers', '/auth/login?type=employer', '/auth/signup?type=employer'):
            pg.goto(BASE+path, wait_until='networkidle'); sw=pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
            check(f'{w}px {path} no horizontal overflow', sw[0]<=sw[1], str(sw))
        check(f'{w}px no JS errors', not errs, '; '.join(errs)[:100]); ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page()
    pg.goto(BASE+'/employers', wait_until='networkidle')
    check('Employers page is real content, not "Coming soon"', pg.get_by_role('heading', level=1).inner_text().startswith('Hire interns') and pg.get_by_text('Coming soon').count()==0)
    hrefs={a.inner_text().strip(): a.get_attribute('href') for a in pg.get_by_role('link').all() if a.inner_text().strip() in ('Create employer account','Employer sign in')}
    check('Employers page links to employer sign-up and sign-in', hrefs.get('Create employer account')=='/auth/signup?type=employer' and hrefs.get('Employer sign in')=='/auth/login?type=employer', str(hrefs))
    pg.get_by_role('link', name='Employer sign in').first.click(); pg.wait_for_url('**/auth/login**')
    check('Employer sign in page has its own heading and sign-up link', pg.get_by_role('heading', level=1).inner_text()=='Employer sign in' and pg.get_by_role('link', name='Create an employer account').get_attribute('href')=='/auth/signup?type=employer')
    check('Employer sign-in form posts next=/employer', pg.locator('input[name=next]').input_value()=='/employer')
    check('Employer sign-in offers a way back to student sign-in', pg.get_by_role('link', name='Student and job seeker sign in').count()==1)
    pg.goto(BASE+'/auth/signup?type=employer', wait_until='networkidle')
    check('Employer sign-up is titled and preselected', pg.get_by_role('heading', level=1).inner_text()=='Create an employer account' and pg.locator('input[name=account_type][value=employer]').is_checked())
    check('Employer sign-up links back to the employer sign-in', pg.locator('main').get_by_role('link', name='Sign in', exact=True).get_attribute('href')=='/auth/login?type=employer')
    pg.goto(BASE+'/auth/login', wait_until='networkidle')
    check('Student sign-in links to employer sign-in', pg.get_by_role('link', name='Employer sign in').first.get_attribute('href')=='/auth/login?type=employer')
    check('Student sign-in posts next=/dashboard', pg.locator('input[name=next]').input_value()=='/dashboard')
    r=pg.request.get(BASE+'/admin', max_redirects=0); loc=r.headers.get('location','')
    check('Signed-out /admin redirects to sign-in with next=/admin', r.status in (307,308) and 'next=%2Fadmin' in loc and '/auth/login' in loc, f'{r.status} {loc[-40:]}')
    pg.goto(BASE+'/auth/login?next=%2Fadmin', wait_until='networkidle')
    check('That sign-in page is the admin sign-in', pg.get_by_role('heading', level=1).inner_text()=='Admin sign in' and pg.locator('input[name=next]').input_value()=='/admin')
    pg.goto(BASE+'/auth/login?next=https://evil.example', wait_until='networkidle'); check('open redirect target is ignored', pg.locator('input[name=next]').input_value()=='/dashboard')
    pg.goto(BASE+'/', wait_until='networkidle'); links={a.inner_text().strip(): a.get_attribute('href') for a in pg.locator('footer a').all()}
    check('footer has employer sign-in, employer sign-up and staff sign-in', links.get('Employer Sign In')=='/auth/login?type=employer' and links.get('Create Employer Account')=='/auth/signup?type=employer' and links.get('Staff sign in')=='/admin', str({k:v for k,v in links.items() if 'ign' in k or 'mployer' in k}))
    bad=[]
    for h in sorted(set(a.get_attribute('href') for a in pg.locator('footer a').all() if a.get_attribute('href').startswith('/'))):
        s=pg.request.get(BASE+h, max_redirects=0).status
        if s>=400: bad.append(f'{h}:{s}')
    check('every footer link resolves', not bad, ', '.join(bad))
    b.close()
print('FAILED:', fails or 'none')
