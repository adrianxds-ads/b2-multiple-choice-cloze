'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),cp=require('child_process'),path=require('path');
const here=__dirname,json=JSON.parse(fs.readFileSync(path.join(here,'territory-01.json'),'utf8'));
const original=JSON.parse(cp.execFileSync('git',['-C',here,'show','717c3934feebeb8b289a7dbe8824292f9a95c8cd:territory-01.json'],{encoding:'utf8',maxBuffer:12000000}));
assert.equal(original.questions.length,1610);assert.equal(json.questions.length,2431);
assert.equal(json.targetExercises,2431);assert.equal(json.campaignId,original.campaignId);
const prior=json.questions.slice(0,1610);
for(let i=0;i<1610;i++){const q={...prior[i]};delete q.sourcePart;assert.deepStrictEqual(q,original.questions[i],'Original card mutated at '+i);}
const extra=json.questions.slice(1610),ids=new Set(),fps=new Set(),byPart={2:[],3:[]},gaps=new Map();
for(const q of json.questions){
 assert(!ids.has(q.id),'Duplicate id '+q.id);ids.add(q.id);
 assert(!fps.has(q.fingerprint),'Duplicate fingerprint '+q.fingerprint);fps.add(q.fingerprint);
 assert(Array.isArray(q.a)&&q.a.length===4&&new Set(q.a.map(x=>x.toLowerCase())).size===4,'Bad options '+q.id);
 assert(q.c>=0&&q.c<4,'Bad correct index '+q.id);
}
for(const q of extra){
 assert([2,3].includes(q.sourcePart));byPart[q.sourcePart].push(q);
 assert.equal((q.q.match(/___/g)||[]).length,1,'Wrong gap count '+q.id);
 assert(q.q.length<235&&q.q.length>20,'Bad prompt length '+q.id);
 assert(!q.a.some((x,i)=>i!==q.c&&q.acceptedAnswers.includes(x.toLowerCase())),'Accepted alternative used as wrong '+q.id);
 assert(q.networkFamily===q.templateId);
 assert.equal(q.sourceType,'exam-core');
 if(q.sourcePart===3)assert(/\([A-Z]+\)$/.test(q.q),'Missing word-formation root '+q.id);
 const key=q.sourceExam+'-'+q.sourcePart+'-'+q.sourceQuestion;
 const x=gaps.get(key)||[];x.push(q);gaps.set(key,x);
}
assert.equal(byPart[2].length,480);assert.equal(byPart[3].length,341);assert.equal(gaps.size,480);
assert([...gaps.values()].every(x=>x.length>=1&&x.length<=2));
assert([...gaps.values()].filter(x=>x.length===2).every(x=>x[0].a.slice().sort().join('|')!==x[1].a.slice().sort().join('|')));
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(here,'territory-01.js'),'utf8'),ctx);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.window.__AE_CAMPAIGN__)),json);
const result={result:'PASS',originalUntouched:1610,uniqueRealGaps:gaps.size,
  openCloze:byPart[2].length,wordFormation:byPart[3].length,fullBank:json.questions.length,
  distinctIds:ids.size,distinctFingerprints:fps.size,sameSourceInJsAndJson:true};
console.log(JSON.stringify(result));
