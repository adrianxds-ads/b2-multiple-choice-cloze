// Exam-only four-option B2 quiz; Gemini/ChatGPT mobile Part 4 refinements v1.12.1 · 2026-10-21
importScripts('./build-assets.js','./sw-integrity.js');
const CACHE_PREFIX='b2-territorio-1-';
const CACHE='b2-territorio-1-'+self.AdrianRelease.build;
const ASSETS=["./quiz-ergonomics.js?v=1.0.0","./quiz-ergonomics.css?v=1.0.0","/adrian-core/components/adrian-learning-json.js?v=1.1.0-20261013","/adrian-core/components/github-garden.js?v=6","./app.js","./error-coach.js","./icon.svg","./keys.js","./language-points.js","./learning-feedback.js","./lessons.js","./manifest.webmanifest","./nucleo-game-theme.css","./nucleo-global-v45.css","./nucleo-oled-shell.css","./nucleo-quiz-refinement.css","./performance-adapter.js","./progress-idb.js","./progress-storage.js","./quiz-polish.css","./territory-01.js","/adrian-core/components/adrian-achievements.js?v=stars4","/adrian-core/components/adrian-performance.js?v=1.1.0","/adrian-core/components/adrian-sync.js?v=1.0.8-0d4fa97","/adrian-core/components/hub-charts.js?v=1.1.0","/adrian-core/components/hub-nav.js?v=12-20261011","/adrian-core/components/hub-quiz-ux.js?v=20261011-2","/adrian-core/design/adrian-visual-system.js?v=core-20261004b","/adrian-core/design/integrated-v11/integrated-theme.css","/adrian-core/design/integrated-v11/integrated-view.js","/adrian-core/design/integrated-v11/roboto-1.woff2","/adrian-core/design/integrated-v11/roboto-2.woff2","/adrian-core/design/integrated-v11/roboto.css","/adrian-core/design/integrated-v11/roboto-source.css","/adrian-core/design/integrated-v11/integrated-theme.css","/adrian-core/design/integrated-v11/roboto-3.woff2","/adrian-core/design/integrated-v11/integrated-view.js","/adrian-core/design/integrated-v11/integrated-hub-theme.css","/adrian-core/design/integrated-v11/roboto-0.woff2","./index.html",'./nucleo-global-v45.css?v=4.5.3','./nucleo-quiz-refinement.css?v=4.1.0','./nucleo-oled-shell.css?v=1.0.0','./nucleo-game-theme.css','./learning-feedback.js','./quiz-polish.css','./progress-storage.js','./progress-idb.js','./','./index.html','/adrian-core/design/adrian-visual-system.js','/adrian-core/components/adrian-achievements.js','/adrian-core/components/adrian-performance.js?v=1.0.1-20261006','./lessons.js','./keys.js','./error-coach.js','./language-points.js','./app.js','./performance-adapter.js?v=1.0.0-20261006','./territory-01.json','./manifest.webmanifest','./icon.svg'];
const CORE_RE=/\.(?:html|js|css|json|webmanifest)$/i;
function withTimeout(req,ms,init={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return releaseFetch(req,{...init,signal:c.signal}).finally(()=>clearTimeout(t));}
async function installCore(list){
  const c=await caches.open(CACHE);
  try{await releaseAll(list.map(async url=>{const req=new Request(new URL(url,self.registration.scope),{cache:'reload'}),r=await withTimeout(req,8000,{cache:'reload'});if(!r||!r.ok)throw new Error(`Core asset failed: ${url}`);await c.put(req,r.clone());}));}
  catch(e){await caches.delete(CACHE);throw e;}
}
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('b2-territorio-1-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function network(req,ms=3500){try{return await withTimeout(req,ms,{cache:'no-cache'});}catch(_){return null;}}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),core=e.request.mode==='navigate'||CORE_RE.test(u.pathname);
    if(core){if(e.request.mode!=='navigate'){const ready=await releaseMatch(c,e.request);if(ready)return ready;}const r=await network(e.request,6000);if(r&&r.ok){await c.put(e.request,r.clone());return r;}const hit=await releaseMatch(c,e.request);if(hit)return hit;if(e.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'))||Response.error();return Response.error();}
    const hit=await releaseMatch(c,e.request);if(hit)return hit;
    const r=await network(e.request,5000);if(r&&r.ok){await c.put(e.request,r.clone());return r;}return Response.error();
  })());
});

// Cloze recovery release 2026-10-11: no blocking offline precache.

// Cloze durable fallback release 2026-10-11: preserve previous progress snapshots.
