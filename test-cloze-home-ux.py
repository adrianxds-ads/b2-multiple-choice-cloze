"""Regression for the home-only visual refinement; no personal browser data is loaded."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
import json,sys
ROOT=Path(__file__).resolve().parent
URL='https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=home-ux-review'
errors=[]
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='msedge')
 for width,height in [(360,740),(390,844),(412,915)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},service_workers='block')
  page=ctx.new_page()
  javascript_errors=[]
  page.on('pageerror',lambda e:javascript_errors.append(str(e)))
  def routefn(route):
   u=urlparse(route.request.url)
   f=ROOT/(u.path.split('/')[-1] or 'index.html')
   if u.path.startswith('/b2-multiple-choice-cloze/') and f.is_file():
    mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}.get(f.suffix,'application/octet-stream')
    route.fulfill(path=str(f),content_type=mime)
   else: route.continue_()
  page.route('**/b2-multiple-choice-cloze/**',routefn)
  page.goto(URL,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function("typeof BANK!=='undefined'&&BANK.length===900",timeout=45000)
  page.wait_for_timeout(200)
  home=page.evaluate("""() => {
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),width:Math.round(r.width)}};
    const textFits=id=>{const e=document.getElementById(id).querySelector('b');const css=getComputedStyle(e);return e.scrollWidth<=e.clientWidth+1 && css.fontSize};
    return {width:innerWidth,scrollX:document.documentElement.scrollWidth-innerWidth,
      primary:box('#startBtn'),mode:box('.read-first-row'),stats:box('#statsBtn'),coach:box('#coachBtn'),progress:box('.home-details'),
      statsTitle:document.querySelector('#statsBtn b').innerText,coachTitle:document.querySelector('#coachBtn b').innerText,
      statsFits:textFits('statsBtn'),coachFits:textFits('coachBtn'),
      heading:document.querySelector('.subtitle').innerText,metadata:document.querySelector('.meta').innerText,
      toolbar:box('.adrian-tools')};
  }""")
  if home['scrollX']>0 or home['primary']['bottom']>=height or home['stats']['top']!=home['coach']['top'] or home['stats']['height']>90 or home['stats']['height']<48 or home['progress']['top']>height:
   errors.append(f'home geometry {width}: {home}')
  if not home['statsFits'] or not home['coachFits']:errors.append(f'Title clipping: {width}')
  if page.locator('#exportBtn').is_visible():errors.append('Backup controls should be collapsed on Home '+str(width))
  page.locator('.home-details:not(#homeLearningExtras) > summary').click()
  if not all(page.locator('#'+id).is_visible() for id in ('exportBtn','importBtn','resetBtn')):errors.append('Backup controls unavailable on expansion '+str(width))
  page.locator('.home-details:not(#homeLearningExtras) > summary').click()
  old=page.locator('#readFirstToggle').get_attribute('aria-pressed')
  page.locator('#readFirstToggle').click()
  new=page.locator('#readFirstToggle').get_attribute('aria-pressed')
  help_text=page.locator('#readFirstHelp').inner_text()
  if old==new or 'inmediatamente' not in help_text:errors.append('Mode toggle failed '+str(width))
  page.locator('#readFirstToggle').click()
  if 'Enunciado primero' not in page.locator('#readFirstHelp').inner_text():errors.append('Read first help not restored '+str(width))
  page.locator('#statsBtn').click()
  if not page.locator('#statsScreen').is_visible():errors.append('Stats navigation failed '+str(width))
  page.locator('#statsTopDashboardBtn').click()
  if not page.locator('#startScreen').is_visible():errors.append('Stats back failed '+str(width))
  page.locator('#coachBtn').click()
  if not page.locator('#coachScreen').is_visible():errors.append('Coach navigation failed '+str(width))
  page.locator('#coachTopDashboardBtn').click()
  if not page.locator('#startScreen').is_visible():errors.append('Coach back failed '+str(width))
  page.locator('.cloze-nav-toggle').click()
  count=page.evaluate("""()=>[...document.querySelectorAll('.adrian-tools button,.adrian-tools a')].filter(x=>{let r=x.getBoundingClientRect();return r.width>0&&r.height>=42}).length""")
  if count<7:errors.append('Toolbar actions lost '+str(width))
  page.locator('.cloze-nav-toggle').click()
  page.locator('#startBtn').click()
  page.wait_for_function("typeof session!=='undefined'&&session&&session.plan?.length===15",timeout=20000)
  page.wait_for_function("document.getElementById('gameScreen') && !document.getElementById('gameScreen').classList.contains('hidden')",timeout=18000)
  game=page.evaluate("""()=>{
    const buttons=[...document.querySelectorAll('#answers button.answer')];
    return {n:buttons.length,limit:currentTimeLimitSec,storageKey:typeof STORAGE_KEY==='string'?STORAGE_KEY:'',
     gameVisible:!document.getElementById('gameScreen').classList.contains('hidden')};
  }""")
  if game['n']!=4 or not game['gameVisible'] or game['limit']<16:errors.append('Quiz regression '+str(width)+': '+str(game))
  page.locator('#abortSessionBtn').click()
  if not page.locator('#startScreen').is_visible():errors.append('Exit failed '+str(width))
  if javascript_errors:errors.append('JS errors '+str(width)+': '+str(javascript_errors[:2]))
  results.append({'viewport':f'{width}x{height}','home':home,'toolbarActions':count,'game':game,'jsErrors':javascript_errors})
  ctx.close()
 browser.close()
print(json.dumps({'pass':not errors,'results':results,'errors':errors},ensure_ascii=True))
sys.exit(bool(errors))
