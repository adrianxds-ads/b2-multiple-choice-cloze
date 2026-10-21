'use strict';
/* Source-of-truth: the existing, separately maintained Cambridge B2 30-paper bank.
   NEVER generate replacements, paraphrases or extra distractors here.
   Questions in Parts 2/3 are typed as in the original paper. */
(() => {
  const KEY='cloze_original_papers_v1',SESSION_LENGTH=15,ANSWER_SECONDS=15;
  const $=id=>document.getElementById(id);
  let all=[],mode='all',state={attempts:{}},plan=[],index=0,correct=0,phase='idle',interval=null,deadline=0,token=0;
  const clearClock=()=>{if(interval!==null)clearInterval(interval);interval=null;};
  const text=(id,value)=>{$(id).textContent=String(value??'');};
  const screen=name=>{for(const id of ['home','game','finish'])$(id).hidden=id!==name;window.scrollTo(0,0);};
  const normalize=x=>String(x??'').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
  const answerForms=q=>(Array.isArray(q.node.answers)&&q.node.answers.length?q.node.answers:[q.node.answer]).map(normalize).filter(Boolean);
  const displayLabel=q=>q.paper.label||('Exam '+String(q.exam).padStart(2,'0'));
  const partName=n=>({1:'Multiple-choice cloze',2:'Open cloze',3:'Word formation'}[n]||'');
  function loadProgress(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'null');
      if(saved&&saved.schema===1&&saved.attempts&&typeof saved.attempts==='object')state=saved;
    }catch(error){console.warn('Original exam progress could not be read; no saved data was overwritten',error);}
  }
  function saveProgress(){
    try{localStorage.setItem(KEY,JSON.stringify({schema:1,attempts:state.attempts}));}catch(error){console.warn('Cannot save progress',error);text('status','No se pudo guardar el progreso en este dispositivo.');}
  }
  function loadBank(){
    const w=window;
    const cam=w.ADAPTIVE_EXAM_TRANSCRIBED_CAMBRIDGE_PAPERS,eng=w.ADAPTIVE_EXAM_PAPERS;
    if(!Array.isArray(cam)||cam.length!==10||!Array.isArray(eng)||eng.length!==20)throw Error('No están disponibles los 30 originales.');
    const papers=[...cam,...eng],questions=[],keys=new Set();
    for(const paper of papers){
      const exam=Number(paper.examNumber);
      for(const p of [1,2,3]){
        const part=paper.parts?.[p];
        if(!part||!Array.isArray(part.segments))throw Error('Falta '+exam+' · Part '+p);
        const gaps=part.segments.filter(s=>s&&typeof s==='object'&&Number.isInteger(s.n));
        if(gaps.length!==8)throw Error('No hay ocho huecos en '+exam+' · Part '+p);
        for(const node of gaps){
          const id='exam-'+String(exam).padStart(2,'0')+'-p'+p+'-q'+node.n;
          if(keys.has(id))throw Error('Pregunta duplicada '+id);
          keys.add(id);
          const q={id,paper,exam,part,p,node};
          if(!answerForms(q).length)throw Error('Sin solución documentada '+id);
          if(p===1&&(!Array.isArray(node.options)||node.options.length!==4||!node.options.some(x=>answerForms(q).includes(normalize(x)))))throw Error('Opciones originales incompletas '+id);
          if(p===3&&!node.base)throw Error('Falta palabra base '+id);
          questions.push(q);
        }
      }
    }
    if(questions.length!==720||keys.size!==720)throw Error('El banco literal no alcanza 720 huecos distintos.');
    return questions;
  }
  function renderTotals(){
    text('bankCount',all.length);
    const rows=Object.values(state.attempts).flat();
    text('doneCount',rows.length);
    text('accuracy',rows.length?Math.round(rows.filter(r=>r.correct).length*100/rows.length)+' %':'—');
  }
  function selectPlan(){
    const pool=all.filter(q=>mode==='all'||q.p===Number(mode));
    const grouped=new Map();
    for(const q of pool){
      const key=q.exam+'-'+q.p;
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(q);
    }
    const groups=[...grouped.entries()].map(([key,cards])=>{
      const selected=cards.map(q=>({q,seen:(state.attempts[q.id]||[]).length,rand:Math.random()}))
        .sort((a,b)=>a.seen-b.seen||a.rand-b.rand)[0];
      return {key,selected,rand:Math.random(),seen:Math.min(...cards.map(q=>(state.attempts[q.id]||[]).length))};
    });
    groups.sort((a,b)=>a.seen-b.seen||a.rand-b.rand);
    if(groups.length<SESSION_LENGTH)throw Error('No hay suficientes partes diferentes.');
    return groups.slice(0,SESSION_LENGTH).map(x=>x.selected.q);
  }
  function renderPassage(q){
    const frag=document.createDocumentFragment();
    for(const seg of q.part.segments){
      if(typeof seg==='string'){frag.appendChild(document.createTextNode(seg));continue;}
      if(!seg||typeof seg!=='object')continue;
      const span=document.createElement('span');
      span.className='gap'+(seg.n===q.node.n?' target':'');
      span.textContent='('+seg.n+') _____';
      if(seg.n===q.node.n)span.setAttribute('aria-label','Hueco actual número '+seg.n);
      frag.appendChild(span);
    }
    $('passage').replaceChildren(frag);
  }
  function showItem(){
    token++;clearClock();phase='reading';
    const q=plan[index];
    text('position',(index+1)+' / '+plan.length);
    text('examLabel',displayLabel(q));
    text('partLabel','Part '+q.p+' · '+partName(q.p));
    text('sourceTitle',q.part.title||'');
    text('instructions',q.part.instructions||'');
    text('questionLabel','Pregunta original '+q.node.n);
    text('wordBase',q.p===3?'BASE: '+q.node.base:'');
    renderPassage(q);
    $('reading').hidden=false;$('respond').hidden=true;$('feedback').hidden=true;
    $('wordInput').value='';$('wordInput').disabled=false;$('wordForm').querySelector('button').disabled=false;$('choices').replaceChildren();
    screen('game');
  }
  function startClock(){
    clearClock();const own=++token;deadline=performance.now()+ANSWER_SECONDS*1000;
    const update=()=>{
      if(phase!=='answer'||own!==token){clearClock();return;}
      const remaining=Math.max(0,(deadline-performance.now())/1000);
      text('timerLabel',remaining.toFixed(1)+' s');
      $('timeBar').style.width=(remaining/ANSWER_SECONDS*100).toFixed(1)+'%';
      if(remaining===0){clearClock();checkAnswer(null,true);}
    };
    update();interval=setInterval(update,60);
  }
  function showAnswerForm(){
    if(phase!=='reading')return;
    phase='answer';
    const q=plan[index];
    $('reading').hidden=true;$('respond').hidden=false;
    $('choices').hidden=q.p!==1;$('wordForm').hidden=q.p===1;
    if(q.p===1){
      const letters='ABCD';
      q.node.options.forEach((opt,i)=>{
        const button=document.createElement('button');
        button.type='button';button.dataset.answer=String(i);
        button.textContent=letters[i]+'. '+opt;button.addEventListener('click',()=>checkAnswer(opt,false,i));
        $('choices').appendChild(button);
      });
    }else{$('wordInput').focus({preventScroll:true});}
    $('respond').scrollIntoView({block:'nearest',behavior:'smooth'});
    startClock();
  }
  function checkAnswer(raw,timedOut=false,picked=-1){
    if(phase!=='answer')return;
    phase='feedback';token++;clearClock();
    const q=plan[index],forms=answerForms(q),submitted=normalize(raw);
    const ok=!timedOut&&forms.includes(submitted);
    const elapsed=ANSWER_SECONDS-Math.max(0,(deadline-performance.now())/1000);
    const record={correct:ok,given:String(raw??''),at:new Date().toISOString(),seconds:Math.round(Math.min(ANSWER_SECONDS,Math.max(0,elapsed))*10)/10,exam:q.exam,part:q.p,number:q.node.n};
    if(!Array.isArray(state.attempts[q.id]))state.attempts[q.id]=[];
    state.attempts[q.id].push(record);saveProgress();if(ok)correct++;
    if(q.p===1){
      for(const btn of $('choices').querySelectorAll('button')){
        btn.disabled=true;
        const n=Number(btn.dataset.answer),option=q.node.options[n];
        if(forms.includes(normalize(option)))btn.classList.add('correct');
        else if(n===picked)btn.classList.add('incorrect');
      }
    }else{$('wordInput').disabled=true;$('wordForm').querySelector('button').disabled=true;}
    text('resultText',ok?'Correcto':'No es correcto');
    $('resultText').className=ok?'ok':'no';
    text('correctText','Solución: '+(q.node.answers?.length?q.node.answers.join(' / '):q.node.answer));
    text('explanation',q.node.explanation?.trim()||'La fuente aporta la respuesta, pero no incluye una explicación.');
    text('answerSource',q.exam<=10?'Fuente: Cambridge · clave registrada en el banco maestro.':'Fuente: EngExam · solución del material original (no clave oficial Cambridge).');
    $('feedback').hidden=false;$('next').textContent=index+1===plan.length?'VER RESULTADOS':'CONTINUAR';
    $('feedback').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function finish(){
    phase='done';clearClock();
    text('finishScore',correct+' / '+plan.length);
    text('finishSummary','Aciertos en preguntas literales de nuestros 30 exámenes. Las soluciones y los intentos quedan registrados de forma independiente del repaso antiguo.');
    renderTotals();screen('finish');
  }
  function start(){
    if(!all.length)return;
    plan=selectPlan();index=0;correct=0;showItem();
  }
  function leave(){phase='idle';token++;clearClock();renderTotals();screen('home');}
  function init(){
    loadProgress();
    try{
      all=loadBank();renderTotals();text('status','Listo: 30 exámenes · 90 partes · 720 huecos originales.');
      $('start').disabled=false;
    }catch(error){console.error(error);text('status','Error de carga: '+error.message+' Usa una conexión a Internet y vuelve a abrir la aplicación.');$('start').disabled=true;}
    $('start').addEventListener('click',start);
    $('modes').addEventListener('click',e=>{const b=e.target.closest('button[data-part]');if(!b)return;mode=b.dataset.part;for(const x of $('modes').querySelectorAll('button')){x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');}});
    $('ready').addEventListener('click',showAnswerForm);
    $('wordForm').addEventListener('submit',e=>{e.preventDefault();checkAnswer($('wordInput').value);});
    $('next').addEventListener('click',()=>{index++;if(index>=plan.length)finish();else showItem();});
    $('exit').addEventListener('click',leave);
    $('again').addEventListener('click',start);
    $('homeBtn').addEventListener('click',leave);
    document.addEventListener('keydown',e=>{if(phase!=='answer'||plan[index]?.p!==1||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;const pos='abcd'.indexOf(e.key.toLowerCase());if(pos>=0){e.preventDefault();checkAnswer(plan[index].node.options[pos],false,pos);}});
    // No data migration or reset. Classic game history stays in its original storage.
  }
  document.addEventListener('DOMContentLoaded',init);
})();
