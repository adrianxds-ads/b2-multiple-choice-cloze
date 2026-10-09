'use strict';
// Regenerate Cloze Quiz Cambridge Parts 2/3 from the verified local 30-exam source.
// Dry run by default. Run with --apply to update both campaign formats.
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=path.resolve(__dirname,'../cambridge-quiz-feature/data');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['cambridge-quiz-transcribed.js','engexam-bank.js'])
  vm.runInContext(fs.readFileSync(path.join(source,file),'utf8'),ctx,{filename:file});
const exams=[...ctx.window.ADAPTIVE_EXAM_TRANSCRIBED_CAMBRIDGE_PAPERS,...ctx.window.ADAPTIVE_EXAM_PAPERS];
const campaign=JSON.parse(fs.readFileSync(path.join(__dirname,'territory-01.json'),'utf8'));
const old=campaign.questions.filter(q=>q.contentOrigin!=='cambridge-part-2'&&q.contentOrigin!=='cambridge-part-3');
if(old.length!==1610||exams.length!==30)throw Error('Unexpected bank baseline '+old.length+'/'+exams.length);
const unique=arr=>[...new Set(arr.map(x=>String(x).trim().toLowerCase()).filter(Boolean))];
function accepted(item){return unique((item.answers||[item.answer]).flatMap(x=>{
  const s=String(x).trim(),m=s.match(/^(.+)\(([^)]+)\)$/);
  return m?[m[1],m[1]+m[2]]:[s];
}));}
// Deliberately close grammatical and lexical competitors; no random distractors from unrelated questions.
const groups={
  prep:'in on at by with for of to into from out up off over across through under between among without despite during before after until since about against around beyond within',
  rel:'what which that who whom whose where when why how whether',
  det:'a an the this that these those one another each every some any no all many few much little',
  pron:'it its they them their he him his she her we us our ourselves myself itself himself themselves you your',
  aux:'am is are was were be been being have has had do does did can could would should will might may must',
  adv:'so too much more most less least well quite very rather still just already even ever never only always',
  link:'although though while whereas if unless because since despite however therefore but and so yet when',
  verb:'make do take have get give put come go work turn bring look keep hold pay let set use help find become',
  action:'put take give make have spend get come looked went died draw work sketch putting taking gone known made',
  other:'without apart order fact charge spite account top case long short country region together same ago first last',
  none:'something anything everything nothing everyone everybody someone anyone no one other another neither either'
};
const special={
  in:'on at into by within',on:'in at over onto by',to:'for with into on from',for:'to of with from by',
  with:'by from to for at',as:'like than by for with',out:'off up in over away',up:'out down off away over',
  a:'an the one some any',the:'a an this that no',not:'no never neither yet still',
  which:'what that who when whose',what:'which that how who why',where:'when why which what how',
  how:'what why which when where',who:'which whose whom that what',whose:'who whom which that what',
  unlike:'like despite as whereas instead',such:'so this those very these',
  what:'which that how who why',even:'only still just rather also',
  made:'done given taken had put',known:'called named seen regarded considered',
  able:'ready capable willing likely unable',long:'far much well short little',
  ago:'before since back after formerly',ever:'never already yet often still',
  much:'many more less little enough',less:'more much fewer least little',least:'most less more best little',
  apart:'away aside beyond except beside',spite:'fact case view place account',
  country:'nation region state district province',charge:'control possession command care duty',
  order:'case attempt place way view',fact:'truth effect reality theory practice',
  take:'make give put get do',give:'make take bring have put',
  get:'become make turn take grow',come:'go bring get turn take',put:'give take make get keep',
  since:'for from until during after',after:'before since during until for',
  though:'although whereas because despite while',if:'unless whether when although because',
  have:'has had make get do',was:'were is had has did',
  everyone:'anyone somebody nobody everything anybody',
  something:'anything everything nothing someone somebody',
  myself:'himself herself itself ourselves me',
  which:'what that who when whose'
};
const membership={
  prep:'in on at by with for of to into from out up off over across through under between among without despite during before after until since about against around beyond within like unlike',
  rel:'what which that who whom whose where when why how whether',
  det:'a an the this that these those one another each every some any no all many few much little',
  pron:'it its they them their he him his she her we us our ourselves myself itself himself themselves you your everyone everybody someone anyone something anything',
  aux:'am is are was were be been being have has had do does did can could would should will might may must',
  adv:'so too much more most less least well quite very rather still just already even ever never only always ago',
  link:'although though while whereas if unless because since despite however therefore but and so yet when',
  verb:'make do take have get give put come go work turn bring look keep hold pay let set use help find become known made'
};
const inGroup={};for(const [grp,list] of Object.entries(membership))for(const w of list.split(' '))(inGroup[w]||(inGroup[w]=[])).push(grp);
const forms={
  DISCOVER:'discover discovery discoveries discovered discovering',
  SCIENCE:'science scientist scientists scientific scientifically',
  KNOW:'know known knowing knowledge knowledgeable',
  BELIEVE:'believe belief believable unbelievable believing',
  INCLUDE:'include included inclusion including inclusive',
  ADDITION:'addition additional additionally add added',
  ROUGH:'rough roughly roughness rougher',
  EXPECT:'expect expected expectation expectations unexpected',
  BENEFIT:'benefit beneficial beneficiary benefits',
  ENERGY:'energy energetic energetically energise energised',
  LONG:'long longer length lengthy lengthen',
  LIFE:'life lives lifestyle lifelong lively',
  LIKE:'like likely unlike likelihood likeness',
  BEHAVE:'behave behaviour behaviours behavioural behaving',
  DAY:'day daily days daytime',
  AUTOMATIC:'automatic automatically automation automatism',
  BREATH:'breath breathe breathing breathtaking breathless',
  BEAUTY:'beauty beautiful beautifully beautify',
  INSPIRE:'inspire inspired inspiration inspiring inspirational',
  IMPRESS:'impress impression impressive impressively',
  EDUCATE:'educate education educational educated',
  ACCESS:'access accessible accessibility inaccessible',
  ADMIT:'admit admission admittance admitted',
  LIMIT:'limit limited limitless unlimited limitation',
  WEALTH:'wealth wealthy wealthier wealthily',
  CONSEQUENCE:'consequence consequential consequently consequences',
  CHILD:'child children childhood childish',
  CRITIC:'critic critical criticism critically',
  SUIT:'suit suitable suitability unsuitable',
  COURAGE:'courage courageous encourage discouraged',
  PRODUCE:'produce produced product productive producer production',
  DIE:'die dying dead death',
  CONTRIBUTE:'contribute contributed contribution contributor',
  ORIGIN:'origin original originally originality',
  FREEZE:'freeze frozen freezing freezer',
  VISION:'vision visible visual visibility invisible',
  DESIGN:'design designer designed designing',
  EFFECT:'effect effective effectively efficient efficiency',
  PLACE:'place placed replaced replacement',
  CONSIDER:'consider considering considerable considerably consideration',
  SURF:'surf surfer surfers surfing',
  POPULAR:'popular popularity popularly unpopular',
  REASONABLE:'reason reasonable reasonably unreasonable',
  DEPEND:'depend dependent depending dependence independent',
  HIGH:'high higher height highly',
  WIDE:'wide widely widen width wider',
  LEGAL:'legal illegal legally legality',
  MATHEMATICS:'mathematics mathematician mathematical',
  PRODUCT:'product products produce produced producer production',
  ABLE:'able unable ability enable enabling',
  SOLVE:'solve solved solution solutions solving',
  NOVEL:'novel novelist novels novelty',
  DRAMA:'drama dramatic dramatically',
  ACHIEVE:'achieve achievement achievements achievable',
  APPEAR:'appear appeared appearance disappear disappeared',
  MASS:'mass massive massively masses',
  STORE:'store stored storage storing',
  POSSIBLE:'possible impossible possibility possibly',
  EXPECTED:'expected unexpected unexpectedly expecting',
  SURPRISE:'surprise surprising surprisingly surprised',
  ART:'art arts artist artistic artistically',
  SPECTACLE:'spectacle spectacular spectacularly',
  SURPRISING:'surprising surprisingly unsurprising unsurprisingly',
  ENTHUSIASM:'enthusiasm enthusiastic enthusiast enthusiastically',
  ACCURATE:'accurate accuracy accurately inaccurate',
  ARRIVE:'arrive arrival arrived arriving',
  COMBINE:'combine combined combination combining',
  MEASURE:'measure measured measurement measurements',
  PREDICT:'predict prediction predictable unpredictable',
  CERTAIN:'certain certainty certainly uncertain uncertainty',
  SATISFY:'satisfy satisfied satisfying satisfaction dissatisfied',
  SUCCESS:'success successful successfully succeed',
  COVER:'cover covered covering discover discovered',
  IMPROVE:'improve improvement improving improved',
  PERFORM:'perform performance performer performing',
  TRUE:'true truth truly truthful',
  RELATION:'relate relation relative relationship relationships',
  ABSENT:'absent absence absentee',
  APPROPRIATE:'appropriate appropriately inappropriate inappropriately',
  FORTUNATE:'fortunate fortunately unfortunately unfortunate',
  EASY:'easy easily easier ease',
  CREDIBLE:'credible incredible credibility incredibly',
  DESCRIBE:'describe description descriptive described',
  SURROUND:'surround surrounding surrounded surroundings',
  FAR:'far farther further farthest',
  DIFFICULT:'difficult difficulty difficulties',
  BEGIN:'begin beginning beginner beginners',
  DANGER:'danger dangerous dangerously endangered',
  OBSERVE:'observe observer observant observation',
  REFUTE:'refute refutation irrefutable irrefutably',
  DECORATE:'decorate decoration decorative decorated',
  FOOL:'fool foolish foolishly foolishness',
  NECESSARY:'necessary necessity necessarily unnecessary',
  FLASH:'flash flashy flashing flashed',
  APPRECIATE:'appreciate appreciation appreciative appreciated',
  ADAPT:'adapt adapted adaptable adaptation',
  MANAGE:'manage manager management managerial manageable',
  BEAR:'bear bearable unbearable bearing',
  TEMPT:'tempt tempting temptation tempted',
  ABSOLUTE:'absolute absolutely',
  CONFER:'confer conference conferring conferred',
  RECEIVE:'receive received reception receptionist',
  INTEND:'intend intended intention intentions',
  MODERN:'modern modernise modernising modernizing modernization',
  DELIGHT:'delight delightful delighted delightfully',
  INVITE:'invite invited invitation inviting',
  EMPLOY:'employ employer employee employment',
  EXTEND:'extend extended extensive extensively extension',
  POSSESS:'possess possession possessions possessive',
  ARRANGE:'arrange arrangement arrangements arranged',
  TRANSFORM:'transform transformed transformation',
  INTRODUCE:'introduce introduction introductions introductory',
  POLITE:'polite politely impolite politeness',
  COME:'come came coming overcome',
  CHARACTER:'character characterise characteristics characteristic',
  VARY:'vary various variation variety varied',
  SURE:'sure surely ensure ensuring assurance',
  WORK:'work worker works network networking',
  STEADY:'steady steadily unsteady steadiness',
  STRESS:'stress stressed stressful stressfully',
  RISK:'risk risks risky',
  COMMERCE:'commerce commercial commercially',
  DECIDE:'decide decision decisions decisive',
  INCREASE:'increase increased increasing increasingly',
  CONSUME:'consume consumer consumers consumption',
  LOYAL:'loyal loyalty loyally disloyal',
  MANUFACTURE:'manufacture manufacturer manufacturers manufacturing',
  PROFIT:'profit profitable profitability profitably',
  AGREE:'agree agreed agreement disagreement',
  HEALTH:'health healthy unhealthy healthily',
  ADD:'add added addition additional',
  PRESS:'press pressure pressing pressed',
  ADVANTAGE:'advantage advantageous disadvantage disadvantaged',
  SPICE:'spice spicy spiced spices',
  DESTROY:'destroy destroyed destruction destructive',
  DEFEND:'defend defended defences defenses defensive',
  CREATE:'create created creative creation creativity',
  SUBSTANCE:'substance substantial substantially',
  AMBITION:'ambition ambitious ambitiously',
  CLEAR:'clear clearly unclear clarity',
  EXIST:'exist exists existence existing',
  POLITICS:'politics political politician politicians',
  SHORT:'short shorter shortage shorten',
  SPECIAL:'special specially specialise specialist',
  LOSE:'lose lost loss losing',
  CONSTRUCT:'construct construction constructive constructed',
  USE:'use used useful useless usage',
  ATTRACT:'attract attracted attraction attractive attractions',
  REPUTE:'repute reputed reputation reputable',
  EXTREME:'extreme extremely extremity',
  CHOOSE:'choose chose chosen choice choosing',
  NATURE:'nature natural naturally unnatural',
  CYCLE:'cycle cycles cycling recycle recyclable',
  SEARCH:'search research researcher searched',
  ISOLATE:'isolate isolated isolation isolating',
  MIX:'mix mixed mixture mixing',
  FEED:'feed fed feedback feeding',
  EMOTION:'emotion emotions emotional emotionally',
  INFORM:'inform informed information informative',
  SENSE:'sense sensible sensitive sensitivity',
  INVESTIGATE:'investigate investigated investigation investigations',
  SIGNIFY:'signify significant significance significantly',
  COMFORT:'comfort comfortable comfortably uncomfortable',
  REAL:'real really reality unreal realistic',
  FASHION:'fashion fashionable unfashionable fashionably',
  PLEASE:'please pleased pleasant pleasure pleasures',
  FORGET:'forget forgot forgotten unforgettable forgetful',
  ESTABLISH:'establish established establishment',
  INHABIT:'inhabit inhabitant inhabitants inhabited',
  SAIL:'sail sailing sailor sailed',
  ADVISE:'advise advised adviser advice advisable',
  AFFORDABLE:'affordable unaffordable afford affordability',
  PATIENT:'patient impatient patience patiently',
  REVERSIBLE:'reversible irreversible reverse reversal',
  ROMANCE:'romance romantic romantically',
  EXPLAIN:'explain explanation explanatory explained',
  HOSPITABLE:'hospitable hospitality hospitably',
  SIMPLE:'simple simply simplicity simplify',
  NATIONAL:'nation national international internationally',
  ORIGINAL:'original originally originality origin',
  AFFORD:'afford affordable unaffordable affordability',
  APPEAL:'appeal appealing unappealing appealed',
  IDENTIFY:'identify identified identity identification',
  SENSITIVE:'sensitive insensitive sensitivity sensitively',
  RESPONSIBLE:'responsible irresponsible responsibility responsibly',
  ILL:'ill illness illnesses'
};
const fromBank={};for(const ex of exams)for(const it of ex.parts[3].segments.filter(x=>x&&typeof x==='object'))(fromBank[it.base]||(fromBank[it.base]=[])).push(...accepted(it));
function openOptions(word,valid,v){
  let pool=unique([...(special[word]||'').split(' '),...(inGroup[word]||[]).flatMap(g=>groups[g].split(' '))]).filter(x=>x!==word&&!valid.includes(x));
  if(pool.length<6)pool=unique([...pool,...groups.verb.split(' '),...groups.other.split(' ')]).filter(x=>x!==word&&!valid.includes(x));
  return pool.slice(v*3,v*3+3);
}
function wordOptions(base,word,valid,v){
  let pool=unique([...(forms[base]||'').split(' '),...(fromBank[base]||[])]).filter(x=>!valid.includes(x));
  if(pool.length<6){
    let extras=[base.toLowerCase()];
    const b=base.toLowerCase();
    if(b.endsWith('e'))extras.push(b+'d',b.slice(0,-1)+'ing',b+'s');
    else if(b.endsWith('y'))extras.push(b.slice(0,-1)+'ies',b.slice(0,-1)+'ied');
    else extras.push(b+'s',b+'ing');
    if(word.endsWith('ly'))extras.push(word.slice(0,-2));
    if(word.endsWith('s'))extras.push(word.slice(0,-1));
    if(word.startsWith('un')||word.startsWith('im')||word.startsWith('in')||word.startsWith('ir'))extras.push(word.slice(2));
    if(word.startsWith('dis'))extras.push(word.slice(3));
    pool=unique([...pool,...extras]).filter(x=>!valid.includes(x));
  }
  // Reverse order for the second set, so it tests different distractors.
  if(pool.length>=6)return v===0?pool.slice(0,3):pool.slice(-3).reverse();
  return v===0?pool.slice(0,3):[];
}
function cleanExample(s){return String(s).replace(/\(?0\)?\s*_{3,}/g,'…').replace(/_{3,}/g,'…');}
function left(s){const w=cleanExample(s).trim().split(/\s+/);return (w.length>12?'… ':'')+w.slice(-12).join(' ');}
function right(s){const w=cleanExample(s).trim().split(/\s+/);return w.slice(0,9).join(' ')+(w.length>9?' …':'');}
const counts={2:0,3:0},gaps={2:0,3:0},issues=[],rows=[];
for(const ex of exams)for(const part of [2,3]){
 const seg=ex.parts[part].segments;
 for(let j=1;j<seg.length;j+=2){
  const item=seg[j],valid=accepted(item),answer=valid[0],base=String(item.base||'').toUpperCase(),n=Number(item.n),exam=Number(ex.examNumber);
  const q=(left(seg[j-1])+' ___ '+right(seg[j+1])+(part===3?' ('+base+')':'')).replace(/\s+/g,' ').trim();
  gaps[part]++;
  for(const v of [0,1]){
   const wrong=part===2?openOptions(answer,valid,v):wordOptions(base,answer,valid,v);
   if(wrong.length!==3||unique(wrong).length!==3){issues.push('no variant '+(v+1)+' exam '+exam+' p'+part+' q'+n);continue;}
   const key='cambridge-p'+part+'-'+String(exam).padStart(2,'0')+'-'+n;
   const c=(exam+n+v*3)%4,a=wrong.slice();a.splice(c,0,answer);
   rows.push({id:920000+part*10000+exam*100+n*2+v,cat:'exam_core',
     skill:part===2?'Cambridge Part 2 · Open cloze':'Cambridge Part 3 · Word formation',
     templateId:key,domain:part===2?'cambridge-open':'cambridge-word',
     q,a,c,rule:(part===3?base+' → '+answer+'. ':'')+(part===2?'Open cloze. ':'Word formation. ')+String(item.explanation||'').replace(/^Clave oficial Cambridge\.\s*/,'').slice(0,210),
     trigger:part===3?base+' → '+answer.toUpperCase():answer.toUpperCase(),
     targetTime:part===3?10.5:8.5,difficulty:'B2',
     fingerprint:'cambridge|p'+part+'|'+exam+'|'+n+'|v'+(v+1),focus:[],
     sourceType:'exam-core',sourcePart:part,contentOrigin:'cambridge-part-'+part,sourceExam:exam,sourceQuestion:n,
     sourceLabel:ex.label,networkFamily:key,acceptedAnswers:valid,distractorVariant:v+1});
   counts[part]++;
  }
 }
}
const ids=new Set(old.map(q=>q.id)),fps=new Set(old.map(q=>q.fingerprint));
for(const x of rows){if(ids.has(x.id)||fps.has(x.fingerprint)||unique(x.a).length!==4||x.a.some((w,i)=>i!==x.c&&x.acceptedAnswers.includes(w)))throw Error('Invalid card '+x.id);ids.add(x.id);fps.add(x.fingerprint);}
const report={sources:exams.length,old:old.length,gaps,added:counts,total:old.length+rows.length,issues,
 sample:rows.filter(x=>x.distractorVariant===1&&[9,10,11,17,18,19].includes(x.sourceQuestion)).slice(0,50).map(x=>({exam:x.sourceExam,part:x.sourcePart,question:x.q,options:x.a,answer:x.a[x.c]}))};
