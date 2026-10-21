"""Browser regression for every Part 4 prompt. Requires Python Playwright and Edge.
Uses actual local JS/CSS data under GitHub Pages origin; never touches real user progress.
"""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import json, sys

ROOT = Path(__file__).resolve().parent
BASE = 'https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=block1'
VIEWPORTS = [(360,740),(412,780),(412,915),(390,650)]
results = []
errors = []
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True, channel='msedge')
    for width,height in VIEWPORTS:
        context=browser.new_context(viewport={'width':width,'height':height},service_workers='block')
        page=context.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        def intercept(route):
            uri=urlparse(route.request.url)
            file=ROOT/(uri.path.split('/')[-1] or 'index.html')
            if uri.path.startswith('/b2-multiple-choice-cloze/') and file.is_file():
                typ='application/javascript' if file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'application/json' if file.suffix=='.json' else 'text/html'
                route.fulfill(path=str(file),content_type=typ)
            else:
                route.continue_()
        page.route('**/b2-multiple-choice-cloze/**',intercept)
        page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function("typeof BANK!=='undefined' && BANK.length===900",timeout=45000)
        page.locator('#startBtn').click()
        page.wait_for_function("typeof session!=='undefined' && session && session.plan && session.plan.length===15",timeout=20000)
        state=page.evaluate("""() => {
          showScreen('gameScreen');
          const qlist=BANK.filter(q=>q.sourcePart===4);
          const out=[];
          for(const q of qlist){
            session.plan[0]=shuffleOptions(q);session.index=0;nextQuestion();
            if(typeof revealEarlyOnTap==='function'&&revealEarlyOnTap)revealEarlyOnTap();
            window.QuizErgonomics?.sync?.();
            const box=s=>document.querySelector(s)?.getBoundingClientRect();
            const text=document.getElementById('questionText');
            const timer=box('.timer-footer'),exit=box('#abortSessionBtn');
            const clipped=(getComputedStyle(text).overflow==='hidden') && text.scrollHeight>text.clientHeight+2;
            const code=document.body.dataset.questionPart;
            const font=parseFloat(getComputedStyle(text).fontSize);
            const buttons=[...document.querySelectorAll('#answers button.answer')];
            if(code!=='4'||!text.querySelector('.qe-keyword-badge')||font<17||clipped||buttons.length!==4||!timer||!exit||timer.bottom>innerHeight+2||exit.bottom>innerHeight+2||(innerHeight>=740 && document.documentElement.scrollHeight>innerHeight+2)){
              out.push({id:q.id,code,font,clipped,buttons:buttons.length,doc:Math.round(document.documentElement.scrollHeight),timer:Math.round(timer?.bottom||0),exit:Math.round(exit?.bottom||0)});
            }
          }
          // Regressions: other parts still use genuine text and four choices
          const regress=[];
          for(const part of [1,2,3]) {
            const q=BANK.find(q=>q.sourcePart===part);
            session.plan[0]=shuffleOptions(q);session.index=0;nextQuestion();
            if(typeof revealEarlyOnTap==='function'&&revealEarlyOnTap)revealEarlyOnTap();
            window.QuizErgonomics?.sync?.();
            regress.push({part,buttons:document.querySelectorAll('#answers button.answer').length,badge:!!document.querySelector('#questionText .qe-keyword-badge'),txt:document.querySelector('#questionText').textContent});
          }
          return {total:qlist.length,failures:out,regress};
        }""")
        if state['total']!=180: errors.append(f'Part4 count {state["total"]}')
        if state['failures']: errors.append(f'{width}x{height} failures: {state["failures"][:8]}')
        if any(x['buttons']!=4 or x['badge'] for x in state['regress']): errors.append(f'Parts 1-3 regress {state["regress"]}')
        results.append({'viewport':f'{width}x{height}','checked_part4':state['total'],'problems':len(state['failures']),'regressions_1_to_3':all(x['buttons']==4 and not x['badge'] for x in state['regress'])})
        context.close()
    browser.close()
print(json.dumps({'pass':not errors,'results':results,'errors':errors},ensure_ascii=True))
if errors: sys.exit(1)
