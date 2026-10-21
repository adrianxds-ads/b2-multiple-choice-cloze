'use strict';
/* Literal-only Cambridge B2 Parts 1–4 quiz compilation.
   The original exam texts and answer keys come from the 30-paper master bank.
   The *only* created content is three deliberately wrong multiple-choice options
   for Parts 2–4. Always validate; never invent a question or correct answer.
*/
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
/* === BLOCK-1-CURATED-OVERRIDES-START === */
const _curatedPart4Path = path.join(__dirname, 'curated-part4-overrides.json');
const _curatedPart4ById = fs.existsSync(_curatedPart4Path)
  ? JSON.parse(fs.readFileSync(_curatedPart4Path, 'utf8'))
  : {};

function applyCuratedPart4Override(q) {
  if (!q || Number(q.sourcePart) !== 4) return q;
  const ov = _curatedPart4ById[String(q.id)];
  if (!ov) return q;
  q.acceptedForms = ov.acceptedForms.slice();
  const canonical = ov.canonical;
  const traps = ov.traps.slice(0, 3);
  const currentCorrectIdx = (typeof q.c === 'number' && q.c >= 0 && q.c < 4) ? q.c : 0;
  const nextOptions = [];
  let trapIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (i === currentCorrectIdx) {
      nextOptions.push(canonical);
    } else {
      nextOptions.push(traps[trapIdx++]);
    }
  }
  q.a = nextOptions;
  q.c = currentCorrectIdx;
  if (Array.isArray(q.traps)) q.traps = ov.traps.slice(0, 3);
  if (q.trapOrigin) q.trapOrigin = 'hand-reviewed-pilot';
  return q;
}
/* === BLOCK-1-CURATED-OVERRIDES-END === */
const here=__dirname,src=path.resolve(here,'../adaptive-exam'),context={window:{}};
vm.createContext(context);
for(const f of ['data/cambridge-quiz-transcribed.js','data/engexam-bank.js','keyword-quiz-bank.js'])
 vm.runInContext(fs.readFileSync(path.join(src,f),'utf8'),context,{filename:f});
