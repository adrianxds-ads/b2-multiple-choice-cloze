from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
from pathlib import Path
import json,sys
root=Path(__file__).resolve().parent
sizes=[(320,690),(360,740),(390,844),(412,915)]
results=[];issues=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='msedge')
 for w,h in sizes:
  ctx=browser.new_context(viewport={'width':w,'height':h},service_workers='block')
  page=ctx.new_page()
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  def routefn(route):
   u=urlparse(route.request.url)
   f=root/(u.path.split('/')[-1] or 'index.html')
   if u.path.startswith('/b2-multiple-choice-cloze/') and f.is_file():
    mime={'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}.get(f.suffix,'application/octet-stream')
    route.fulfill(path=str(f),content_type=mime)
   else:route.continue_()
  page.route('**/b2-multiple-choice-cloze/**',routefn)
  page.goto('https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=gemini-ux',wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function("typeof BANK !== 'undefined' && BANK.length===900",timeout=45000)
  before=page.evaluate("""()=>{
    const rect=s=>{const x=document.querySelector(s);if(!x)return null;const r=x.getBoundingClientRect();return {y:Math.round(r.y),bottom:Math.round(r.bottom),height:Math.round(r.height),width:Math.round(r.width)}};
    const elements=['#startBtn','#statsBtn','#coachBtn','#homeLearningExtras','.home-details','#releaseInfo'];
    return {pageHeight:document.documentElement.scrollHeight,overhang:document.documentElement.scrollHeight-innerHeight,
      extrasOpen:document.getElementById('homeLearningExtras').open,extrasVisible:document.querySelector('.daily-key-section').checkVisibility({checkVisibilityCSS:true}),
      items:Object.fromEntries(elements.map(s=>[s,rect(s)])),cardStyles:['statsBtn','coachBtn'].map(id=>{const e=document.getElementById(id),st=getComputedStyle(e);return {display:st.display,minHeight:st.minHeight,maxHeight:st.maxHeight,height:st.height,clip:e.scrollHeight>e.clientHeight+1};}),
      horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
  }""")
  page.locator('.cloze-nav-toggle').click()
  nav=page.evaluate("""()=>[...document.querySelectorAll('.adrian-tools button,.adrian-tools a')].filter(x=>x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).map(x=>{const r=x.getBoundingClientRect();return {label:x.textContent.trim(),height:Math.round(r.height),scroll:x.scrollWidth,client:x.clientWidth,wrap:getComputedStyle(x).whiteSpace,over:x.scrollWidth>x.clientWidth+2}})""")
  page.locator('.cloze-nav-toggle').click()
  # Seed one valid learning key only inside this disposable test browser
  # so we can test the diary interaction even without the user's progress.
  page.evaluate('''() => {
    const today=localDateKey();
    const key=CAMPAIGN.skills.find(x=>window.AE_KEYS?.[x.id]) || {id:Object.keys(window.AE_KEYS||{})[0]};
    if(!key)throw Error('No campaign key found');
    state.keyring=[{cat:key.id,number:1,firstDate:today,lastDate:today,exposures:1}];
    state.keyJourneyStart=today;
    state.dailyKey={date:today,cat:key.id};
    window.renderDailyKey();
  }''')
  page.locator('#homeLearningExtras > summary').click()
  page.wait_for_timeout(240)
  extras=page.evaluate("""()=>{
    const d=document.getElementById('homeLearningExtras');
    const host=document.getElementById('dailyKeyHost');
    const car=document.getElementById('keyCarousel');
    const tree=document.querySelector('#growthTreeHost svg');
    return {open:d.open,diaryWidth:Math.round(document.querySelector('.daily-key-section').getBoundingClientRect().width),diaryVisible:document.querySelector('.daily-key-section').getBoundingClientRect().height>0,
     treeVisible:document.querySelector('.growth-tree-section').getBoundingClientRect().height>0,hasTree:!!tree,hasCarousel:!!car,cardCount:host.querySelectorAll('button.daily-key-card').length,
     carouselClientWidth:car?.clientWidth||0,globalRenderer:typeof window.renderDailyKey};
  }""")
  # Ensure the content remains functional, not just visible.
  if extras['cardCount']:
   page.locator('#dailyKeyHost button.daily-key-card').first.click()
   if not page.locator('#dailyKeyHost button.daily-key-card').first.get_attribute('aria-expanded')=='true':
    issues.append(f'{w}: diary card did not flip')
  page.locator('#homeLearningExtras > summary').click()
  page.locator('#startBtn').click()
  page.wait_for_function("typeof session !== 'undefined' && session && session.plan?.length===15",timeout=22000)
  page.wait_for_function("!document.getElementById('gameScreen').classList.contains('hidden')",timeout=20000)
  game=page.evaluate("""()=>{
   const buttons=document.querySelectorAll('#answers button.answer').length;
   const limit=currentTimeLimitSec;
   return {buttons,limit,visible:!document.getElementById('gameScreen').classList.contains('hidden')};
  }""")
  page.locator('#abortSessionBtn').click()
  if before['extrasOpen'] or before['extrasVisible'] or before['horizontalOverflow']>0:issues.append(f'{w}: collapsed / overflow failure: {before}')
  if not all(x['display']=='flex' and x['maxHeight']=='none' and not x['clip'] for x in before['cardStyles']):issues.append(f'{w}: card flex sizing {before["cardStyles"]}')
  if len(nav)!=7 or any(x['over'] or x['height']<44 for x in nav):issues.append(f'{w}: nav overflow {nav}')
  if not extras['open'] or not extras['diaryVisible'] or not extras['treeVisible'] or not extras['hasTree'] or not extras['hasCarousel'] or extras['carouselClientWidth']<=0:issues.append(f'{w}: extras unavailable {extras}')
  if not game['visible'] or game['buttons']!=4 or game['limit']<16:issues.append(f'{w}: game regression {game}')
  if errors:issues.append(f'{w}: javascript {errors[:3]}')
  results.append({'viewport':f'{w}x{h}','home':before,'nav':nav,'extras':extras,'game':game,'jsErrors':errors[:2]})
  ctx.close()
 browser.close()
print(json.dumps({'pass':not issues,'results':results,'issues':issues},ensure_ascii=True))
sys.exit(bool(issues))
