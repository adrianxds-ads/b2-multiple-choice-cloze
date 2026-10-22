from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
import json,sys

ROOT=Path(__file__).resolve().parent
BASE='https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=109961'
VIEWPORTS=[(360,740),(412,780),(412,915),(390,650)]
results=[];errors=[]

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='msedge')
 for width,height in VIEWPORTS:
  context=browser.new_context(viewport={'width':width,'height':height},service_workers='block')
  page=context.new_page()
  js_errors=[]
  page.on('pageerror',lambda exc:js_errors.append(str(exc)))
  def intercept(route):
   uri=urlparse(route.request.url)
   f=ROOT/(uri.path.split('/')[-1] or 'index.html')
   if uri.path.startswith('/b2-multiple-choice-cloze/') and f.is_file():
    typ={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}.get(f.suffix,'application/octet-stream')
    route.fulfill(path=str(f),content_type=typ)
   else:route.continue_()
  page.route('**/b2-multiple-choice-cloze/**',intercept)
  page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function("typeof BANK!=='undefined'&&BANK.length===900",timeout=45000)
  page.wait_for_selector('.cloze-nav-toggle',timeout=20000)
  closed=page.locator('.adrian-tools').bounding_box()
  if not closed or closed['height']>52:errors.append(f'{width}: compact initial bar exceeds 52px')
  page.locator('.cloze-nav-toggle').click()
  menu=page.evaluate("""()=>{
    const bar=document.querySelector('.adrian-tools');
    const visible=[...bar.querySelectorAll('button,a')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width>=42 && r.height>=42 && getComputedStyle(e).display!=='none';
    });
    const rects=visible.map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.y),Math.round(r.height),e.textContent.trim().slice(0,16)]});
    return {height:Math.round(bar.getBoundingClientRect().height),open:bar.classList.contains('cloze-nav-open'),items:rects};
  }""")
  rows={}
  for y,h,name in menu['items']:
    rows[y]=rows.get(y,0)+1
    if h<44 or h>47:errors.append(f'{width}: bad menu control height {name}: {h}')
  if len(menu['items'])!=7 or sorted(rows.values())!=[3,4] or menu['height']>115:
    errors.append(f'{width}: menu grid incorrect {menu}')
  page.locator('.cloze-nav-toggle').click()
  page.locator('#startBtn').click()
  page.wait_for_function("typeof session!=='undefined'&&session&&session.plan?.length===15",timeout=15000)
  page.wait_for_function("document.getElementById('missionOverlay')?.classList.contains('hidden')",timeout=16000)
  page.evaluate("""()=>{
    session.plan[0]=shuffleOptions(BANK.find(x=>x.sourcePart===4&&x.keyword==='FACT'));
    session.index=0;showScreen('gameScreen');nextQuestion();window.QuizErgonomics?.sync?.();
  }""")
  page.wait_for_timeout(1100)
  geo=page.evaluate("""()=>{
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),display:getComputedStyle(e).display}};
    const q=document.querySelector('#questionText');
    return {part:document.body.dataset.questionPart,bodyBg:getComputedStyle(document.body).backgroundColor,gameBg:getComputedStyle(document.querySelector('#gameScreen')).backgroundColor,
      screen:box('#gameScreen'),timer:box('.timer-footer'),exit:box('#abortSessionBtn'),toolbar:box('.adrian-tools'),
      options:document.querySelectorAll('#answers button.answer').length,badge:!!q.querySelector('.qe-keyword-badge'),
      limit:currentTimeLimitSec,overflowY:document.documentElement.scrollHeight-innerHeight,overflowX:document.documentElement.scrollWidth-innerWidth};
  }""")
  im=Image.open(BytesIO(page.screenshot(full_page=False))).convert('RGB')
  px=im.getpixel((width//2,height-23))
  light=(238,242,246)
  if geo['bodyBg']!='rgb(238, 242, 246)' or px!=light:
    errors.append(f'{width}: Part4 bottom paint unexpected: computed {geo["bodyBg"]}, pixel {px}')
  if geo['part']!='4' or geo['options']!=4 or not geo['badge'] or geo['limit']<26:
    errors.append(f'{width}: Part4 state regression: {geo}')
  if geo['timer']['bottom']>height+2 or geo['exit']['bottom']>height+2 or geo['overflowX']>0 or geo['overflowY']>2:
    errors.append(f'{width}: layout overflow {geo}')
  page.locator('#abortSessionBtn').click()
  page.wait_for_timeout(100)
  back=page.evaluate("""()=>({menu:!!document.querySelector('.cloze-nav-toggle')?.getBoundingClientRect().height,
    bodyBackground:getComputedStyle(document.body).backgroundColor})""")
  if not back['menu'] or back['bodyBackground']=='rgb(238, 242, 246)':
    errors.append(f'{width}: screen cleanup failed {back}')
  if js_errors: errors.append(f'{width}: JS errors {js_errors[:3]}')
  results.append({'viewport':f'{width}x{height}','menuHeightPx':menu['height'],'menuLayout':sorted(rows.values()),'part4BottomRgb':px,
    'part4GameHeightPx':geo['screen']['height'],'timeLimitSec':geo['limit'],'exitBottomPx':geo['exit']['bottom'],'scrollOverhangPx':geo['overflowY'],'errors':js_errors[:2]})
  context.close()
 browser.close()
print(json.dumps({'pass':not errors,'results':results,'errors':errors},ensure_ascii=True))
sys.exit(1 if errors else 0)
