/* Cloze Quiz: lossless progress persistence when localStorage reaches origin quota.
   Dedicated IndexedDB snapshots do not delete or rewrite the original saved history. */
(function(){
  "use strict";
  let openPromise=null;
  function open(){
    if(openPromise)return openPromise;
    openPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error("IndexedDB unavailable"));return;}
      const r=indexedDB.open('adrian-cloze-progress-v1',1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('snapshots'))r.result.createObjectStore('snapshots');};
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error||new Error('IndexedDB open failed'));
      r.onblocked=()=>reject(new Error('IndexedDB migration blocked'));
    }).catch(error=>{openPromise=null;throw error;});
    return openPromise;
  }
  async function operation(mode,action){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction('snapshots',mode);
        const store=tx.objectStore('snapshots');
        const request=action(store);
        tx.oncomplete=()=>resolve(request?.result);
        tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
        tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
      }catch(error){reject(error);}
    });
  }
  let queue=Promise.resolve();
  const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  const api={
    read:()=>operation('readonly',store=>store.get('current')),
    write(value){
      const snapshot=clone(value);
      const current=queue.catch(()=>{}).then(()=>operation('readwrite',store=>store.put(snapshot,'current')));
      queue=current;
      return current;
    },
    remove(){
      const current=queue.catch(()=>{}).then(()=>operation('readwrite',store=>store.delete('current')));
      queue=current;
      return current;
    },
    ready:()=>open().then(()=>true)
  };
  window.ClozeProgressIDB=Object.freeze(api);
})();