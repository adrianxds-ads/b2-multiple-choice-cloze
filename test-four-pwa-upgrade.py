"""Historical PWA -> candidate update, with REAL old/new service workers and Core sync.
Loopback isolated Edge browser contexts only. No user's actual cookies or storage.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse
import subprocess,sys,json,time,hashlib,os
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parent.parent
CASES=[
 ("cloze","b2-multiple-choice-cloze","_repair_cloze_20261024","b2_cloze_read_first_v1","#startBtn","1.12.7","b2-territorio-1-"),
 ("grammar","adaptive-english","_repair_grammar_20261024","adaptive_english_read_first_v1","#startBtn","3.36.16","ae-campaign1-"),
 ("phrasal","adaptive-phrasal-verbs","_repair_phrasal_20261024","adaptive_phrasal_read_first_v1","#startBtn","0.13.20","apv-"),
 ("classroom","adaptive-pizarras","_repair_classroom_20261024","pizarras_read_first_v1","#quickBtn","3.0.17","pizarras-"),
]
if os.environ.get('HUB_QA_ONLY'):
 CASES=[x for x in CASES if x[0]==os.environ['HUB_QA_ONLY']]
original_sync=subprocess.check_output(["git","-C",str(BASE/"adrian-core"),"show","550f924:components/adrian-sync.js"])
assert hashlib.sha256(original_sync).hexdigest()=="c675d9b7d317249db9ee220b69a51edbde7f40be4d8b6dba18e5161057a3699a"
new_sync=(BASE/"adrian-core/components/adrian-sync.js").read_bytes()
assert hashlib.sha256(new_sync).hexdigest()=="8372851b065489b6a2cec1cc4a9130e936dc858b56fb4d3a6276403fac6d7a5d"
stage={slug:"old" for _,slug,*_ in CASES}
mapping={slug:repair for _,slug,repair,*_ in CASES}
req_log=[]
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  parts=urlparse(path).path.strip("/").split("/")
  if len(parts)<1:return str(BASE/"__missing__")
  slug=parts[0]
  repo=mapping.get(slug)
  if slug=="adrian-core":repo="adrian-core"
  if not repo:return str(BASE/"__missing__")
  if slug!="adrian-core" and stage[slug]=="old":repo=slug
  folder=(BASE/repo).resolve()
  relative=Path(*parts[1:]) if len(parts)>1 and parts[1] else Path("index.html")
  candidate=(folder/relative).resolve()
  return str(candidate) if candidate.is_relative_to(folder) else str(BASE/"__missing__")
 def do_GET(self):
  uri=urlparse(self.path)
  if uri.path=="/adrian-core/components/adrian-sync.js":
   mode="old" if any(x=="old" for x in stage.values()) else "new"
   # When installing the old version, each candidate is tested in its own context.
   # The variable is updated for the active app specifically below.
   sync=original_sync if server.sync_mode=="old" else new_sync
   self.send_response(200);self.send_header("Content-Type","text/javascript")
   self.send_header("Content-Length",str(len(sync)));self.send_header("Cache-Control","no-store");self.end_headers()
   self.wfile.write(sync);return
  return super().do_GET()
 def end_headers(self):
  self.send_header("Cache-Control","no-store")
  super().end_headers()
 def log_message(self,fmt,*args):
  try:
   if self.command=="GET" and int(args[1])>=400:req_log.append(fmt%args)
  except:pass

server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
server.sync_mode="old"
url="http://127.0.0.1:"+str(server.server_port)
thread=Thread(target=server.serve_forever,daemon=True);thread.start()
results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel="msedge")
  for name,slug,repair,read_key,start,new_version,prefix in CASES:
   print("START",name,"old",flush=True)
   stage[slug]="old";server.sync_mode="old"
   ctx=browser.new_context(viewport={"width":412,"height":915},service_workers="allow")
   ctx.add_init_script("localStorage.setItem("+json.dumps(read_key)+",'0')")
   page=ctx.new_page()
   errors=[]
   page.on("pageerror",lambda x:errors.append(str(x)))
   target=url+"/"+slug+"/"
   try:
    page.goto(target+"?old=1",wait_until="domcontentloaded",timeout=50000)
    page.wait_for_function("typeof state!=='undefined' && state!==null",timeout=25000)
    if name=="grammar":
     before_reg=page.evaluate("""async()=>{const r=await navigator.serviceWorker.getRegistration();return {reg:!!r,controller:!!navigator.serviceWorker.controller}}""")
     print("GRAMMAR_REG_BEFORE",json.dumps(before_reg),flush=True)
     if not before_reg["reg"]:
      reg_out=page.evaluate("""async()=>{try {const r=await navigator.serviceWorker.register("./service-worker.js?v=3.36.15",{updateViaCache:"none"});return {scope:r.scope,active:r.active?.state,installing:r.installing?.state}}catch(e){return {error:String(e)}}}""")
      print("GRAMMAR_MANUAL_REGISTER",json.dumps(reg_out),flush=True)
    if name=="grammar":
     try:page.wait_for_function("() => navigator.serviceWorker.controller!==null",timeout=4000)
     except Exception:
      print("GRAMMAR_HISTORICAL_SW_UNAVAILABLE",flush=True)
      await_out=page.evaluate("""async()=>{const r=await navigator.serviceWorker.getRegistration();return r?await r.unregister():false}""")
      print("GRAMMAR_HISTORICAL_UNREGISTERED",await_out,flush=True)
    else:page.wait_for_function("() => navigator.serviceWorker.controller!==null",timeout=50000)
    page.reload(wait_until="domcontentloaded",timeout=40000)
    page.wait_for_function("typeof state!=='undefined' && state!==null",timeout=30000)
    old=page.evaluate("""async () => ({
      appVersion:typeof APP_VERSION==='undefined'?'':APP_VERSION,
      worker:navigator.serviceWorker.controller?.scriptURL,
      caches:(await caches.keys()).filter(x=>!x.includes('durable')),
      completed:state.sessions||0,
      attempts:(state?.history?.length||0)+(state?.answerHistory?.length||0),
      localStorageItems:localStorage.length
    })""")
    page.locator(start).click(timeout=12000)
    page.wait_for_function("""() => session && current &&
       document.querySelectorAll('#answers button.answer:not([disabled])').length===4""",timeout=42000)
    page.locator("#answers button.answer").first.click(timeout=10000)
    page.wait_for_function("""() => session && locked && (session.records?.length ?? session.times?.length ?? session.questionCount ?? 0)>0""",timeout=10000)
    attempts=page.evaluate("""() => ({
      history:state?.history?.length||0,
      answerHistory:state?.answerHistory?.length||0,
      answers:state?.answers||0,totalAttempts:state?.totalAttempts||0,
      sessionRecords:session.records?.length??session.times?.length??session.questionCount,
      level:state.level,storageKeys:Object.keys(localStorage)
    })""")
    page.evaluate("() => {window.__qaOldController=navigator.serviceWorker.controller;localStorage.setItem('QA_UPGRADE_MARKER','before-update');}")
    print("BASELINE",name,json.dumps({"old":old,"attempts":attempts},ensure_ascii=True),flush=True)

    # Real server update: same origin + scope; request a standards-compliant SW update
    # from the already-installed older page, then reload under the new SW.
    stage[slug]="new";server.sync_mode="new"
    if name=="grammar" and not old["worker"]:
     print("GRAMMAR_PROGRESS_ONLY_MIGRATION",flush=True)
     page.goto(target+"?candidate=1",wait_until="domcontentloaded",timeout=45000)
     page.wait_for_function("v=>typeof state!=='undefined' && state!==null && APP_VERSION===v",arg=new_version,timeout=30000)
     page.wait_for_function("v=>navigator.serviceWorker.controller?.scriptURL.includes(v)",arg=new_version,timeout=60000)
     update={"mode":"initial-candidate-install-after-historical-worker-unavailable"}
    else:
     update=page.evaluate("""async () => {
      const reg=await navigator.serviceWorker.getRegistration();
      await reg.update();
      return {active:reg.active?.scriptURL,waiting:reg.waiting?.scriptURL,installing:reg.installing?.scriptURL};
    }""")
    print("UPDATE_CHECK",name,json.dumps(update),flush=True)
    page.wait_for_function("""async ({prefix,old}) => {
       const names=await caches.keys();
       return names.some(x=>x.startsWith(prefix)&&!old.includes(x)) && !names.some(x=>old.includes(x));
    }""",arg={"prefix":prefix,"old":old["caches"]},timeout=50000)
    print("CACHE_MIGRATED",name,flush=True)
    # Cache migration can finish before clients.claim() switches the controlling worker.
    # Navigating during this race can let the old worker reject the new app.js hash.
    page.wait_for_function("""async () => {
       const reg=await navigator.serviceWorker.getRegistration();
       return reg?.active?.state==="activated" && navigator.serviceWorker.controller===reg.active;
    }""",timeout=30000)
    if old["worker"]:
     page.wait_for_function("""() => window.__qaOldController &&
        window.__qaOldController.state==="redundant" &&
        navigator.serviceWorker.controller!==window.__qaOldController &&
        navigator.serviceWorker.controller?.state==="activated"
     """,timeout=30000)
    print("NEW_WORKER_CONTROLS_PAGE",name,flush=True)
    page.goto(target+"?upgraded=1",wait_until="domcontentloaded",timeout=45000)
    page.wait_for_function("v=>typeof state!=='undefined' && state!==null && APP_VERSION===v",arg=new_version,timeout=30000)
    page.wait_for_function("v=>navigator.serviceWorker.controller?.scriptURL.includes(v)",arg=new_version,timeout=30000)
    page.reload(wait_until="domcontentloaded",timeout=45000)
    page.wait_for_function("typeof state!=='undefined' && state!==null",timeout=20000)
    updated=page.evaluate("""async () => ({
      appVersion:typeof APP_VERSION==='undefined'?'':APP_VERSION,
      worker:navigator.serviceWorker.controller?.scriptURL,
      caches:(await caches.keys()).filter(x=>!x.includes('durable')),
      history:state?.history?.length||0,
      answerHistory:state?.answerHistory?.length||0,
      answers:state?.answers||0,totalAttempts:state?.totalAttempts||0,
      level:state?.level,marker:localStorage.getItem('QA_UPGRADE_MARKER')
    })""")
    marker_ok=updated["marker"]=="before-update"
    progress_ok=(updated["answerHistory"]>=attempts["answerHistory"] and
       updated["history"]>=attempts["history"] and
       updated["answers"]>=attempts["answers"] and
       updated["totalAttempts"]>=attempts["totalAttempts"])
    cache_ok=not any(k in updated["caches"] for k in old["caches"]) and any(c.startswith(prefix) for c in updated["caches"])
    version_ok=updated["appVersion"]==new_version
    ctx.set_offline(True)
    page.reload(wait_until="domcontentloaded",timeout=25000)
    page.wait_for_function("typeof state!=='undefined' && state!==null",timeout=18000)
    page.locator(start).click(timeout=12000)
    page.wait_for_function("() => session && current && document.querySelectorAll('#answers button.answer').length===4",timeout=45000)
    offline=page.evaluate("""() => ({marker:localStorage.getItem('QA_UPGRADE_MARKER'),
       version:APP_VERSION,worker:navigator.serviceWorker.controller?.scriptURL,
       answers:document.querySelectorAll('#answers button.answer').length,online:navigator.onLine})""")
    ok=marker_ok and progress_ok and cache_ok and version_ok and offline["version"]==new_version and offline["answers"]==4 and not errors
    out={"app":name,"pass":ok,"old":old,"attempts":attempts,"updated":updated,"offline":offline,"errors":errors[:3]}
    results.append(out)
    print("RESULT",json.dumps(out,ensure_ascii=True),flush=True)
   except Exception as e:
    try:
     diag=page.evaluate("""async()=>({href:location.href,version:typeof APP_VERSION==='undefined'?null:APP_VERSION,
       reg:await (async()=>{const r=await navigator.serviceWorker.getRegistration();return r?{active:r.active?.scriptURL,installing:r.installing?.state,waiting:r.waiting?.state}:null})(),
       caches:await caches.keys(),controller:navigator.serviceWorker.controller?.scriptURL,
       title:document.title,domReady:document.readyState,storage:localStorage.length,
       bootError:window.ClassroomBootError||null,bootComplete:!!window.ClassroomBootComplete,
       persistStatus:document.getElementById('classroomPersistenceStatus')?.textContent?.slice(0,400),
       appInert:document.querySelector('.app')?.inert,
       deferred:document.querySelectorAll('script[type="application/x-classroom-deferred"]').length,
       jsScripts:[...document.querySelectorAll('script[src*="app.js"]')].map(x=>x.src)})""")
    except Exception as de:diag={"diagError":str(de)[:300]}
    out={"app":name,"pass":False,"error":str(e)[:900],"diagnostics":diag,"errors":errors[:4],"httpErrors":req_log[-4:]}
    results.append(out)
    print("ERROR",json.dumps(out,ensure_ascii=True),flush=True)
   finally:
    ctx.close()
  browser.close()
finally:
 server.shutdown();server.server_close();thread.join(timeout=10)
print("SUMMARY",json.dumps([{"app":r["app"],"pass":r["pass"]} for r in results]),flush=True)
sys.exit(0 if len(results)==len(CASES) and all(r["pass"] for r in results) else 1)
