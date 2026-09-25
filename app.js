const BANK=window.CLOZE_BANK||[];
const SESSION_SIZE=15,TIME_LIMIT=20,KEY="b2_mcc_state_v1";
const $=id=>document.getElementById(id);
const blank=()=>({sessions:0,total:0,correct:0,time:0,timeouts:0,recent:[],items:{},history:[]});
let state=load(),session=null,current=null,deadline=0,timerHandle=null,locked=false,audioCtx=null,soundOn=true,lastTickShown=TIME_LIMIT+1,lastUrgentBeat=-1;
function load(){try{return Object.assign(blank(),JSON.parse(localStorage.getItem(KEY)||"{}"));}catch{return blank();}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function itemStat(id){return state.items[id]||(state.items[id]={attempts:0,correct:0,time:0});}
function pct(n,d){return d?Math.round(n/d*100):0;}
function seenCount(){return BANK.filter(x=>itemStat(x.id).attempts>0).length;}
function overall(){return pct(state.correct,state.total);}
function recentAcc(){const r=state.recent.slice(-60);return pct(r.reduce((a,x)=>a+x.ok,0),r.length);}
function avgTime(){return state.total?state.time/state.total:0;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");window.scrollTo(0,0);}
function answerLabel(i){return String.fromCharCode(65+i);}
function renderHome(){
 const seen=seenCount(),cov=pct(seen,BANK.length);
 $("coverageText").textContent=seen+" / "+BANK.length;$("coverageFill").style.width=cov+"%";
 $("startAllAccuracy").textContent=state.total?overall()+"%":"—";$("startRecentAccuracy").textContent=state.total?recentAcc()+"%":"—";
 $("startAvg").textContent=state.total?avgTime().toFixed(1)+"s":"—";$("startTotal").textContent=state.total;
 $("startSessions").textContent=state.sessions;$("startTimeouts").textContent=state.timeouts;
 $("startStatus").textContent=seen<BANK.length?(BANK.length-seen)+" unseen questions remain. New items are shown first.":"Full bank seen. Sessions now reshuffle the same closed bank.";
}
function chooseQueue(){const unseen=shuffle(BANK.filter(x=>itemStat(x.id).attempts===0).slice());const seen=shuffle(BANK.filter(x=>itemStat(x.id).attempts>0).slice());return unseen.concat(seen).slice(0,SESSION_SIZE);}
function renderSegments(){if(!session)return;$("segments").innerHTML=Array.from({length:SESSION_SIZE},(_,i)=>'<i class="seg '+(i<session.index?'on':'')+'"></i>').join("");}
async function startSession(){await ensureAudio();clearInterval(timerHandle);session={queue:chooseQueue(),index:0,correct:0,times:[],errors:[],cats:{}};locked=false;renderSegments();show("gameScreen");nextQuestion();}
function nextQuestion(){
 clearInterval(timerHandle);locked=false;lastTickShown=TIME_LIMIT+1;lastUrgentBeat=-1;current=session.queue[session.index];
 if(!current){finishSession();return;}
 $("qIndex").textContent=session.index+1;$("qTotal").textContent="/ "+SESSION_SIZE;$("category").textContent=current.t.toUpperCase();$("questionText").textContent=current.q;
 current.view=shuffle(current.o.map((text,orig)=>({text,orig})));
 $("answers").innerHTML=current.view.map((x,i)=>'<button class="answer"><span class="letter">'+answerLabel(i)+'</span><span>'+x.text+'</span></button>').join("");
 [...$("answers").children].forEach((b,i)=>b.addEventListener("click",()=>submit(i,false)));
 deadline=Date.now()+TIME_LIMIT*1000;$("timerText").textContent=TIME_LIMIT.toFixed(1);$("timer").style.setProperty("--timer-cut","0%");
 timerHandle=setInterval(tick,50);
}
function audioSupported(){return !!(window.AudioContext||window.webkitAudioContext);}
async function ensureAudio(){
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){soundOn=false;refreshSoundButton();return false;}
  if(!audioCtx)audioCtx=new AC();
  if(audioCtx.state==='suspended')await audioCtx.resume();
  const ok=audioCtx.state==='running';if(!ok){soundOn=false;refreshSoundButton();}return ok;
 }catch(e){console.warn("Audio unavailable",e);soundOn=false;refreshSoundButton();return false;}
}
function tone(freq,dur=.035,gain=.018,type='sine',delay=0){
 if(!soundOn||!audioCtx||audioCtx.state!=='running')return;
 const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.01);
}
function playTick(strong=false,step=0){const f=strong?(step%2?1540:1260):(step%2?1280:980);tone(f,strong?.034:.026,strong?.026:.016,'square');}
function playUrgentTimerPulse(left,beat=0){const final=left<=2,f=final?(beat%2?1660:1450):(beat%2?1360:1160);tone(f,final?.034:.028,final?.016:.012,final?'square':'triangle');if(left<=.55)tone(1960,.042,.010,'sine',.014);}
function playCorrect(){const notes=[440,587.33,783.99,1046.5];notes.forEach((f,i)=>{tone(f,i===3?.11:.052,i===3?.024:.020,i%2?'sine':'triangle',i*.047);if(i>0)tone(f*2,.032,.007,'sine',i*.047+.012);});}
function playWrong(){tone(311.13,.050,.020,'triangle');tone(220,.070,.017,'sine',.042);}
const LEVEL_SCORE_ROOTS=[146.83,155.56,164.81,174.61,196.00,220.00,246.94,261.63,293.66,329.63,349.23,392.00,440.00,493.88,523.25];
function semitoneHz(root,n){return root*Math.pow(2,n/12);}
function playLevelScore(correct,total=15){
 const rank=Math.max(1,Math.min(15,Math.round(15*(Number(correct)||0)/Math.max(1,Number(total)||15)))),root=LEVEL_SCORE_ROOTS[rank-1];
 let intervals=[0],step=.105,dur=.085,gain=.015,type='triangle';
 if(rank<=3){intervals=[0,-1,-5];step=.11;dur=.11;gain=.014;type='triangle';}
 else if(rank<=6){intervals=[0,3,0];step=.095;dur=.095;gain=.015;type='sine';}
 else if(rank<=9){intervals=[0,2,4];step=.085;dur=.085;gain=.017;type='triangle';}
 else if(rank<=12){intervals=[0,4,7,12];step=.075;dur=.09;gain=.019;type='triangle';}
 else if(rank<=14){intervals=[0,4,7,12,16];step=.068;dur=.095;gain=.021;type='sine';}
 else{intervals=[0,4,7,12,16,19,24];step=.062;dur=.105;gain=.024;type='triangle';}
 intervals.forEach((semi,i)=>{const delay=i*step,f=semitoneHz(root,semi);tone(f,i===intervals.length-1?dur*1.8:dur,gain,type,delay);if(rank>=10&&i>=2)tone(f*2,.045,gain*.24,'sine',delay+.012);});
 if(rank>=13){const finale=(intervals.length-1)*step+.07;tone(root/2,.22,gain*.8,'sine',finale);[0,4,7,12].forEach((semi,i)=>tone(semitoneHz(root,semi),rank===15?.28:.20,gain*(rank===15?.72:.55),i%2?'sine':'triangle',finale+i*.012));}
 if(rank===15){const crown=(intervals.length-1)*step+.30;[12,16,19,24].forEach((semi,i)=>tone(semitoneHz(root,semi),.18,.012,'sine',crown+i*.045));}
}
function haptic(ok){try{if(navigator.vibrate)navigator.vibrate(ok?18:[24,16,42]);}catch(e){}}
function pulseFeedback(ok){const cls=ok?"feedback-correct":"feedback-wrong";document.body.classList.remove("feedback-correct","feedback-wrong");void document.body.offsetWidth;document.body.classList.add(cls);setTimeout(()=>document.body.classList.remove(cls),430);}
function burstParticles(anchor){if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const layer=$("particles");if(!layer)return;const r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():null,cx=r?r.left+r.width/2:innerWidth/2,cy=r?r.top+r.height/2:innerHeight*.55,colors=["#E7BF57","#BB9EF0","#7AA5EC","#4AA7C8","#57965A"];for(let i=0;i<6;i++){const p=document.createElement("i"),a=(Math.PI*2*i/6)+(Math.random()-.5)*.28,d=26+Math.random()*42;p.className="particle";p.style.left=cx+"px";p.style.top=cy+"px";p.style.setProperty("--dx",Math.cos(a)*d+"px");p.style.setProperty("--dy",Math.sin(a)*d+"px");p.style.setProperty("--rot",Math.round((Math.random()-.5)*180)+"deg");p.style.setProperty("--size",(4+Math.random()*4)+"px");p.style.setProperty("--delay",Math.round(Math.random()*70)+"ms");p.style.setProperty("--particle-color",colors[i%colors.length]);layer.appendChild(p);setTimeout(()=>p.remove(),460);}}
function refreshSoundButton(){const b=$("soundBtn");if(!b)return;if(!audioSupported()){soundOn=false;b.disabled=true;b.textContent='🔇';b.setAttribute('aria-label','Audio unavailable');b.title='Audio unavailable';return;}b.disabled=false;b.textContent=soundOn?'🔊':'🔇';b.setAttribute('aria-label',soundOn?'Sound on':'Sound off');b.title='';}
function tick(){
 const left=Math.max(0,(deadline-Date.now())/1000),shown=Math.ceil(left);$("timerText").textContent=left.toFixed(1);
 $("timer").style.setProperty("--timer-cut",(100-left/TIME_LIMIT*100)+"%");$("timer").classList.toggle("urgent",left<=3);
 if(left>3&&shown<lastTickShown&&shown>0&&shown<TIME_LIMIT){playTick(false,shown);lastTickShown=shown;}
 if(left<=3&&left>0){const beat=left>2?Math.floor((3-left)*2):100+Math.floor((2-left)*4);if(beat!==lastUrgentBeat){lastUrgentBeat=beat;playUrgentTimerPulse(left,beat);}}
 if(left<=0)submit(-1,true);
}
function showFeedback(ok,timeout){
 const f=$("feedback");f.className="feedback "+(ok?"ok":"no");
 f.innerHTML='<div class="feedback-label">'+(ok?"CORRECT":timeout?"TIME":"NOT QUITE")+'</div><div class="appearance">'+current.o[current.a]+'</div><small>'+current.t+'</small>';
 requestAnimationFrame(()=>f.classList.add("show"));setTimeout(()=>f.classList.remove("show"),570);
}
function submit(choice,timeout){
 if(locked)return;locked=true;clearInterval(timerHandle);
 const elapsed=Math.min(TIME_LIMIT,(TIME_LIMIT*1000-(deadline-Date.now()))/1000),chosenOrig=choice>=0?current.view[choice].orig:-1,ok=chosenOrig===current.a,st=itemStat(current.id),correctView=current.view.findIndex(x=>x.orig===current.a);
 [...$("answers").children].forEach((b,i)=>{b.disabled=true;if(i===correctView)b.classList.add("good");else if(i===choice)b.classList.add("bad");else b.classList.add("dim");});
 st.attempts++;st.correct+=ok?1:0;st.time+=elapsed;state.total++;state.correct+=ok?1:0;state.time+=elapsed;if(timeout)state.timeouts++;
 state.recent.push({ok:ok?1:0,t:elapsed,at:Date.now()});state.recent=state.recent.slice(-200);
 const cat=session.cats[current.t]||(session.cats[current.t]={n:0,c:0});cat.n++;cat.c+=ok?1:0;
 session.correct+=ok?1:0;session.times.push(elapsed);
 if(!ok)session.errors.push({id:current.id,shown:timeout?"TIME":current.view[choice].text,timeout});
 showFeedback(ok,timeout);try{if(ok)playCorrect();else playWrong();haptic(ok);pulseFeedback(ok);if(ok&&choice>=0)burstParticles($("answers").children[choice]);}catch(e){console.warn("Feedback audio unavailable",e);}save();
 setTimeout(()=>{session.index++;renderSegments();nextQuestion();},ok?555:1050);
}
function finishSession(){
 clearInterval(timerHandle);state.sessions++;state.history.push({at:Date.now(),score:session.correct,total:SESSION_SIZE,avg:session.times.reduce((a,b)=>a+b,0)/session.times.length});state.history=state.history.slice(-200);save();
 playLevelScore(session.correct,SESSION_SIZE);renderEnd();show("endScreen");
}
function catRows(source){
 const names=Object.keys(source);if(!names.length)return '<div class="statusbox">No data yet.</div>';
 return names.sort().map(n=>{const x=source[n],v=pct(x.c,x.n);return '<div class="catrow"><b>'+n+'</b><div class="track"><div class="fill mastery" style="width:'+v+'%"></div></div><strong>'+v+'%</strong></div>';}).join("");
}
function renderEnd(){
 const av=session.times.reduce((a,b)=>a+b,0)/session.times.length,acc=pct(session.correct,SESSION_SIZE),cov=pct(seenCount(),BANK.length);
 $("endScore").textContent=session.correct+"/"+SESSION_SIZE;$("endAvg").textContent=av.toFixed(1)+"s";$("endAccuracy").textContent=acc+"%";$("endCoverage").textContent=cov+"%";
 $("endTimeouts").textContent=session.errors.filter(x=>x.timeout).length;$("sessionCats").innerHTML=catRows(session.cats);
 $("endSub").textContent=acc>=80?"Strong session.":acc>=60?"Useful training range.":"Review the traps before the next session.";
 $("reviewBtn").classList.toggle("hidden",!session.errors.length);
}
function renderErrors(){
 $("errorsCount").textContent=session.errors.length?session.errors.length+" mistakes in the latest session.":"No mistakes in the latest session.";
 $("errorsList").innerHTML=session.errors.map(e=>{const x=BANK.find(q=>q.id===e.id),ans=e.shown;
 return '<article class="error-card"><h3>'+x.q+'</h3><p><b>Your answer:</b> '+ans+'</p><p><b>Correct:</b> '+x.o[x.a]+'</p><p class="why">'+x.why+'</p><p><small>'+x.t+'</small></p></article>';}).join("")||'<div class="statusbox">Perfect session.</div>';
}
function categoryTotals(){
 const out={};for(const x of BANK){const s=itemStat(x.id);if(!s.attempts)continue;const c=out[x.t]||(out[x.t]={n:0,c:0});c.n+=s.attempts;c.c+=s.correct;}return out;
}
function renderStats(){
 const seen=seenCount();$("statsCoverage").textContent=pct(seen,BANK.length)+"%";$("statsOverall").textContent=state.total?overall()+"%":"—";$("statsRecent").textContent=state.total?recentAcc()+"%":"—";
 $("statsAvg").textContent=state.total?avgTime().toFixed(1)+"s":"—";$("statsTotal").textContent=state.total;$("statsSessions").textContent=state.sessions;$("categoryStats").innerHTML=catRows(categoryTotals());
 const weak=BANK.filter(x=>itemStat(x.id).attempts>0).sort((a,b)=>{const A=itemStat(a.id),B=itemStat(b.id);return (A.correct/A.attempts)-(B.correct/B.attempts)||B.attempts-A.attempts;}).slice(0,8);
 $("weakQuestions").innerHTML=weak.map(x=>{const s=itemStat(x.id);return '<div class="error-card"><h3>'+x.q+'</h3><p>'+pct(s.correct,s.attempts)+'% · '+s.attempts+' attempts · '+x.t+'</p><p class="why">'+x.o[x.a]+'</p></div>';}).join("")||'<div class="statusbox">Complete a session first.</div>';
}
function goHome(){clearInterval(timerHandle);renderHome();show("startScreen");}
$("startBtn").addEventListener("click",startSession);$("nextBtn").addEventListener("click",startSession);$("homeBtn").addEventListener("click",goHome);
$("abortBtn").addEventListener("click",goHome);$("reviewBtn").addEventListener("click",()=>{renderErrors();show("errorsScreen");});
$("errorsBackBtn").addEventListener("click",()=>show("endScreen"));$("errorsHomeBtn").addEventListener("click",goHome);
$("statsBtn").addEventListener("click",()=>{renderStats();show("statsScreen");});$("statsBackBtn").addEventListener("click",goHome);$("statsHomeBtn").addEventListener("click",goHome);
$("soundBtn").addEventListener("click",async()=>{soundOn=!soundOn;if(soundOn){await ensureAudio();tone(760,.06,.025,"sine");}refreshSoundButton();});
document.addEventListener("visibilitychange",()=>{if(document.hidden)clearInterval(timerHandle);else if(session&&current&&!locked&&!$("gameScreen").classList.contains("hidden")){const left=parseFloat($("timerText").textContent)||TIME_LIMIT;deadline=Date.now()+left*1000;lastTickShown=Math.ceil(left)+1;lastUrgentBeat=-1;timerHandle=setInterval(tick,50);}});
refreshSoundButton();renderHome();show("startScreen");
