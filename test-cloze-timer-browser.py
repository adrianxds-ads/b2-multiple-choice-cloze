from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
import json,sys
ROOT=Path(r'C:\Users\adria\cloze-variable-timer-20261022')
BASE='https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=timer-20261022'
results=[]
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='msedge')
 for vp in [(360,740),(412,780),(412,915)]:
  context=browser.new_context(viewport={'width':vp[0],'height':vp[1]},service_workers='block')
  context.add_init_script("localStorage.setItem('b2_cloze_read_first_v1','0')")
  page=context.new_page()
  page.on('pageerror',lambda e: errors.append('JS '+str(e)))
  def routefn(route):
   u=urlparse(route.request.url)
   f=ROOT/(u.path.split('/')[-1] or 'index.html')
   if u.path.startswith('/b2-multiple-choice-cloze/') and f.exists():
    tp='application/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'application/json' if f.suffix=='.json' else 'text/html'
    route.fulfill(path=str(f),content_type=tp)
   else: route.continue_()
  page.route('**/b2-multiple-choice-cloze/**',routefn)
  page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function("typeof BANK!=='undefined' && BANK.length===900",timeout=45000)
  page.locator('#startBtn').click()
  page.wait_for_function("typeof session!=='undefined' && session && session.plan && session.plan.length===15",timeout=15000)
  block=[]
  for part in (1,2,3,4):
   result=page.evaluate("""part=>{
      clearInterval(timerHandle);
      session.plan[0]=shuffleOptions(BANK.find(q=>q.sourcePart===part && (part!==4||q.id===962028)));
      session.index=0;
      showScreen('gameScreen');nextQuestion();
      window.QuizErgonomics.sync();
      const lim=currentTimeLimitSec;
      const b=document.querySelector('.timer-footer');
      const r=s=>{const rect=document.querySelector(s)?.getBoundingClientRect();return rect?Math.round(rect.bottom):null;};
      return {part,limit:lim,shown:document.getElementById('timerText').textContent,bars:document.querySelectorAll('#segments > i').length,budget:Number(b.querySelector('.timer-bar-bg').getAttribute('aria-valuemax')),footer:b.querySelector('strong').textContent,partDataset:document.body.dataset.questionPart,documentHeight:document.documentElement.scrollHeight,exit:r('#abortSessionBtn'),timer:r('.timer-footer'),question:document.querySelector('#questionText').textContent};
   }""",part)
   if not (result['limit']>=16 and result['limit']<=42 and abs(float(result['shown'])-result['limit'])<.1 and result['bars']==20 and result['budget']==result['limit'] and result['partDataset']==str(part) and (part!=4 or (result['exit']<=vp[1]+2 and result['timer']<=vp[1]+2 and result['documentHeight']<=vp[1]+2))):
    errors.append('layout '+str(vp)+' '+str(result))
   block.append({k:result[k] for k in ('part','limit','shown','bars','budget','documentHeight','timer','exit')})
  q=page.evaluate("""()=>{session.index=0;session.plan[0]=shuffleOptions(BANK.find(x=>x.id===962028));showScreen('gameScreen');nextQuestion();return {limit:currentTimeLimitSec,started:deadline};}""")
  page.wait_for_timeout(250)
  tick=page.evaluate("""()=>({remaining:parseFloat(document.getElementById('timerText').textContent),limit:currentTimeLimitSec})""")
  if not tick['remaining']<q['limit']:errors.append('Timer not decrementing '+str(vp)+' '+str(tick))
  page.locator('#answers button.answer').first.click()
  record=page.evaluate("""()=>({last:session.records[session.records.length-1],count:session.records.length})""")
  if not (record['count']>0 and record['last']['timeLimitSec']==q['limit'] and record['last']['timerModelVersion']==1 and record['last']['sourcePart']==4 and record['last']['ms']<q['limit']*1000):errors.append('record mismatched '+str(vp)+' '+str(record))
  page.evaluate("""()=>{session.index=0;session.plan[0]=shuffleOptions(BANK.find(x=>x.sourcePart===1));showScreen('gameScreen');nextQuestion();deadline=performance.now()-1;}""")
  page.wait_for_timeout(200)
  timeout=page.evaluate("""()=>({r:session.records[session.records.length-1],limit:currentTimeLimitSec})""")
  if not (timeout['r']['type']=='timeout' and timeout['r']['timeLimitSec']==timeout['limit'] and timeout['r']['ms']==timeout['limit']*1000):errors.append('timeout logic '+str(vp)+' '+str(timeout))
  results.append({'viewport':vp,'parts':block,'answer_record':{'timeLimitSec':record['last']['timeLimitSec'],'ms':record['last']['ms']},'timeout_record':{'timeLimitSec':timeout['r']['timeLimitSec'],'type':timeout['r']['type']}})
  context.close()
 browser.close()
print(json.dumps({'pass':len(errors)==0,'results':results,'errors':errors},ensure_ascii=True))
sys.exit(1 if errors else 0)
