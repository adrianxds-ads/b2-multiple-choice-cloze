const CACHE_PREFIX='b2-territorio-1-';
const CACHE='b2-territorio-1-v1.10.2-loadfix2';
const ASSETS=['./','./index.html','./adrian-visual-system.js','./adrian-achievements.js','./lessons.js','./keys.js','./error-coach.js','./language-points.js','./hub-path-game.js','./app.js','./territory-01.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(warmCache().then(()=>self.skipWaiting())));
async function warmCache(){
  const c=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async url=>{try{const req=new Request(new URL(url,self.registration.scope),{cache:'reload'});const r=await fetch(req);if(r&&r.ok)await c.put(req,r.clone());}catch(_){}}));
}
async function fetchAndStore(req){
  try{const r=await fetch(req,{cache:'no-cache'});if(r&&r.ok){const c=await caches.open(CACHE);await c.put(req,r.clone());}return r;}catch(_){return null;}
}
function criticalRequest(req,u){return req.mode==='navigate'||/\.(?:html|js|css|json|webmanifest)$/i.test(u.pathname);}
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith('b2mcc-campaign1-'))&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  const fresh=fetchAndStore(e.request);e.waitUntil(fresh.then(()=>{}));
  e.respondWith((async()=>{
    const c=await caches.open(CACHE),critical=criticalRequest(e.request,u);
    if(critical){const r=await fresh;if(r)return r;const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;}
    else{const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;const r=await fresh;if(r)return r;}
    if(e.request.mode==='navigate')return (await c.match('./index.html'))||(await c.match('./'))||Response.error();
    return Response.error();
  })());
});
