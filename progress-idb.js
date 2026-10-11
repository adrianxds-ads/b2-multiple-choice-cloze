/* Cloze Quiz: lossless durable snapshots. IndexedDB is primary; CacheStorage
   is the independent fallback when Android's storage limits block transactions.
   Neither path deletes nor modifies the existing localStorage history. */
(function(){
  "use strict";
  const CACHE_NAME="adrian-cloze-durable-progress-v1";
  const CACHE_KEY=new URL("./__cloze_durable__/current.json",location.href).href;
  let openPromise=null,queue=Promise.resolve(),lastBackend="unknown";
  const clone=value=>typeof structuredClone==="function"?structuredClone(value):JSON.parse(JSON.stringify(value));
  function bounded(promise,ms,label){
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" timed out")),ms);})
    ]).finally(()=>clearTimeout(timer));
  }
  function open(){
    if(openPromise)return openPromise;
    openPromise=new Promise((resolve,reject)=>{
      if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return;}
      const request=indexedDB.open("adrian-cloze-progress-v1",1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains("snapshots"))
          request.result.createObjectStore("snapshots");
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("IndexedDB open failed"));
      request.onblocked=()=>reject(new Error("IndexedDB migration blocked"));
    }).catch(error=>{openPromise=null;throw error;});
    return openPromise;
  }
  async function operation(mode,action){
    const db=await bounded(open(),7000,"IndexedDB open");
    return bounded(new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction("snapshots",mode);
        const request=action(tx.objectStore("snapshots"));
        tx.oncomplete=()=>resolve(request?.result);
        tx.onerror=()=>reject(tx.error||new Error("IndexedDB transaction failed"));
        tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted"));
      }catch(error){reject(error);}
    }),8500,"IndexedDB transaction");
  }
  async function openCache(){
    if(!("caches" in window))throw new Error("CacheStorage unavailable");
    return bounded(caches.open(CACHE_NAME),7000,"CacheStorage open");
  }
  async function readCache(){
    const c=await openCache();
    const response=await bounded(c.match(CACHE_KEY),7000,"CacheStorage read");
    return response?await response.json():undefined;
  }
  async function writeCache(snapshot){
    const cache=await openCache();
    const payload=JSON.stringify(snapshot);
    await bounded(cache.put(CACHE_KEY,new Response(payload,{headers:{"Content-Type":"application/json"}})),10000,"CacheStorage write");
    lastBackend="cache";
  }
  async function removeCache(){
    const cache=await openCache();
    await bounded(cache.delete(CACHE_KEY),7000,"CacheStorage removal");
  }
  function score(snapshot){
    if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return [-1,-1,-1];
    return [Number(snapshot.sessions)||0,Number(snapshot.totalAttempts)||0,Number(snapshot.updatedAt)||0];
  }
  function choose(a,b){
    if(!a)return b;
    if(!b)return a;
    const x=score(a),y=score(b);
    for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]>x[i]?b:a;
    return a;
  }
  const api={
    async read(){
      const [primary,fallback]=await Promise.allSettled([
        operation("readonly",store=>store.get("current")),readCache()
      ]);
      if(primary.status==="rejected"&&fallback.status==="rejected")
        throw new AggregateError([primary.reason,fallback.reason],"Progress storage unavailable");
      const a=primary.status==="fulfilled"?primary.value:undefined;
      const b=fallback.status==="fulfilled"?fallback.value:undefined;
      return choose(a,b);
    },
    write(value){
      const snapshot=clone(value);
      const current=queue.catch(()=>{}).then(async()=>{
        try{
          await operation("readwrite",store=>store.put(snapshot,"current"));
          lastBackend="indexeddb";
        }catch(primaryError){
          try{await writeCache(snapshot);}
          catch(fallbackError){
            throw new AggregateError([primaryError,fallbackError],"Both progress storage backends failed");
          }
        }
      });
      queue=current;
      return current;
    },
    remove(){
      const current=queue.catch(()=>{}).then(async()=>{
        const attempts=await Promise.allSettled([
          operation("readwrite",store=>store.delete("current")),removeCache()
        ]);
        const errors=attempts.filter(x=>x.status==="rejected").map(x=>x.reason);
        if(errors.length)throw new AggregateError(errors,"Progress removal incomplete; refusing reset");
      });
      queue=current;
      return current;
    },
    ready:()=>Promise.any([bounded(open(),7000,"IndexedDB open"),openCache()]).then(()=>true),
    lastBackend:()=>lastBackend
  };
  window.ClozeProgressIDB=Object.freeze(api);
})();
