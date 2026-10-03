const CACHE_PREFIX='b2-territorio-1-';
const CACHE='b2-territorio-1-v1.10.2-loadfix4';
const ASSETS=['./','./index.html','./adrian-visual-system.js','./adrian-achievements.js','./lessons.js','./keys.js','./error-coach.js','./language-points.js','./hub-path-game.js','./app.js','./territory-01.json','./manifest.webmanifest','./icon.svg'];
const CORE_RE=/\.(?:html|js|css|json|webmanifest)$/i;
function withTimeout(req,ms,init={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(req,{...init,signal:c.signal}).finally(()=>clearTimeout(t));}
async function installCore(list){
  const c=await caches.open(CACHE);
  try{await Promise.all(list.map(async url=>{const req=new Request(new URL(url,self.registration.scope),{cache:'reload'}),r=await withTimeout(req,8000,{cache:'reload'});if(!r||!r.ok)throw new Error(`Core asset failed: ${url}`);await c.put(req,r.clone());}));}
  catch(e){await caches.delete(CACHE);throw e;}
}
self.addEventListener('install',e=>e.waitUntil(installCore(ASSETS).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith('b2mcc-campaign1-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function network(req,ms=3500){try{return await withTimeout(req,ms,{cache:'no-cache'});}catch(_){return null;}}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),core=e.request.mode==='navigate'||CORE_RE.test(u.pathname);
    if(core){const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;const r=await network(e.request,2800);if(r&&r.ok)return r;if(e.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'))||Response.error();return Response.error();}
    const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;
    const r=await network(e.request,5000);if(r&&r.ok){await c.put(e.request,r.clone());return r;}return Response.error();
  })());
});
