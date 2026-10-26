/* Cloze question time budget · Gemini Mobile First v2.
   Retains the established history schema VERSION=1 and records actual timeLimitSec. */
(function(root,factory){
 const timing=factory();
 if(root)root.ClozeQuestionTiming=timing;
 if(typeof module==="object"&&module.exports)module.exports=timing;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const VERSION=1;
 const DEFAULT_SEC=15;
 const BOUNDS=Object.freeze({1:[14,26],2:[15,27],3:[16,29],4:[24,42]});
 const REASONING=Object.freeze({1:9.5,2:10.5,3:12,4:15.5});
 const WORDS_PER_SECOND=2.75;
 const words=v=>(String(v||"").match(/[\p{L}\p{N}]+(?:[\u2019'-][\p{L}\p{N}]+)*/gu)||[]).length;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function components(q){
  const part=[1,2,3,4].includes(Number(q?.sourcePart))?Number(q.sourcePart):1;
  const text=String(q?.visibleQuestion||q?.q||"");
  const opts=Array.isArray(q?.visibleOptions)?q.visibleOptions:Array.isArray(q?.display)?q.display:Array.isArray(q?.a)?q.a:[];
  const optionWords=opts.slice(0,4).map(words),longest=optionWords.length?Math.max(...optionWords):0;
  return {part,promptWords:words(text),optionWords:optionWords.reduce((a,b)=>a+b,0),longest};
 }
 function personalBonus(part,history){
  if(!Array.isArray(history))return 0;
  const recent=history.filter(r=>r&&r.timerModelVersion===VERSION&&Number(r.sourcePart)===part&&r.correct===true&&r.type!=="timeout"&&Number.isFinite(r.ms)&&Number.isFinite(r.timeLimitSec)&&r.timeLimitSec>=14&&r.ms>=500).slice(-50);
  if(recent.length<12)return 0;
  const ratios=recent.map(r=>r.ms/(1000*r.timeLimitSec)).sort((a,b)=>a-b);
  const p75=ratios[Math.floor((ratios.length-1)*.75)];
  return p75>=.85?3:p75>=.73?2:p75>=.64?1:0;
 }
 function estimate(q,history=[]){
  const {part,promptWords,optionWords,longest}=components(q);
  const [min,max]=BOUNDS[part];
  const scan=part===4?optionWords*.26+longest*.55:part===3?optionWords*.22+longest*.45:optionWords*.18+longest*.38;
  const base=clamp(Math.round(REASONING[part]+promptWords/WORDS_PER_SECOND+scan)+personalBonus(part,history),min,max);
  const factor=(typeof window!=="undefined"&&window.ClozeMobileV2?.getPaceFactor)?window.ClozeMobileV2.getPaceFactor():1;
  return clamp(Math.round(base*factor),Math.round(min*.85),Math.round(max*1.2));
 }
 function effectiveTarget(q,seconds){
  const original=Number(q?.targetTime)||(Number(q?.sourcePart)===4?11:8.5);
  return Math.round(Math.max(original,original+Math.max(0,seconds-DEFAULT_SEC)*.38)*10)/10;
 }
 return Object.freeze({VERSION,DEFAULT_SEC,BOUNDS,components,estimate,effectiveTarget,personalBonus});
});