const originals=[...context.window.ADAPTIVE_EXAM_TRANSCRIBED_CAMBRIDGE_PAPERS,...context.window.ADAPTIVE_EXAM_PAPERS];
const cam4=JSON.parse(fs.readFileSync(path.join(here,'cambridge-part4-source.json'),'utf8'));
const pilot=context.window.KEYWORD_QUIZ_PILOT||{};
const prev=JSON.parse(fs.readFileSync(path.join(here,'territory-01.json'),'utf8'));
const prior=new Map();
for(const q of prev.questions){
 if(q.sourceType==='exam-core'&&[1,2,3].includes(q.sourcePart||1)){
  const key=[q.sourceExam,q.sourcePart||1,q.sourceQuestion].join(':');
  if(!prior.has(key)||((q.distractorVariant||1)===1))prior.set(key,q);
 }
}
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const uniq=x=>[...new Set(x.map(s=>String(s||'').trim()).filter(Boolean))];
const problems=[],warnings=[],output=[];
const answers=item=>{
 const a=item.answers?.length?item.answers:[item.answer||item.display];
 let variants=uniq(a.flatMap(x=>String(x).split(/\s+\/\s+/).map(y=>y.trim())));
 for(let pass=0;pass<3;pass++){
  const next=[];
  for(const s of variants){
   const m=s.match(/\b([A-Za-z]+)\/([A-Za-z]+)\b/);
   if(m){next.push(s.replace(m[0],m[1]),s.replace(m[0],m[2]));}
   else next.push(s);
  }
  variants=uniq(next);
 }
 return variants;
};
const normForms=x=>{
 const forms=[];
 for(const variant of x){
  forms.push(norm(variant));
  if(/\([^)]+\)/.test(variant)){
   forms.push(norm(variant.replace(/\(([^)]+)\)/g,'')));
   forms.push(norm(variant.replace(/\(([^)]+)\)/g,'$1')));
  }
 }
 return [...new Set(forms.filter(Boolean))];
};
const sourceLabel=p=>p.label||p.source?.label||'Exam '+p.examNumber;
function sentenceFromSegments(part,node){
 const raw=part.segments.map(s=>typeof s==='string'?s:'('+s.n+') _____').join('');
 const needle='('+node.n+') _____',pos=raw.indexOf(needle);
 if(pos<0||raw.indexOf(needle,pos+1)>=0)throw Error('Ambiguous hole location '+node.n);
 const before=raw.slice(0,pos),after=raw.slice(pos+needle.length);
 // Keep the exact words in the sentence; only mark the test gap and fill
 // adjacent *other* gaps using their documented answer key.
 const b=Math.max(0,...['. ','? ','! ','\n'].map(t=>{const i=before.lastIndexOf(t);return i<0?0:i+t.length;}));
 const ends=[after.search(/[.!?](?=\s|$)/),after.search(/\n/)].filter(x=>x>=0);
 const e=ends.length?Math.min(...ends)+1:after.length;
 let sentence=raw.slice(b,pos)+ '___' +raw.slice(pos+needle.length,pos+needle.length+e);
 sentence=sentence.replace(/\((\d{1,2})\) _____/g,(_,n)=>{
  const other=part.segments.find(s=>s&&typeof s==='object'&&Number(s.n)===Number(n));
  return other?String(answers(other)[0]||'_____'):'_____';
 });
 return sentence.replace(/\\?0\\?\s*_{3,}/g,'[example 0]').trim().replace(/\n+/g,' ');
}
const changes={
 'to':['for','of','on'],'for':['to','of','with'],'of':['for','to','on'],
 'on':['in','at','for'],'in':['on','at','for'],'at':['in','to','on'],
 'with':['for','to','of'],'about':['of','for','to'],'than':['then','as','to'],
 'as':['than','like','so'],'from':['of','to','at'],'by':['with','at','for'],
 'into':['in','to','on'],'up':['out','off','down'],'out':['up','off','on'],
 'have':['has','had','having'],'has':['have','had','is'],'had':['have','has','having'],
 'was':['is','were','had'],'were':['was','are','been'],'is':['was','be','has'],
 'are':['is','were','be'],'been':['being','be','was'],'be':['being','been','is'],
 'do':['does','did','doing'],'did':['do','does','done'],'does':['do','did','doing'],
 'will':['would','could','can'],'would':['will','should','could'],
 'could':['can','would','must'],'can':['could','should','will'],
 'should':['would','must','could'],'not':['never','no','already'],
 'more':['most','less','much'],'less':['more','least','fewer'],'most':['more','much','least'],
 'better':['best','good','well'],'best':['better','good','well'],
 'much':['many','more','most'],'many':['much','more','most'],'very':['so','too','much'],
 'such':['so','very','much'],'so':['such','too','much'],'too':['so','very','much'],
 'a':['the','an','some'],'an':['a','the','one'],'the':['a','this','an'],
 'he':['she','they','him'],'she':['he','they','her'],'they':['them','he','we'],
 'his':['her','their','him'],'her':['his','their','she'],
 'their':['there','his','them'],'it':['this','he','they'],'my':['your','his','our'],
 'been':['being','was','be'],'if':['when','unless','whether'],'when':['while','if','whether'],
 'who':['which','whom','whose'],'which':['who','that','what'],
 'already':['yet','still','ever'],'never':['ever','always','already'],
 'always':['never','often','still'],'ever':['never','yet','always'],
 'used':['use','using','uses'],'than':['then','as','for'],
 'no':['not','any','never'],'any':['some','many','no'],
 'make':['do','have','take'],'take':['make','get','do'],'made':['done','taken','make'],
 'do':['make','does','did'],'get':['take','give','make'],
 'doing':['do','done','to do'],'being':['be','been','is']
};
const wordCount=s=>String(s).trim().split(/\s+/).filter(Boolean).length;
function hasKeyword(s,keyword){return new RegExp('(^|\\W)'+esc(keyword)+'(?=\\W|$)','i').test(s)}
function produceTraps(real,keyword,valid,existing=[]){
 const base=String(real).replace(/\(([^)]+)\)/g,'').replace(/\s+/g,' ').trim();
 const accepted=new Set(normForms(valid));
 const candidates=[],tokens=base.split(/\s+/);
 const add=(v,reason)=>{
    /* === BLOCK-1-TRAP-GUARD-START === */
    if (reason === 'missing-word') {
      const _rTok = String(real || '').trim().split(/\s+/).filter(Boolean);
      const _cTok = String(v || '').trim().split(/\s+/).filter(Boolean);
      const _safeInternal = new Set(['a','an','the','to','of','in','on','at','for','with','about','from','by','as','up','out']);
      if (_cTok.length < 2 || _rTok.length < 3) return;
      if (_cTok[0].toLowerCase() !== _rTok[0].toLowerCase()) return;
      if (_cTok[_cTok.length - 1].toLowerCase() !== _rTok[_rTok.length - 1].toLowerCase()) return;
      if (_cTok.length === _rTok.length - 1) {
        let _dropped = '';
        for (let _i = 0, _j = 0; _i < _rTok.length; _i++) {
          if (_j < _cTok.length && _rTok[_i].toLowerCase() === _cTok[_j].toLowerCase()) _j++;
          else { _dropped = _rTok[_i].toLowerCase(); break; }
        }
        if (!_safeInternal.has(_dropped)) return;
      }
    }
    /* === BLOCK-1-TRAP-GUARD-END === */
  v=String(v).replace(/\s+/g,' ').trim();
  if(!v||accepted.has(norm(v))||!hasKeyword(v,keyword))return;
  if(wordCount(v)<2||wordCount(v)>5||norm(v)===norm(base))return;
  if(!candidates.some(x=>norm(x.value)===norm(v)))candidates.push({value:v,reason});
 };
 for(const v of existing)add(v,'hand-reviewed-pilot');
 for(let i=0;i<tokens.length;i++){
  const word=tokens[i],w=word.replace(/[^a-zA-Z']/g,'').toLowerCase();
  if(w===keyword.toLowerCase())continue;
  for(const alt of changes[w]||[]){const t=tokens.slice();t[i]=alt;add(t.join(' '),'grammatical-contrast');}
 }
 for(let i=0;i<tokens.length;i++){
  const w=tokens[i],low=w.toLowerCase();
  if(low===keyword.toLowerCase())continue;
  const t=tokens.slice();
  const roots={taking:'take',making:'make',giving:'give',having:'have',coming:'come',writing:'write',stealing:'steal',getting:'get',running:'run',stopping:'stop',swimming:'swim',putting:'put',being:'be',doing:'do',going:'go',seeing:'see',saying:'say',using:'use',lying:'lie',dying:'die'};
  if(low.endsWith('ing')&&low.length>5){
    let stem=roots[low]||low.slice(0,-3);
    if(/([b-df-hj-np-tv-z])\1$/.test(stem))stem=stem.slice(0,-1);
    if(low.endsWith('ving')&&!roots[low])stem+='e';
    t[i]=stem;add(t.join(' '),'verb-form');
  }
  const pastRoots={stopped:'stop',relieved:'relieve',thanked:'thank',refused:'refuse',decided:'decide',used:'use',lived:'live',asked:'ask',worked:'work',played:'play',looked:'look',called:'call',wanted:'want',needed:'need',dropped:'drop',tried:'try',carried:'carry',arrived:'arrive',agreed:'agree'};
  if(pastRoots[low]){t[i]=pastRoots[low];add(t.join(' '),'verb-form');}
  if(low.endsWith('s')&&low.length>3){t[i]=low.slice(0,-1);add(t.join(' '),'agreement');}
  if(/^[a-z]+$/i.test(w)&&w.length>3&&i>0&&tokens[i-1].toLowerCase()==='to'){const irreg={chat:'chatting',stop:'stopping',plan:'planning',run:'running',swim:'swimming',sit:'sitting',take:'taking',make:'making',write:'writing',come:'coming',give:'giving',live:'living',have:'having',use:'using'};t[i]=irreg[low]||(low.endsWith('e')?low.slice(0,-1)+'ing':low+'ing');add(t.join(' '),'infinitive-gerund');}
 }
 // Strong grammatical differences; no unrelated random words.
 if(tokens.length<=4){
  for(let i=0;i<tokens.length;i++){
   if(tokens[i].toLowerCase()===keyword.toLowerCase())continue;
   const t=tokens.slice();t.splice(i,1);add(t.join(' '),'missing-word');
  }
 }
 if(tokens.length>=2){
  for(let i=0;i<tokens.length-1;i++){
   if(tokens[i].toLowerCase()===keyword.toLowerCase()||tokens[i+1].toLowerCase()===keyword.toLowerCase())continue;
   const t=tokens.slice();[t[i],t[i+1]]=[t[i+1],t[i]];add(t.join(' '),'word-order');
  }
 }
 if(candidates.length<3){
   // Short answers also get plausible verb-pattern and polarity traps.
   const stem=w=>({stealing:'steal',lying:'lie',dying:'die',running:'run',getting:'get',making:'make',having:'have',going:'go',taking:'take',giving:'give',writing:'write',coming:'come',stopping:'stop',swimming:'swim',putting:'put',being:'be',doing:'do',using:'use'}[w]||(w.endsWith('ing')?w.slice(0,-3):w));
   for(let i=0;i<tokens.length;i++){
    if(tokens[i].toLowerCase()===keyword.toLowerCase())continue;
    const t=tokens.slice();
    for(const v of ['not '+tokens[i],'to '+stem(tokens[i]),'have '+tokens[i],'being '+tokens[i],'was '+tokens[i]]){
      t[i]=v;add(t.join(' '),'verb-pattern');
    }
   }
 }
 if(candidates.length<3)throw Error('Insufficient keyword distractors: '+keyword+' / '+real);
 // Pick different mechanisms and positions where possible, prioritizing hand-authored.
 const picked=[],seenPositions=new Set();
 // Hand-written traps first. For generated traps, vary which grammatical
 // feature is tested instead of repeating three near-identical prepositions.
 const ranked=[
  ...candidates.filter(x=>x.reason==='hand-reviewed-pilot'),
  ...candidates.filter(x=>x.reason==='grammatical-contrast'),
  ...candidates.filter(x=>x.reason==='verb-form'||x.reason==='agreement'||x.reason==='infinitive-gerund'),
  ...candidates.filter(x=>x.reason==='verb-pattern'||x.reason==='word-order'||x.reason==='missing-word')
 ];
 const diffIndex=v=>{
  const aa=base.split(' '),bb=v.split(' ');
  for(let i=0;i<Math.min(aa.length,bb.length);i++)if(norm(aa[i])!==norm(bb[i]))return i;
  return Math.min(aa.length,bb.length);
 };
 for(const x of ranked){
  const idx=diffIndex(x.value);
  if(picked.length>=3)break;
  if(seenPositions.has(idx))continue;
  picked.push(x);seenPositions.add(idx);
 }
 for(const x of ranked){if(picked.length>=3)break;if(!picked.some(p=>p.value===x.value))picked.push(x);}
 return picked.slice(0,3);
}
function newQuestion(q){
  /* === BLOCK-1-NEWQ-HOOK-START === */
  applyCuratedPart4Override(q);
  /* === BLOCK-1-NEWQ-HOOK-END === */
 if(output.some(x=>x.id===q.id||x.fingerprint===q.fingerprint))throw Error('Duplicate id/fingerprint '+q.id);
 if(q.a.length!==4||new Set(q.a.map(norm)).size!==4||q.c<0||q.c>3)throw Error('Bad answers/options '+q.sourcePart+'/'+q.id);
 if(q.q.split('___').length!==2)throw Error('Expected one gap '+q.id+' '+q.q);
 if(!q.a.some(x=>norm(x)===norm(q.a[q.c])))throw Error('No correct option '+q.id);
 output.push(q);
}
for(const p of originals){
 const exam=Number(p.examNumber);
 if(!Number.isInteger(exam)||exam<1||exam>30)throw Error('Wrong exam number');
 for(const part of [1,2,3]){
  const o=p.parts?.[part];if(!o)throw Error('Missing part '+exam+'/'+part);
  const gaps=o.segments.filter(s=>s&&typeof s==='object'&&Number.isInteger(s.n));
  if(gaps.length!==8)throw Error('Wrong 8 gaps '+exam+'/'+part);
  for(const node of gaps){
   const key=[exam,part,node.n].join(':'),known=prior.get(key);
   if(!known&&part!==1)throw Error('Prior distractor bank incomplete '+key);
   const correct=answers(node)[0],valid=answers(node),a=part===1?node.options:[...(known?.a||[])];
   if(a.length!==4)throw Error('Bad options '+key);
   const accepted=new Set(normForms(valid));
   if(!a.some(v=>accepted.has(norm(v))))throw Error('Correct answer missing '+key);
   if(a.filter(v=>accepted.has(norm(v))).length!==1)throw Error('Ambiguous options '+key);
   const q={
    id:known?.id??(900000+exam*100+node.n),cat:part===1?'exam_core':'exam_part'+part,
    skill:'B2 First · Part '+part,templateId:'exam-'+exam+'-p'+part+'-q'+node.n,
    domain:exam<=10?'cambridge':'engexam',q:sentenceFromSegments(o,node)+(part===3?' ('+node.base+')':''),
    a,c:a.findIndex(x=>accepted.has(norm(x))),
    rule:node.explanation||'Solución registrada en el examen de origen.',
    trigger:correct.toUpperCase(),targetTime:8.5,difficulty:'B2',
    fingerprint:known?.fingerprint??('exam-quiz|'+exam+'|'+part+'|'+node.n),
    focus:[],sourceType:'exam-core',sourcePart:part,contentOrigin:'literal-exam-quiz',
    sourceExam:exam,sourceQuestion:node.n,sourceLabel:sourceLabel(p),
    networkFamily:'exam-'+exam+'-p'+part+'-q'+node.n,acceptedForms:valid,
    answerKeyStatus:exam<=10?'cambridge-supplied-key':'engexam-source-key',
    distractorOrigin:part===1?'original-A-B-C-D':'previous-reviewed-quiz'
   };
   if(part===1&&!q.q.includes('___'))throw Error('Missing target gap '+key);
   newQuestion(q);
  }
 }
 const items=exam<=10?cam4[String(exam)]:p.parts[4]?.items;
 if(!Array.isArray(items)||items.length!==6)throw Error('Missing Part 4 '+exam);
 for(const item of items){
  let variants=answers(item); const keyword=item.keyword;
  if(exam===24&&item.n===27){variants=['is rumoured to be'];warnings.push('Exam 24 Part 4 Q27: source key uses US spelling rumored; adjusted to mandatory British keyword RUMOURED.');}
  const correct=variants[0].replace(/\(([^)]+)\)/g,'').trim();
  if(!hasKeyword(correct,keyword))throw Error('Keyword missing correct answer '+exam+':'+item.n+'/'+correct+' keyword '+keyword);
  const trained=pilot[exam+':'+item.n]||[];
  const traps=produceTraps(correct,keyword,variants,trained);
  const q={
   id:960000+exam*100+item.n,cat:'exam_part4',skill:'B2 First · Part 4',
   templateId:'exam-'+exam+'-p4-q'+item.n,domain:exam<=10?'cambridge':'engexam',
   q:item.first+'\n'+ 'KEY WORD: '+keyword+'\n'+item.secondBefore+'___'+item.secondAfter,
   a:[correct,...traps.map(x=>x.value)],c:0,
   rule:item.explanation||'Clave del examen: '+variants.join(' / '),
   trigger:correct.toUpperCase(),targetTime:11,difficulty:'B2',
   fingerprint:'exam-quiz|'+exam+'|4|'+item.n,focus:[],
   sourceType:'exam-core',sourcePart:4,contentOrigin:'literal-exam-quiz',
   sourceExam:exam,sourceQuestion:item.n,sourceLabel:sourceLabel(p),
   networkFamily:'exam-'+exam+'-p4-q'+item.n,
   acceptedForms:variants,answerKeyStatus:exam===24&&item.n===27?'editorial-correction-checked':exam<=10?'cambridge-supplied-key':'engexam-source-key',
   distractorOrigin:trained.length?'hand-reviewed-pilot-and-grammar':'grammar-traps-provisional',
   distractorReasons:traps.map(x=>x.reason),
   keyword
  };
  newQuestion(q);
 }
}
if(output.length!==900)throw Error('Expected 900 cards, got '+output.length);
const sizes=[1,2,3,4].map(part=>output.filter(q=>q.sourcePart===part).length);
if(sizes.join(',')!=='240,240,240,180')throw Error('Bad coverage: '+sizes);
const campaign={
 ...prev,title:'English Cloze · B2 First · 30 exámenes originales · Parts 1–4',
 version:'exams-literal-mcq-1.0',targetExercises:900,
 skills:[{id:'exam_core',name:'Part 1 · Multiple-choice cloze'},
 {id:'exam_part2',name:'Part 2 · Open cloze'},
 {id:'exam_part3',name:'Part 3 · Word formation'},
 {id:'exam_part4',name:'Part 4 · Key word transformations'}],
 questions:output
};
fs.writeFileSync(path.join(here,'territory-01.json'),JSON.stringify(campaign));
fs.writeFileSync(path.join(here,'territory-01.js'),'window.__AE_CAMPAIGN__='+JSON.stringify(campaign)+';\n');
const qa={
 compiledAt:'2026-10-21',questionCount:output.length,coverage:sizes,
 sources:{Cambridge:10,EngExam:20},
 part4DistractorOrigins:{
  piloted:output.filter(x=>x.sourcePart===4&&x.distractorOrigin.startsWith('hand')).length,
  provisional:output.filter(x=>x.sourcePart===4&&x.distractorOrigin.startsWith('grammar')).length
 },
 part4Samples:output.filter(q=>q.sourcePart===4).slice(0,15).map(q=>({exam:q.sourceExam,n:q.sourceQuestion,q:q.q,answers:q.a,why:q.distractorReasons})),
 problems,warnings
};
fs.writeFileSync(path.join(here,'exam-quiz-source-qa.json'),JSON.stringify(qa,null,2));
console.log(JSON.stringify({pass:true,bank:900,coverage:sizes,part4:qa.part4DistractorOrigins,qa:'exam-quiz-source-qa.json'}));
