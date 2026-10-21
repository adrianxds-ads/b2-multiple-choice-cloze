'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const here=__dirname;
const source=path.resolve(here,'../adaptive-exam/data');
const c={window:{}};vm.createContext(c);
for(const f of ['cambridge-quiz-transcribed.js','engexam-bank.js'])
  vm.runInContext(fs.readFileSync(path.join(source,f),'utf8'),c,{filename:f});
const cam=c.window.ADAPTIVE_EXAM_TRANSCRIBED_CAMBRIDGE_PAPERS,eng=c.window.ADAPTIVE_EXAM_PAPERS;
assert.equal(cam.length,10);assert.equal(eng.length,20);
const exams=[...cam,...eng],ids=new Set(),counts={1:0,2:0,3:0};
for(const paper of exams){
 for(const partNo of [1,2,3]){
  const part=paper.parts[partNo],gaps=part.segments.filter(s=>s&&typeof s==='object'&&Number.isInteger(s.n));
  assert.equal(gaps.length,8);
  assert.equal(part.segments.filter(s=>typeof s==='string').length,9);
  for(const item of gaps){
    const id=[paper.examNumber,partNo,item.n].join('-');
    assert(!ids.has(id));ids.add(id);counts[partNo]++;
    const answers=item.answers||[item.answer];
    assert(answers.length&&answers.every(Boolean),'Answer missing '+id);
    if(partNo===1){assert.equal(item.options.length,4);assert(item.options.includes(item.answer),'Exact original option not in key '+id);}
    if(partNo===3)assert(item.base,'Missing original base '+id);
  }
 }
}
assert.deepEqual(counts,{1:240,2:240,3:240});assert.equal(ids.size,720);
const html=fs.readFileSync(path.join(here,'literal-exams.html'),'utf8'),engine=fs.readFileSync(path.join(here,'literal-exams.js'),'utf8');
assert(html.includes('cambridge-quiz-transcribed.js')&&html.includes('engexam-bank.js'));
assert(engine.includes('seg.n===q.node.n')&&engine.includes("q.node.options.forEach")&&engine.includes("answerForms(q)"));
assert(engine.includes('cloze_original_papers_v1'));
console.log(JSON.stringify({pass:true,exams:exams.length,parts:exams.length*3,questions:ids.size,byPart:counts,unique:ids.size}));
