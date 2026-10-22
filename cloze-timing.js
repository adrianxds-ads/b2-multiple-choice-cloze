/* English Cloze: per-card time budget. No user data leaves this browser. */
(function(root,factory){
  const timing=factory();
  if(root)root.ClozeQuestionTiming=timing;
  if(typeof module==='object'&&module.exports)module.exports=timing;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const VERSION=1;
  const DEFAULT_SEC=15;
  const BOUNDS=Object.freeze({1:[16,26],2:[17,28],3:[18,30],4:[26,42]});
  const REASONING=Object.freeze({1:11,2:12.5,3:13,4:16});
  const WORDS_PER_SECOND=2.75; // conservative design assumption, not an external B2 standard
  const words=value=>(String(value||'').match(/[\p{L}\p{N}]+(?:[\u2019'-][\p{L}\p{N}]+)*/gu)||[]).length;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function components(q){
    const part=[1,2,3,4].includes(Number(q?.sourcePart))?Number(q.sourcePart):1;
    const text=String(q?.visibleQuestion||q?.q||'');
    const options=Array.isArray(q?.visibleOptions)?q.visibleOptions:Array.isArray(q?.display)?q.display:Array.isArray(q?.a)?q.a:[];
    const optionWords=options.slice(0,4).map(words);
    const promptWords=words(text);
    const optionSum=optionWords.reduce((a,b)=>a+b,0);
    const longest=optionWords.length?Math.max(...optionWords):0;
    return {part,promptWords,optionWords:optionSum,longest};
  }
  function personalBonus(part,history){
    if(!Array.isArray(history))return 0;
    const recent=history.filter(r=>r&&r.timerModelVersion===VERSION&&Number(r.sourcePart)===part&&r.correct===true&&r.type!=='timeout'&&Number.isFinite(r.ms)&&Number.isFinite(r.timeLimitSec)&&r.timeLimitSec>=16&&r.ms>=500).slice(-50);
    if(recent.length<12)return 0;
    const ratios=recent.map(r=>r.ms/(1000*r.timeLimitSec)).sort((a,b)=>a-b);
    const p75=ratios[Math.floor((ratios.length-1)*.75)];
    return p75>=.85?3:p75>=.73?2:p75>=.64?1:0;
  }
  function estimate(q,history=[]){
    const {part,promptWords,optionWords,longest}=components(q);
    const [min,max]=BOUNDS[part];
    // All four alternatives are scanned, but not read as four entire texts.
    // Part 4 requires comparing two sentences while preserving the key word.
    const scan=part===4?optionWords*.24+longest*.5:optionWords*.18+longest*.40;
    const estimateSec=REASONING[part]+promptWords/WORDS_PER_SECOND+scan;
    const base=clamp(Math.round(estimateSec),min,max);
    return clamp(base+personalBonus(part,history),min,max);
  }
  function effectiveTarget(q,seconds){
    const original=Number(q?.targetTime)||3.6;
    return Math.round(Math.max(original,original+Math.max(0,seconds-DEFAULT_SEC)*.42)*10)/10;
  }
  return Object.freeze({VERSION,DEFAULT_SEC,BOUNDS,components,estimate,effectiveTarget,personalBonus});
});
