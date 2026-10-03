(function(){
"use strict";
const cfg=window.LANGUAGE_POINTS_CONFIG||{};
const KEY="adrian_language_game_v1";
const APP=String(cfg.appId||"language");
const DEFAULT_LIMIT=Number(cfg.timeLimit)||15;
const WRONG_PENALTY=35;
let run=null,pointsAudioCtx=null;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(Number(n)||0).toLocaleString("es-ES");
function blankState(){return {version:1,totalPoints:0,rating:1000,bestRating:1000,boardAbs:1,sessions:0,apps:{},history:[]};}
function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||"null");
    if(!x||typeof x!=="object")return blankState();
    return Object.assign(blankState(),x,{apps:x.apps&&typeof x.apps==="object"?x.apps:{},history:Array.isArray(x.history)?x.history:[]});
  }catch(e){return blankState();}
}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
function boardPos(abs){return ((Math.max(1,abs)-1)%100)+1;}
function boardLap(abs){return Math.floor((Math.max(1,abs)-1)/100)+1;}
function soundEnabled(){
  const b=document.getElementById("soundBtn"),label=String(b?.getAttribute("aria-label")||"").toLowerCase();
  return !/(off|mute|silenc)/.test(label);
}
function tone(freq,dur=.045,delay=0,vol=.024,type="sine"){
  if(!soundEnabled())return;
  try{
    pointsAudioCtx=pointsAudioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(pointsAudioCtx.state==="suspended")pointsAudioCtx.resume().catch(()=>{});
    const t=pointsAudioCtx.currentTime+delay,o=pointsAudioCtx.createOscillator(),g=pointsAudioCtx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(pointsAudioCtx.destination);o.start(t);o.stop(t+dur+.015);
  }catch(e){}
}
function answerSound(delta){
  if(delta>0){tone(780,.035,0,.017,"triangle");tone(1046,.045,.045,.015,"sine");}
  else{tone(260,.045,0,.018,"triangle");tone(185,.06,.04,.014,"sine");}
}
function rollTick(up,i,steps){
  const p=steps<=1?1:i/(steps-1);
  tone(up?560+p*520:360-p*170,.028,0,.014,"square");
}

