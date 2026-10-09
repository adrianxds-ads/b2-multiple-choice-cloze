'use strict';
const {spawn}=require('child_process'),assert=require('assert'),path=require('path');
const port=9364,edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile=path.join(process.env.TEMP||'C:\\Temp','cloze-cambridge-smoke-'+process.pid);
const url=process.argv.includes('--online')?'https://adrianxds-ads.github.io/b2-multiple-choice-cloze/?smoke=20261009c':'file:///C:/Users/adria/b2-multiple-choice-cloze/index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser,ws;
async function ready(){
 for(let i=0;i<65;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/json/list');const pages=await r.json();const p=pages.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(p)return p.webSocketDebuggerUrl;}catch{}await sleep(200);}
 throw Error('CDP not ready');
}
async function connect(address){
 ws=new WebSocket(address);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const requests=new Map();
 ws.addEventListener('message',m=>{const v=JSON.parse(m.data),w=requests.get(v.id);if(!w)return;requests.delete(v.id);v.error?w.reject(Error(v.error.message)):w.resolve(v.result);});
 return (method,params={})=>new Promise((resolve,reject)=>{const n=++id;requests.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(requests.has(n)){requests.delete(n);reject(Error('CDP '+method+' timeout'));}},15000);});
}
(async()=>{
 browser=spawn(edge,['--headless','--disable-gpu','--no-first-run','--disable-extensions','--remote-debugging-port='+port,'--user-data-dir='+profile,'--window-size=390,844',url],{stdio:'ignore'});
 const send=await connect(await ready());
 const evalJS=async expr=>{const d=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  if(d.exceptionDetails)throw Error('JS exception '+d.exceptionDetails.text);return d.result?.value;};
 for(let i=0;i<75;i++){if(await evalJS('typeof CAMPAIGN!=="undefined" && CAMPAIGN && BANK.length===2431 && !!state'))break;await sleep(150);}
 const bank=await evalJS('({length:BANK.length,version:APP_VERSION,skills:CAMPAIGN.skills.length,seen:Object.keys(state.seen).length,storageKey:STORAGE_KEY})');
 assert.equal(bank.length,2431);assert.equal(bank.version,'1.10.15');
 const visible=await evalJS('({label:document.querySelector("#bankCountLabel")?.textContent,subtitle:document.querySelector("#startScreen .subtitle")?.textContent,coverage:document.querySelector("#coverageText")?.textContent,meta:document.querySelector("meta[name=ae-version]")?.content})');
 assert(visible.label==='2.431 tarjetas' && visible.coverage.includes('2.431') && /Parts 1, 2 y 3/.test(visible.subtitle) && visible.meta==='1.10.15','Outdated UI '+JSON.stringify(visible));
 const plan=await evalJS('(()=>{const p=buildTrainingPlan();return {size:p.length,parts:p.filter(x=>x.sourceType==="exam-core").map(x=>x.sourcePart||1),ids:p.map(x=>x.id),f:p.map(x=>x.networkFamily)}})()');
 assert.equal(plan.size,15);for(const part of [1,2,3])assert(plan.parts.includes(part),'No Cambridge part '+part);
 assert.equal(new Set(plan.f).size,15,'Duplicate Cambridge family in session');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const start=await evalJS('(async()=>{readFirstMode=false;await startSession(false);return {shown:!document.querySelector("#gameScreen").classList.contains("hidden"),options:document.querySelectorAll("#answers .answer").length,question:document.querySelector("#questionText").textContent,scroll:document.documentElement.scrollWidth,width:innerWidth,parts:session.plan.filter(x=>x.sourceType==="exam-core").map(x=>x.sourcePart||1)}})()');
 assert(start.shown&&start.options===4,'No rendered quiz question '+JSON.stringify(start));
 assert(start.scroll<=start.width+1,'Horizontal overflow '+JSON.stringify(start));
 let first=await evalJS('(()=>{answer(current.correctPos,false);return {ok:session.correct===1,stored:JSON.parse(localStorage.getItem(STORAGE_KEY)).totalAttempts}})()');
 assert(first.ok&&first.stored===1,'Scoring failed '+JSON.stringify(first));
 await sleep(420);
 const moved=await evalJS('({i:session.index,answers:document.querySelectorAll("#answers .answer").length,question:document.querySelector("#questionText").textContent})');
 assert.equal(moved.i,1);assert.equal(moved.answers,4);
 const output={result:'PASS',bank,visible,plan:{size:plan.size,parts:plan.parts},first:start,scoring:first,advance:moved.i};
 console.log(JSON.stringify(output));
 await send('Browser.close');
})().catch(e=>{console.error('FAIL',e.stack||e);process.exitCode=1;}).finally(()=>{try{ws?.close();}catch{}try{browser?.kill();}catch{}setTimeout(()=>process.exit(),600);});
