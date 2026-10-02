const CACHE_PREFIX='b2-territorio-1-';
const CACHE='b2-territorio-1-v1.10.2-loadfix1';
const ASSETS=['./','./index.html','./adrian-visual-system.js','./adrian-achievements.js','./lessons.js','./keys.js','./error-coach.js','./language-points.js','./hub-path-game.js','./app.js','./territory-01.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith('b2mcc-campaign1-'))&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  const update=fetch(e.request,{cache:'no-store'}).then(async r=>{if(r&&r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone());}return r;}).catch(()=>null);
  e.waitUntil(update.then(()=>{}));
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),hit=await c.match(e.request,{ignoreSearch:true});
    if(hit)return hit;
    const fresh=await update;if(fresh)return fresh;
    if(e.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'))||Response.error();
    return Response.error();
  })());
});
