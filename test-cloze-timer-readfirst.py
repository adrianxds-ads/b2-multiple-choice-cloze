from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
import json,sys
ROOT=Path(r'C:\Users\adria\cloze-variable-timer-20261022')
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,channel='msedge')
 page=b.new_page(viewport={'width':390,'height':780},service_workers='block')
 def routefn(route):
  u=urlparse(route.request.url); f=ROOT/(u.path.split('/')[-1] or 'index.html')
  if u.path.startswith('/b2-multiple-choice-cloze/') and f.exists():
   typ='application/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'application/json' if f.suffix=='.json' else 'text/html'
   route.fulfill(path=str(f),content_type=typ)
  else: route.continue_()
 page.route('**/b2-multiple-choice-cloze/**',routefn)
 page.goto('https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=readfirst-20261022',wait_until='domcontentloaded',timeout=45000)
 page.wait_for_function("typeof BANK!=='undefined'&&BANK.length===900",timeout=45000)
 page.locator('#startBtn').click()
 page.wait_for_function("typeof session!=='undefined'&&session&&session.plan&&session.plan.length===15",timeout=15000)
 initial=page.evaluate("""() => {
  if(!readFirstMode)toggleReadFirstMode();
  session.plan[0]=shuffleOptions(BANK.find(x=>x.id===962028));session.index=0;
  showScreen('gameScreen');nextQuestion();window.QuizErgonomics.sync();
  return {limit:currentTimeLimitSec,preRead:currentPreReadMs,hidden:document.querySelector('#answers').classList.contains('read-first-hidden'),disabled:[...document.querySelectorAll('#answers button.answer')].every(x=>x.disabled),deadline:deadline,skip:!document.querySelector('.nucleo-read-skip')?.hidden};
 }""")
 if not(initial['limit']>=26 and initial['preRead']>=5000 and initial['hidden'] and initial['disabled'] and initial['deadline']==0 and initial['skip']):errors.append('read-first initial '+str(initial))
 page.locator('.nucleo-read-skip').click()
 page.wait_for_timeout(250)
 after=page.evaluate("""()=>({limit:currentTimeLimitSec,deadline,hidden:document.querySelector('#answers').classList.contains('read-first-hidden'),disabled:[...document.querySelectorAll('#answers button.answer')].some(x=>x.disabled),remaining:parseFloat(document.querySelector('#timerText').textContent),preReadMs:currentPreReadMs})""")
 if not(after['limit']==initial['limit'] and after['deadline']>0 and not after['hidden'] and not after['disabled'] and after['remaining']<=after['limit'] and after['remaining']>after['limit']-1.5):errors.append('read-first after '+str(after))
 b.close()
print(json.dumps({'pass':not errors,'initial':initial,'after':after,'errors':errors},ensure_ascii=True))
sys.exit(bool(errors))
