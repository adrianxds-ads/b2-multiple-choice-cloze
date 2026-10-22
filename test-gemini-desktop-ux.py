from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import json,sys
ROOT=Path(__file__).resolve().parent
rows=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,channel='msedge')
 for w,h in [(800,900),(1280,900)]:
  ctx=b.new_context(viewport={'width':w,'height':h},service_workers='block')
  page=ctx.new_page()
  def route(r):
   u=urlparse(r.request.url);f=ROOT/(u.path.split('/')[-1] or 'index.html')
   if u.path.startswith('/b2-multiple-choice-cloze/') and f.is_file():
    typ={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'}.get(f.suffix,'application/octet-stream')
    r.fulfill(path=str(f),content_type=typ)
   else:r.continue_()
  page.route('**/b2-multiple-choice-cloze/**',route)
  page.goto('https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?qa=desktop',wait_until='domcontentloaded',timeout=40000)
  page.wait_for_function("typeof BANK!=='undefined' && BANK.length===900",timeout=40000)
  page.wait_for_timeout(220)
  state=page.evaluate("""()=>{
    const e=document.querySelector('#homeLearningExtras');
    return {open:e.open,diaryVisible:document.querySelector('.daily-key-section').checkVisibility({checkVisibilityCSS:true}),
      treeVisible:document.querySelector('.growth-tree-section').checkVisibility({checkVisibilityCSS:true}),
      horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
  }""")
  if not(state['open'] and state['diaryVisible'] and state['treeVisible'] and state['horizontalOverflow']<=0):errors.append(f'{w}: {state}')
  rows.append({'size':f'{w}x{h}',**state})
  ctx.close()
 b.close()
print(json.dumps({'pass':not errors,'rows':rows,'errors':errors}))
sys.exit(bool(errors))