fs.writeFileSync(path.join(__dirname,'cambridge-expansion-qa.json'),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--apply')){
 for(const q of old)if(q.sourceType==='exam-core'&&!q.sourcePart)q.sourcePart=1;
 campaign.questions=old.concat(rows);campaign.targetExercises=campaign.questions.length;campaign.version='2026-10-09.1';
 campaign.territory.examAnchors=old.filter(x=>x.sourceType==='exam-core').length+rows.length;
 campaign.territory.cambridgePart2=counts[2];campaign.territory.cambridgePart3=counts[3];campaign.territory.cambridgeRealGaps=gaps[2]+gaps[3];
 const payload=JSON.stringify(campaign,null,2);
 fs.writeFileSync(path.join(__dirname,'territory-01.json'),payload+'\n');
 fs.writeFileSync(path.join(__dirname,'territory-01.js'),'window.__AE_CAMPAIGN__ = '+payload+';\n');
 fs.writeFileSync(path.join(__dirname,'README.md'),'# Close Quiz · B2 First\n\nBanco: '+campaign.questions.length+' tarjetas; 1.610 originales intactas y '+rows.length+' tarjetas nuevas de Parts 2 y 3, derivadas de '+(gaps[2]+gaps[3])+' huecos reales de los 30 exámenes del banco Cambridge. Comparten familia de repaso las variantes del mismo hueco. 15 preguntas y 15 segundos, algoritmo original y progreso conservados.\n\nRegenerar: node generate-cambridge-expansion.cjs --apply. Auditoría: cambridge-expansion-qa.json.\n');
}
console.log('PAPERS='+exams.length+' ORIGINAL='+old.length+' GAPS='+JSON.stringify(gaps)+' NEW='+JSON.stringify(counts)+' TOTAL='+report.total+' ISSUES='+issues.length+' APPLIED='+process.argv.includes('--apply'));
if(issues.length)console.log(issues.slice(0,70).join('\n'));
