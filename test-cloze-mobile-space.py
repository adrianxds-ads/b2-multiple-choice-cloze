from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
import json,sys,time

BASE='https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=mobile-space-20261022'
roots={'after':Path(__file__).resolve().parent}
vp_list=[(360,740),(412,780),(412,915),(390,650)]
results=[]; errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='msedge')
 for name,root in roots.items():
  for width,height in vp_list:
   context=browser.new_context(viewport={'width':width,'height':height},service_workers='block')
   page=context.new_page()
   js_errors=[]
   page.on('pageerror',lambda exc:js_errors.append(str(exc)))
   def intercept(route):
    u=urlparse(route.request.url)
    f=root/(u.path.split('/')[-1] or 'index.html')
    if u.path.startswith('/b2-multiple-choice-cloze/') and f.is_file():
     mime={'js':'application/javascript','css':'text/css','json':'application/json','html':'text/html','webmanifest':'application/manifest+json','png':'image/png','svg':'image/svg+xml'}.get(f.suffix.lstrip('.'),'application/octet-stream')
     route.fulfill(path=str(f),content_type=mime)
    else:
     route.continue_()
   page.route('**/b2-multiple-choice-cloze/**',intercept)
   page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
   page.wait_for_function("typeof BANK!=='undefined'&&BANK.length===900",timeout=45000)
   page.wait_for_selector('.adrian-tools',timeout=20000)
   page.wait_for_timeout(350)
   home=page.evaluate("""() => {
     const r=s=>{const el=document.querySelector(s);if(!el)return null;const x=el.getBoundingClientRect();return {y:Math.round(x.y),bottom:Math.round(x.bottom),h:Math.round(x.height),display:getComputedStyle(el).display}};
     return {toolbar:r('.adrian-tools'),menu:r('.cloze-nav-toggle'),app:r('.app'),start:r('#startScreen'),scrollX:document.documentElement.scrollWidth-innerWidth,
       text:document.querySelector('#startScreen .meta')?.innerText||'',
       help:document.querySelector('.read-first-row small')?.innerText||''};
   }""")
   expanded=None
   if name=='after':
    page.locator('.cloze-nav-toggle').click()
    expanded=page.evaluate("""() => {
     const bar=document.querySelector('.adrian-tools');
     const controls=[...bar.querySelectorAll('button,a')].filter(x=>x.className!=='cloze-nav-toggle');
     return {open:bar.classList.contains('cloze-nav-open'),expanded:bar.querySelector('.cloze-nav-toggle')?.getAttribute('aria-expanded'),
       labels:controls.map(x=>x.innerText.trim()).filter(Boolean),visible:controls.filter(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>0).length};
    }""")
    page.locator('.cloze-nav-toggle').click()
    if not expanded['open'] or expanded['expanded']!='true' or expanded['visible']<4:errors.append(f'{width} menu failed: {expanded}')
    if home['toolbar']['h']>52:errors.append(f'{width} compact home toolbar too high: {home}')
    if 'tiempo adaptado' not in home['text'] or '15 segundos' in home['text']:errors.append('stale timer UI text')
   if name=='after':
    page.locator('#readFirstToggle').click()
    helpnow=page.locator('#readFirstHelp').inner_text()
    if 'inmediatamente' not in helpnow: errors.append('Mode help does not switch')
    page.locator('#readFirstToggle').click()
    if 'Enunciado primero' not in page.locator('#readFirstHelp').inner_text():errors.append('Mode help not restored')
   page.locator('#startBtn').click()
   page.wait_for_function("document.getElementById('gameScreen')&&!document.getElementById('gameScreen').classList.contains('hidden')",timeout=20000)
   page.wait_for_timeout(450)
   game=page.evaluate("""() => {
     session.plan[0]=shuffleOptions(BANK.find(q=>q.id===962028));
     session.index=0;showScreen('gameScreen');nextQuestion();window.QuizErgonomics?.sync?.();
     const box=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {y:Math.round(r.y),bottom:Math.round(r.bottom),h:Math.round(r.height),display:getComputedStyle(el).display}};
     const q=document.querySelector('#questionText');
     return {toolbar:box('.adrian-tools'),game:box('#gameScreen'),prompt:box('#questionText'),timer:box('.timer-footer'),exit:box('#abortSessionBtn'),
       limit:currentTimeLimitSec,badge:!!q.querySelector('.qe-keyword-badge'),options:document.querySelectorAll('#answers button.answer').length,
       scrollX:document.documentElement.scrollWidth-innerWidth,scrollY:document.documentElement.scrollHeight-innerHeight,
       clipped:q.scrollHeight>q.clientHeight+2&&getComputedStyle(q).overflow==='hidden'};
   }""")
   if name=='after':
    if game['toolbar']['display']!='none' or game['toolbar']['h']>0:errors.append(f'{width} toolbar shown in game: {game}')
    if game['options']!=4 or not game['badge'] or game['limit']<26 or game['clipped']:errors.append(f'{width} regression: {game}')
    if game['timer']['bottom']>height+2 or game['exit']['bottom']>height+2 or game['scrollY']>2:errors.append(f'{width} game overflow: {game}')
    if home['scrollX']>0 or game['scrollX']>0:errors.append(f'{width} horizontal scroll found')
    page.locator('#abortSessionBtn').click()
    page.wait_for_timeout(120)
    if not page.locator('.cloze-nav-toggle').is_visible():errors.append(f'{width} menu inaccessible after exiting game')
   results.append({'viewport':f'{width}x{height}','toolbar_before':home['toolbar']['h'],'toolbar_game':game['toolbar']['h'],'original_controls_visible':expanded['visible'],'game_bottom':game['exit']['bottom'],'time_limit':game['limit'],'jsErrors':js_errors[:2]})
   if js_errors:errors.append(f'{name}:{width} pageerrors {js_errors[:3]}')
   context.close()
 browser.close()
print(json.dumps({'pass':len(errors)==0,'results':results,'errors':errors},ensure_ascii=True))
sys.exit(1 if errors else 0)