function ensureStyle(){
  if(document.getElementById("language-points-style"))return;
  const st=document.createElement("style");st.id="language-points-style";
  st.textContent=
  ".lp-game-score{position:absolute;z-index:7;left:50%;bottom:-110px;transform:translateX(-50%);width:min(230px,58vw);min-height:50px;margin:0;padding:6px 44px 6px 10px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:linear-gradient(180deg,rgba(5,18,14,.56),rgba(5,12,10,.34));box-sizing:border-box;text-align:center;pointer-events:none;opacity:.94;transition:border-color .16s,background .16s,transform .16s}.lp-game-score .lp-game-label{font-size:7.5px;font-weight:950;letter-spacing:.18em;color:#b9cfc3}.lp-game-score .lp-game-main{display:flex;justify-content:center;align-items:baseline;gap:5px;line-height:1}.lp-game-score .lp-game-main b{font-size:clamp(28px,7vw,38px);font-weight:980;font-variant-numeric:tabular-nums;letter-spacing:-.035em}.lp-game-score .lp-game-main small{font-size:9px;font-weight:950;letter-spacing:.10em;color:#d8e7df}.lp-game-score .lp-game-total{font-size:8px;font-weight:850;letter-spacing:.06em;color:#9fb5aa;margin-top:3px}.lp-game-score .lp-delta{position:absolute;right:9px;top:17px;font-size:12px;font-weight:980;opacity:0;transform:translateY(5px);transition:opacity .14s,transform .14s}.lp-game-score.gain{border-color:rgba(92,211,146,.48);background:linear-gradient(180deg,rgba(20,73,48,.5),rgba(5,18,14,.3));transform:translateX(-50%) scale(1.015)}.lp-game-score.loss{border-color:rgba(236,102,112,.48);background:linear-gradient(180deg,rgba(90,29,37,.48),rgba(20,9,11,.3));transform:translateX(-50%) scale(.992)}.lp-game-score.gain .lp-delta{color:#8ce7b4;opacity:1;transform:none}.lp-game-score.loss .lp-delta{color:#ff9aa4;opacity:1;transform:none}.lp-homebar{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0;padding:9px;border-radius:12px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.08)}.lp-homecell{text-align:center;min-width:0}.lp-homecell b{display:block;font-size:17px;line-height:1.05}.lp-homecell span{display:block;font-size:8px;letter-spacing:.08em;margin-top:4px;color:#b7c9bf;font-weight:900}.lp-reward{position:fixed;z-index:99999;inset:0;display:none;place-items:center;background:radial-gradient(circle at 50% 22%,rgba(56,92,76,.96),rgba(8,17,14,.985) 58%,#07100d);color:#fff;padding:20px;opacity:0;transition:opacity .16s ease}.lp-reward.show{display:grid;opacity:1}.lp-stage{width:min(92vw,540px);text-align:center;perspective:900px}.lp-kicker{font-size:11px;font-weight:950;letter-spacing:.18em;color:#b8cec1}.lp-score{font-size:clamp(46px,13vw,72px);font-weight:950;letter-spacing:-.04em;margin:2px 0;font-variant-numeric:tabular-nums}.lp-adjust{min-height:22px;font-size:14px;font-weight:950;letter-spacing:.04em}.lp-adjust.good{color:#8ce7b4}.lp-adjust.bad{color:#ff9aa4}.lp-bank{min-height:18px;font-size:11px;font-weight:900;color:#f0d78c;letter-spacing:.04em}.lp-rating{font-size:13px;font-weight:900;color:#d8e7df;min-height:19px}.lp-dice-zone{height:104px;display:grid;place-items:center;margin:2px 0 0}.lp-die-wrap{width:72px;height:72px;perspective:440px}.lp-die{position:relative;width:72px;height:72px;transform-style:preserve-3d;transition:transform .34s cubic-bezier(.2,.8,.2,1)}.lp-die.spin{animation:lpDiceSpin .82s cubic-bezier(.3,.2,.2,1)}.lp-face{position:absolute;inset:0;display:grid;place-items:center;border-radius:15px;background:linear-gradient(145deg,#fff,#dce3df);color:#17251e;font-size:46px;box-shadow:inset -5px -6px 12px rgba(0,0,0,.13),0 7px 16px rgba(0,0,0,.24);backface-visibility:hidden}.lp-f1{transform:translateZ(36px)}.lp-f2{transform:rotateY(90deg) translateZ(36px)}.lp-f3{transform:rotateY(180deg) translateZ(36px)}.lp-f4{transform:rotateY(-90deg) translateZ(36px)}.lp-f5{transform:rotateX(90deg) translateZ(36px)}.lp-f6{transform:rotateX(-90deg) translateZ(36px)}.lp-die[data-v='1']{transform:rotateX(0) rotateY(0)}.lp-die[data-v='2']{transform:rotateX(0) rotateY(-90deg)}.lp-die[data-v='3']{transform:rotateX(0) rotateY(-180deg)}.lp-die[data-v='4']{transform:rotateX(0) rotateY(90deg)}.lp-die[data-v='5']{transform:rotateX(-90deg) rotateY(0)}.lp-die[data-v='6']{transform:rotateX(90deg) rotateY(0)}@keyframes lpDiceSpin{0%{transform:rotateX(0) rotateY(0) rotateZ(0)}55%{transform:rotateX(500deg) rotateY(680deg) rotateZ(120deg)}100%{transform:rotateX(760deg) rotateY(980deg) rotateZ(220deg)}}.lp-dice-caption{font-size:12px;font-weight:950;letter-spacing:.07em;height:20px;margin-top:-8px}.lp-road-wrap{position:relative;height:110px;margin:7px 0 2px;perspective:640px;overflow:visible}.lp-road{position:absolute;left:2%;right:2%;top:10px;height:80px;display:grid;grid-template-columns:repeat(9,1fr);gap:5px;transform:rotateX(54deg);transform-origin:center bottom}.lp-tile{display:grid;place-items:center;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(98,125,110,.72),rgba(35,55,46,.88));font-size:12px;font-weight:950;box-shadow:0 8px 10px rgba(0,0,0,.24)}.lp-tile.special{background:linear-gradient(180deg,rgba(169,132,55,.82),rgba(80,58,22,.92))}.lp-token{position:absolute;z-index:3;left:7.1%;top:43px;width:28px;height:28px;border-radius:50%;background:#fff;border:5px solid #7ac79a;box-shadow:0 6px 15px rgba(0,0,0,.42);transform:translate(-50%,-50%);transition:left .75s cubic-bezier(.17,.84,.32,1.2)}.lp-move{font-size:16px;font-weight:950;min-height:22px}.lp-details{font-size:10px;color:#b7c9bf;font-weight:800;margin-top:3px}.lp-lap{font-size:9px;letter-spacing:.12em;color:#c4d7cc;margin-top:6px;font-weight:900}.screen:not(#gameScreen) .kicker{font-size:13.5px!important}.screen:not(#gameScreen) .subtitle{font-size:20px!important}.screen:not(#gameScreen) .meta{font-size:14.5px!important}.screen:not(#gameScreen) .progress-label{font-size:15px!important}.screen:not(#gameScreen) .card span{font-size:11.5px!important}.screen:not(#gameScreen) .statusbox{font-size:15px!important;line-height:1.5!important}.screen:not(#gameScreen) .section h3{font-size:16px!important}.screen:not(#gameScreen) .skillrow{font-size:13.5px!important}.screen:not(#gameScreen) .errors summary{font-size:15.5px!important}.screen:not(#gameScreen) .errors p{font-size:14px!important}.screen:not(#gameScreen) .footerline{font-size:12.5px!important}.screen:not(#gameScreen) .menu-btn b{font-size:15px!important}.screen:not(#gameScreen) .menu-btn span{font-size:11.5px!important}.screen:not(#gameScreen) .coach-card h3{font-size:17px!important}.screen:not(#gameScreen) .coach-card p{font-size:14.5px!important}.screen:not(#gameScreen) .mistake-card b{font-size:14.5px!important}.screen:not(#gameScreen) .mistake-card p{font-size:13.5px!important}.screen:not(#gameScreen) .primary,.screen:not(#gameScreen) .secondary,.screen:not(#gameScreen) .ghost{font-size:15px!important}.screen:not(#gameScreen) .ai-valuation-box span,.screen:not(#gameScreen) .learning-score-box span{font-size:12.5px!important}#gameScreen .memory-echo{display:none!important}@media(max-width:520px){.lp-game-score{width:min(218px,62vw);min-height:48px;bottom:-104px;padding-top:5px;padding-bottom:5px}.lp-game-score .lp-game-main b{font-size:30px}.lp-reward{padding:12px}.lp-stage{width:96vw}.lp-road-wrap{height:100px}.lp-score{font-size:50px}}@media(prefers-reduced-motion:reduce){.lp-die.spin{animation:none}.lp-token,.lp-game-score{transition:none}}";
  document.head.appendChild(st);
}
function ensureHud(){
  ensureStyle();
  const game=document.getElementById("gameScreen");
  if(!game)return null;
  let top=game.querySelector(".quiz-game-footer");
  if(!top){top=document.createElement("div");top.className="quiz-game-footer";game.appendChild(top);const exit=game.querySelector(".emergency-exit");if(exit)top.appendChild(exit);}
  if(!top)return null;
  let el=document.getElementById("languagePointsHud");
  if(!el){
    el=document.createElement("div");el.id="languagePointsHud";el.className="lp-game-score";
    el.innerHTML="<div class='lp-game-label'>PUNTOS DE PARTIDA</div><div class='lp-game-main'><b>0</b><small>PTS</small></div><div class='lp-game-total'>TOTAL <strong>0</strong></div><div class='lp-delta'></div>";
    top.prepend(el);
  }
  return el;
}
function animateNumber(el,from,to,dur=260,onStep){
  const start=performance.now(),delta=to-from;
  function frame(now){
    const p=clamp((now-start)/dur,0,1),e=1-Math.pow(1-p,3),v=Math.round(from+delta*e);
    el.textContent=fmt(v);if(onStep)onStep(p,v);
    if(p<1)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function updateHud(from,to,delta,animate=true){
  const el=ensureHud();if(!el)return;
  const b=el.querySelector(".lp-game-main b"),total=el.querySelector(".lp-game-total strong"),d=el.querySelector(".lp-delta");
  total.textContent=fmt(load().totalPoints);
  if(animate)animateNumber(b,from,to,260);else b.textContent=fmt(to);
  el.classList.remove("gain","loss");void el.offsetWidth;
  if(delta){
    el.classList.add(delta>0?"gain":"loss");d.textContent=(delta>0?"+":"")+fmt(delta);
    clearTimeout(updateHud._t);updateHud._t=setTimeout(()=>el.classList.remove("gain","loss"),420);
  }else d.textContent="";
}
function renderHome(){
  ensureStyle();
  const panel=document.querySelector("#startScreen .panel");if(!panel)return;
  let bar=document.getElementById("languagePointsHome");
  if(!bar){bar=document.createElement("div");bar.id="languagePointsHome";bar.className="lp-homebar";const anchor=panel.querySelector(".hero-progress");if(anchor)panel.insertBefore(bar,anchor);else panel.appendChild(bar);}
  const s=load();
  bar.innerHTML="<div class='lp-homecell'><b>"+fmt(s.totalPoints)+"</b><span>LANGUAGE PTS</span></div><div class='lp-homecell'><b>"+fmt(s.rating)+"</b><span>RATING</span></div>";
}
function beginLevel(meta){
  run={id:APP+"-"+Date.now()+"-"+Math.random().toString(36).slice(2),target:Number.isFinite(meta&&meta.target)?Number(meta.target):null,answerPoints:0,answers:0,awarded:false};
  setTimeout(function(){ensureHud();updateHud(0,0,0,false);},0);
}
function recordAnswer(data){
  if(!run)beginLevel({});
  run.answers++;
  const before=run.answerPoints;
  let delta=-WRONG_PENALTY;
  if(data&&data.correct){
    const limit=Math.max(.1,Number(data.timeLimit)||DEFAULT_LIMIT),sec=clamp(Number(data.sec)||limit,0,limit);
    const speed=clamp(1-sec/limit,0,1);
    delta=90+Math.round(30*speed);
  }
  run.answerPoints+=delta;
  updateHud(before,run.answerPoints,delta,false);
  // The quiz supplies one short answer cue; avoid duplicate audio.
  return run.answerPoints;
}
function baseMoves(points){
  if(points>=1700)return 5;
  if(points>=1450)return 4;
  if(points>=1200)return 3;
  if(points>=900)return 2;
  if(points>=600)return 1;
  return 0;
}
function dieRoll(){
  try{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%6+1;}catch(e){return Math.floor(Math.random()*6)+1;}
}
function diceBonus(v){return v>=5?2:v>=3?1:0;}
function ratingDelta(points){return clamp(Math.round((points-1100)/45),-20,20);}
function ensureOverlay(){
  ensureStyle();
  let o=document.getElementById("languageRewardOverlay");if(o)return o;
  o=document.createElement("div");o.id="languageRewardOverlay";o.className="lp-reward";o.setAttribute("aria-hidden","true");
  o.innerHTML="<div class='lp-stage'><div class='lp-kicker'>PUNTOS DE PARTIDA</div><div class='lp-score' id='lpScore'>0 PTS</div><div class='lp-adjust' id='lpAdjust'></div><div class='lp-bank' id='lpBank'></div><div class='lp-rating' id='lpRating'></div><div class='lp-dice-zone'><div class='lp-die-wrap'><div class='lp-die' id='lpDie' data-v='1'><div class='lp-face lp-f1'>⚀</div><div class='lp-face lp-f2'>⚁</div><div class='lp-face lp-f3'>⚂</div><div class='lp-face lp-f4'>⚃</div><div class='lp-face lp-f5'>⚄</div><div class='lp-face lp-f6'>⚅</div></div></div></div><div class='lp-dice-caption' id='lpDiceCaption'></div><div class='lp-road-wrap'><div class='lp-road' id='lpRoad'></div><div class='lp-token' id='lpToken'></div></div><div class='lp-move' id='lpMove'></div><div class='lp-details' id='lpDetails'></div><div class='lp-lap' id='lpLap'></div></div>";
  document.body.appendChild(o);return o;
}
function renderRoad(abs){
  const road=document.getElementById("lpRoad");if(!road)return;
  let html="";
  for(let i=0;i<9;i++){const n=boardPos(abs+i),special=(n%10===0||n===25||n===50||n===75||n===100);html+="<div class='lp-tile"+(special?" special":"")+"'>"+n+"</div>";}
  road.innerHTML=html;
}
function animateRewardScore(from,to,dur=620){
  return new Promise(resolve=>{
    const el=document.getElementById("lpScore"),steps=9;let last=-1;
    animateNumber(el,from,to,dur,(p)=>{
      const k=Math.min(steps-1,Math.floor(p*steps));
      if(k!==last){last=k;rollTick(to>=from,k,steps);}
    });
    setTimeout(()=>{el.textContent=fmt(to)+" PTS";resolve();},dur+30);
  });
}
function showReward(r){
  return new Promise(function(resolve){
    const o=ensureOverlay(),die=document.getElementById("lpDie"),token=document.getElementById("lpToken"),adj=document.getElementById("lpAdjust"),bank=document.getElementById("lpBank");
    const afterTarget=r.sessionPoints+r.targetBonus,learningBonus=r.recoveryBonus+r.masteryBonus+r.perfectBonus;
    document.getElementById("lpScore").textContent=fmt(r.sessionPoints)+" PTS";
    document.getElementById("lpRating").textContent="RATING "+(r.ratingDelta>=0?"+":"")+r.ratingDelta+" → "+fmt(r.rating);
    adj.className="lp-adjust";adj.textContent="RESULTADO DE LAS 15 PREGUNTAS";
    bank.textContent="";
    document.getElementById("lpDiceCaption").textContent="";
    document.getElementById("lpMove").textContent="";
    document.getElementById("lpDetails").textContent=r.correct+"/15 · TARGET "+(Number.isFinite(r.target)?r.target.toFixed(1):"—");
    document.getElementById("lpLap").textContent="CAMINO "+r.lap+" · CASILLA "+r.fromPos+" → "+r.toPos;
    renderRoad(r.beforeAbs);token.style.left="7.1%";die.classList.remove("spin");die.setAttribute("data-v","1");
    o.style.display="grid";o.setAttribute("aria-hidden","false");requestAnimationFrame(()=>o.classList.add("show"));
    setTimeout(async function(){
      if(Number.isFinite(r.target)){
        adj.className="lp-adjust "+(r.targetBonus>=0?"good":"bad");
        adj.textContent=(r.targetBonus>=0?"TARGET SUPERADO ":"TARGET NO ALCANZADO ")+(r.targetBonus>=0?"+":"")+r.targetBonus+" PTS";
      }else{adj.textContent="SIN TARGET";}
      if(r.targetBonus!==0)await animateRewardScore(r.sessionPoints,afterTarget,600);
      if(learningBonus!==0){
        adj.className="lp-adjust good";adj.textContent="BONUS APRENDIZAJE +"+learningBonus+" PTS";
        await animateRewardScore(afterTarget,r.points,330);
      }else document.getElementById("lpScore").textContent=fmt(r.points)+" PTS";
      bank.textContent="BANCADOS +"+fmt(r.points)+" · TOTAL "+fmt(r.totalAfter);
      tone(1318,.055,0,.018,"sine");tone(1760,.07,.055,.015,"sine");
      setTimeout(()=>{document.getElementById("lpDiceCaption").textContent="TIRANDO DADO…";document.getElementById("lpMove").textContent="BASE +"+r.baseMoves;die.classList.add("spin");},90);
      setTimeout(()=>{die.classList.remove("spin");die.setAttribute("data-v",String(r.die));document.getElementById("lpDiceCaption").textContent="DADO "+r.die+" · BONUS +"+r.diceBonus;document.getElementById("lpMove").textContent="AVANCE +"+r.moves+" CASILLAS";tone(740+r.die*55,.07,0,.016,"triangle");},930);
      setTimeout(()=>{token.style.left=(7.1+r.moves*10.72)+"%";try{navigator.vibrate&&navigator.vibrate([18,25,28]);}catch(e){}},1110);
      setTimeout(()=>o.classList.remove("show"),2300);
      setTimeout(()=>{o.style.display="none";o.setAttribute("aria-hidden","true");resolve(r);},2490);
    },220);
  });
}
function appendEndSummary(r){
  const e=document.getElementById("endSub");if(!e||!r)return;
  const bit=" · "+fmt(r.points)+" PTS BANCADOS · TOTAL "+fmt(r.totalAfter)+" · RATING "+(r.ratingDelta>=0?"+":"")+r.ratingDelta;
  if(!e.textContent.includes(" PTS BANCADOS"))e.textContent+=bit;
}
async function awardLevel(meta){
  if(!run)beginLevel({target:meta&&meta.target});
  if(run.awarded)return run.result;
  run.awarded=true;meta=meta||{};
  const correct=Number(meta.correct)||0,total=Number(meta.total)||15,target=Number.isFinite(meta.target)?Number(meta.target):run.target;
  let targetBonus=0;
  if(Number.isFinite(target)){
    if(correct>=target)targetBonus=100+Math.round(Math.max(0,correct-target)*45);
    else targetBonus=-Math.round(Math.max(0,target-correct)*35);
  }
  const recoveryBonus=(Number(meta.recovered)||0)*15,masteryBonus=(Number(meta.mastered)||0)*30,perfectBonus=correct===total&&total===15?150:0;
  const sessionPoints=Math.round(run.answerPoints);
  const points=clamp(Math.round(sessionPoints+targetBonus+recoveryBonus+masteryBonus+perfectBonus),0,2200);
  const rd=ratingDelta(points);
  const s=load(),totalBefore=Number(s.totalPoints)||0,totalAfter=totalBefore+points;
  s.totalPoints=totalAfter;s.rating=Math.max(0,(Number(s.rating)||1000)+rd);s.bestRating=Math.max(Number(s.bestRating)||1000,s.rating);s.sessions=(Number(s.sessions)||0)+1;
  const ap=s.apps[APP]&&typeof s.apps[APP]==="object"?s.apps[APP]:{points:0,sessions:0,best:0};ap.points=(Number(ap.points)||0)+points;ap.sessions=(Number(ap.sessions)||0)+1;ap.best=Math.max(Number(ap.best)||0,points);s.apps[APP]=ap;
  const result={appId:APP,points,sessionPoints,answerPoints:sessionPoints,targetBonus,recoveryBonus,masteryBonus,perfectBonus,wrongPenalty:WRONG_PENALTY,correct,total,target,ratingDelta:rd,rating:s.rating,totalBefore,totalAfter,at:Date.now(),runId:run.id};
  s.history.push(result);s.history=s.history.slice(-250);save(s);run.result=result;
  appendEndSummary(result);renderHome();return result;
}
function snapshot(){return load();}
ensureStyle();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderHome);else setTimeout(renderHome,0);
window.LanguagePoints={beginLevel,recordAnswer,awardLevel,snapshot,renderHome,appendEndSummary};
})();
