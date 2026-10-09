importScripts('./build-assets.js','./sw-integrity.js');
const CACHE_PREFIX='b2-territorio-1-';
const CACHE='b2-territorio-1-'+self.AdrianRelease.build;
const ASSETS=['./nucleo-game-theme.css','./learning-feedback.js','./quiz-polish.css','./progress-storage.js','./','./index.html','/adrian-core/design/adrian-visual-system.js','/adrian-core/components/adrian-achievements.js','/adrian-core/components/adrian-performance.js?v=1.0.1-20261006','./lessons.js','./keys.js','./error-coach.js','./language-points.js','./app.js','./performance-adapter.js?v=1.0.0-20261006','./territory-01.json','./manifest.webmanifest','./icon.svg'];
const CORE_RE=/\.(?:html|js|css|json|webmanifest)$/i;
function withTimeout(req,ms,init={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return releaseFetch(req,{...init,signal:c.signal}).finally(()=>clearTimeout(t));}
async function installCore(list){
  const c=await caches.open(CACHE);
  try{await releaseAll(list.map(async url=>{const req=new Request(new URL(url,self.registration.scope),{cache:'reload'}),r=await withTimeout(req,8000,{cache:'reload'});if(!r||!r.ok)throw new Error(`Core asset failed: ${url}`);await c.put(req,r.clone());}));}
  catch(e){await caches.delete(CACHE);throw e;}
}
self.addEventListener('install',e=>e.waitUntil(installCore(ASSETS)));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith('b2mcc-campaign1-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function network(req,ms=3500){try{return await withTimeout(req,ms,{cache:'no-cache'});}catch(_){return null;}}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),core=e.request.mode==='navigate'||CORE_RE.test(u.pathname);
    if(core){const r=await network(e.request,1800);if(r&&r.ok){await c.put(e.request,r.clone());return r;}const hit=await releaseMatch(c,e.request);if(hit)return hit;if(e.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'))||Response.error();return Response.error();}
    const hit=await releaseMatch(c,e.request);if(hit)return hit;
    const r=await network(e.request,5000);if(r&&r.ok){await c.put(e.request,r.clone());return r;}return Response.error();
  })());
});
