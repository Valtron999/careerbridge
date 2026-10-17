"""Browser checks for the landing page (Playwright). Needs: pip install playwright && playwright install chromium.
Setup: run the database stack with `SERVE=600 python3 tests/integration/run.py`, build and start the app with
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3002 and NEXT_PUBLIC_SUPABASE_ANON_KEY set to an anon-role JWT signed with the harness secret, on port 3120. Then run this file."""
import json, subprocess, sys, re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:3120'
WIDTHS = [320, 360, 375, 390, 430, 640, 768, 1024, 1280]
res = {'fail': [], 'info': []}
def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else '')); 
    if not ok: res['fail'].append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    for w in WIDTHS:
        ctx = b.new_context(viewport={'width': w, 'height': 800}); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(BASE + '/', wait_until='networkidle')
        h = pg.evaluate('document.documentElement.scrollHeight')
        for y in range(0, h + 800, 500): pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(60)
        pg.wait_for_timeout(900)
        sw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
        off = pg.evaluate('''(w) => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.visibility !== 'hidden' && (r.right > w + 1 || r.left < -1) && !e.closest('.sr-only') && !e.closest('datalist') && cs.position !== 'fixed'; }).slice(0, 4).map(e => e.tagName + '.' + String(e.className).slice(0, 40))''', w)
        check(f'{w}px no horizontal overflow', sw[0] <= sw[1] and not off, f'scrollWidth {sw[0]} vs {sw[1]} {off}')
        real = [e for e in errs if 'ERR_NAME_NOT_RESOLVED' not in e and 'ERR_INTERNET_DISCONNECTED' not in e]  # the sandbox has no internet for Google Fonts
        check(f'{w}px no JS errors', not real, '; '.join(real)[:150])
        check(f'{w}px nothing left hidden by reveal', pg.evaluate("document.querySelectorAll('.rv-hide').length") == 0)
        pg.evaluate("window.scrollTo({top: 0, behavior: 'instant'})"); pg.wait_for_timeout(300)
        cta = pg.get_by_role('link', name='Find SIWES & Internships').first.bounding_box(); cv_cta = pg.get_by_role('link', name='Create My CV').first.bounding_box()
        check(f'{w}px both hero CTAs visible without scrolling', cta and cv_cta and cta['y'] >= 0 and cv_cta['y'] >= 0 and cta['y'] + cta['height'] <= 800 and cv_cta['y'] + cv_cta['height'] <= 800 and cta['width'] > 100, f"y={cta['y']:.0f}/{cv_cta['y']:.0f}")
        lefts = pg.evaluate("[...document.querySelectorAll('#start ul > li a')].map(a => Math.round(a.getBoundingClientRect().left))")
        cols = len(set(lefts)); want = 1 if w < 640 else (2 if w < 1024 else 3); check(f'{w}px action cards layout', cols == want, f'{cols} column(s), want {want}')
        cvw = pg.evaluate('''() => { const e = document.querySelector('[aria-label="CV preview"]'); const page = e && e.firstElementChild; if (!page) return null; const r = e.getBoundingClientRect(); const m = new DOMMatrix(getComputedStyle(page).transform); return { w: Math.round(r.width), scale: +m.a.toFixed(2), body: +(parseFloat(getComputedStyle(page).fontSize) * m.a).toFixed(1) }; }''')
        check(f'{w}px CV preview fits', cvw and cvw['w'] <= w, str(cvw)); res['info'].append((w, cvw))
        if w in (375, 1280):
            pg.screenshot(path=f'/tmp/shot-{w}.png', full_page=True)
        ctx.close()

    # interactions at phone size
    ctx = b.new_context(viewport={'width': 375, 'height': 800}); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/', wait_until='networkidle')
    btn = pg.locator('button[aria-controls=mobile-nav]'); btn.click(); pg.wait_for_timeout(150)
    nav = pg.locator('#mobile-nav'); check('mobile menu opens with all items', nav.is_visible() and nav.locator('a').count() >= 6 and btn.get_attribute('aria-expanded') == 'true', f"{nav.locator('a').count()} links")
    box = nav.bounding_box(); check('mobile menu stays inside the screen', box['x'] >= 0 and box['x'] + box['width'] <= 375.5)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150); check('Escape closes the menu', not nav.is_visible() and btn.get_attribute('aria-expanded') == 'false')
    btn.click(); pg.locator('#mobile-nav').get_by_role('link', name='CV Builder').click(); pg.wait_for_url('**/cv-builder'); check('menu link navigates to the CV builder', pg.url.endswith('/cv-builder'))
    pg.goto(BASE + '/', wait_until='networkidle')
    pg.get_by_role('radio', name='SIWES / IT', exact=True).check(force=True); pg.get_by_placeholder('Course, skill or company').fill('computer'); pg.get_by_placeholder('City, state, or remote').fill('abuja')
    pg.get_by_role('button', name='Search', exact=True).click(); pg.wait_for_url('**/jobs?**')
    check('hero search sends type, keyword and location to /jobs', all(s in pg.url for s in ['type=siwes', 'q=computer', 'location=abuja']), pg.url.replace(BASE, ''))
    check('search results page shows the SIWES filter selected', pg.locator('#type').input_value() == 'siwes')
    check('search finds the matching placement', pg.get_by_text('Software Engineering Placement').count() >= 1)
    pg.goto(BASE + '/', wait_until='networkidle'); pg.get_by_role('radio', name='Entry-level jobs').check(force=True); pg.get_by_role('button', name='Search', exact=True).click(); pg.wait_for_url('**/jobs?**')
    check('entry-level search shows only entry-level jobs', pg.get_by_text('Data Analyst').count() >= 1 and pg.get_by_text('Remote Support Agent').count() >= 1 and pg.get_by_text('Software Engineering Placement').count() == 0)
    pg.goto(BASE + '/', wait_until='networkidle')
    first = pg.locator('details summary').first; first.click(); check('FAQ opens', pg.locator('details').first.get_attribute('open') is not None)
    pg.get_by_role('button', name='Modern graduate').click(); check('CV template switch works', pg.get_by_role('button', name='Modern graduate').get_attribute('aria-pressed') == 'true')
    check('no errors during interactions', not errs, '; '.join(errs)[:120]); ctx.close()

    # every internal link on the page resolves
    ctx = b.new_context(); pg = ctx.new_page(); pg.goto(BASE + '/', wait_until='networkidle')
    hrefs = sorted(set(pg.evaluate("[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h.startsWith('/') && !h.startsWith('//'))")))
    bad = []
    for h in hrefs:
        r = pg.request.get(BASE + h, max_redirects=0)
        if r.status >= 400: bad.append(f'{h} -> {r.status}')
    check(f'all {len(hrefs)} internal links on the landing page resolve', not bad, '; '.join(bad)); ctx.close()

    # reduced motion and no-JS
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, reduced_motion='reduce'); pg = ctx.new_page(); pg.goto(BASE + '/', wait_until='networkidle'); h = pg.evaluate('document.documentElement.scrollHeight')
    anim = pg.evaluate("getComputedStyle(document.querySelector('h1')).animationName"); hidden = pg.evaluate("document.querySelectorAll('.rv-hide').length"); op = pg.evaluate("getComputedStyle(document.querySelector('#start ul li a')).opacity")
    check('reduced motion: no entrance animation and nothing hidden', anim in ('none', '') and hidden == 0 and op == '1', f'anim={anim} hidden={hidden}'); ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, java_script_enabled=False); pg = ctx.new_page(); pg.goto(BASE + '/')
    check('without JavaScript the content is still visible', pg.get_by_role('heading', level=1).is_visible() and pg.locator('#start ul li a').first.is_visible() and pg.get_by_role('button', name='Search', exact=True).is_visible()); ctx.close()
    b.close()
print('\nCV preview sizes (effective body text px):', [(w, c['body']) for w, c in res['info'] if c])
print('FAILED:', res['fail'] or 'none')
