const BANK=window.CLOZE_BANK||[];
const SESSION_SIZE=15,TIME_LIMIT=20,KEY="b2_mcc_state_v1";
const $=id=>document.getElementById(id);
const blank=()=>({sessions:0,total:0,correct:0,time:0,timeouts:0,recent:[],items:{},history:[]});
let state=load(),session=null,current=null,deadline=0,timerHandle=null,locked=false,soundOn=false;
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
function startSession(){clearInterval(timerHandle);session={queue:chooseQueue(),index:0,correct:0,times:[],errors:[],cats:{}};locked=false;renderSegments();show("gameScreen");nextQuestion();}
function nextQuestion(){
 clearInterval(timerHandle);locked=false;current=session.queue[session.index];
 if(!current){finishSession();return;}
 $("qIndex").textContent=session.index+1;$("qTotal").textContent="/ "+SESSION_SIZE;$("category").textContent=current.t.toUpperCase();$("questionText").textContent=current.q;
 current.view=shuffle(current.o.map((text,orig)=>({text,orig})));
 $("answers").innerHTML=current.view.map((x,i)=>'<button class="answer"><span class="letter">'+answerLabel(i)+'</span><span>'+x.text+'</span></button>').join("");
 [...$("answers").children].forEach((b,i)=>b.addEventListener("click",()=>submit(i,false)));
 deadline=Date.now()+TIME_LIMIT*1000;$("timerText").textContent=TIME_LIMIT.toFixed(1);$("timer").style.setProperty("--timer-cut","0%");
 timerHandle=setInterval(tick,50);
}
function tick(){
 const left=Math.max(0,(deadline-Date.now())/1000);$("timerText").textContent=left.toFixed(1);
 $("timer").style.setProperty("--timer-cut",(100-left/TIME_LIMIT*100)+"%");
 if(left<=0)submit(-1,true);
}
function tone(ok){if(!soundOn)return;try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=ok?660:190;g.gain.value=.05;o.start();o.stop(a.currentTime+.11);}catch{}}
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
 showFeedback(ok,timeout);tone(ok);save();
 setTimeout(()=>{session.index++;renderSegments();nextQuestion();},720);
}
function finishSession(){
 clearInterval(timerHandle);state.sessions++;state.history.push({at:Date.now(),score:session.correct,total:SESSION_SIZE,avg:session.times.reduce((a,b)=>a+b,0)/session.times.length});state.history=state.history.slice(-200);save();
 renderEnd();show("endScreen");
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
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"🔊":"🔇";});
document.addEventListener("visibilitychange",()=>{if(document.hidden)clearInterval(timerHandle);else if(session&&current&&!locked&&!$("gameScreen").classList.contains("hidden")){const left=parseFloat($("timerText").textContent)||TIME_LIMIT;deadline=Date.now()+left*1000;timerHandle=setInterval(tick,50);}});
renderHome();show("startScreen");
