(function(){
"use strict";
const cfg=window.LANGUAGE_POINTS_CONFIG||{};
const KEY="adrian_language_game_v1";
const APP=String(cfg.appId||"language");
const DEFAULT_LIMIT=Number(cfg.timeLimit)||15;
let run=null;

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

function ensureStyle(){
  if(document.getElementById("language-points-style"))return;
  const st=document.createElement("style");st.id="language-points-style";
  st.textContent=
  ".lp-hud{display:inline-grid;place-items:center;margin-top:5px;width:48px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(0,0,0,.20);line-height:1;vertical-align:middle}.lp-hud b{font-size:15px;font-variant-numeric:tabular-nums}.lp-hud small{font-size:7px;letter-spacing:.12em;margin-top:2px;color:#d9e7df}.lp-homebar{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:6px;margin:12px 0;padding:9px;border-radius:12px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.08)}.lp-homecell{text-align:center;min-width:0}.lp-homecell b{display:block;font-size:17px;line-height:1.05}.lp-homecell span{display:block;font-size:8px;letter-spacing:.08em;margin-top:4px;color:#b7c9bf;font-weight:900}.lp-reward{position:fixed;z-index:99999;inset:0;display:none;place-items:center;background:radial-gradient(circle at 50% 22%,rgba(56,92,76,.96),rgba(8,17,14,.985) 58%,#07100d);color:#fff;padding:20px;opacity:0;transition:opacity .16s ease}.lp-reward.show{display:grid;opacity:1}.lp-stage{width:min(92vw,540px);text-align:center;perspective:900px}.lp-kicker{font-size:11px;font-weight:950;letter-spacing:.18em;color:#b8cec1}.lp-score{font-size:clamp(46px,13vw,72px);font-weight:950;letter-spacing:-.04em;margin:2px 0}.lp-rating{font-size:14px;font-weight:900;color:#d8e7df;min-height:20px}.lp-dice-zone{height:112px;display:grid;place-items:center;margin:5px 0 0}.lp-die-wrap{width:76px;height:76px;perspective:440px}.lp-die{position:relative;width:76px;height:76px;transform-style:preserve-3d;transition:transform .34s cubic-bezier(.2,.8,.2,1)}.lp-die.spin{animation:lpDiceSpin .9s cubic-bezier(.3,.2,.2,1)}.lp-face{position:absolute;inset:0;display:grid;place-items:center;border-radius:15px;background:linear-gradient(145deg,#fff,#dce3df);color:#17251e;font-size:48px;box-shadow:inset -5px -6px 12px rgba(0,0,0,.13),0 7px 16px rgba(0,0,0,.24);backface-visibility:hidden}.lp-f1{transform:translateZ(38px)}.lp-f2{transform:rotateY(90deg) translateZ(38px)}.lp-f3{transform:rotateY(180deg) translateZ(38px)}.lp-f4{transform:rotateY(-90deg) translateZ(38px)}.lp-f5{transform:rotateX(90deg) translateZ(38px)}.lp-f6{transform:rotateX(-90deg) translateZ(38px)}.lp-die[data-v='1']{transform:rotateX(0) rotateY(0)}.lp-die[data-v='2']{transform:rotateX(0) rotateY(-90deg)}.lp-die[data-v='3']{transform:rotateX(0) rotateY(-180deg)}.lp-die[data-v='4']{transform:rotateX(0) rotateY(90deg)}.lp-die[data-v='5']{transform:rotateX(-90deg) rotateY(0)}.lp-die[data-v='6']{transform:rotateX(90deg) rotateY(0)}@keyframes lpDiceSpin{0%{transform:rotateX(0) rotateY(0) rotateZ(0)}55%{transform:rotateX(500deg) rotateY(680deg) rotateZ(120deg)}100%{transform:rotateX(760deg) rotateY(980deg) rotateZ(220deg)}}.lp-dice-caption{font-size:12px;font-weight:950;letter-spacing:.07em;height:20px;margin-top:-8px}.lp-road-wrap{position:relative;height:118px;margin:10px 0 3px;perspective:640px;overflow:visible}.lp-road{position:absolute;left:2%;right:2%;top:10px;height:84px;display:grid;grid-template-columns:repeat(9,1fr);gap:5px;transform:rotateX(54deg);transform-origin:center bottom}.lp-tile{display:grid;place-items:center;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(98,125,110,.72),rgba(35,55,46,.88));font-size:12px;font-weight:950;box-shadow:0 8px 10px rgba(0,0,0,.24)}.lp-tile.special{background:linear-gradient(180deg,rgba(169,132,55,.82),rgba(80,58,22,.92))}.lp-token{position:absolute;z-index:3;left:7.1%;top:45px;width:28px;height:28px;border-radius:50%;background:#fff;border:5px solid #7ac79a;box-shadow:0 6px 15px rgba(0,0,0,.42);transform:translate(-50%,-50%);transition:left .85s cubic-bezier(.17,.84,.32,1.2)}.lp-move{font-size:16px;font-weight:950;min-height:24px}.lp-details{font-size:10px;color:#b7c9bf;font-weight:800;margin-top:4px}.lp-lap{font-size:9px;letter-spacing:.12em;color:#c4d7cc;margin-top:8px;font-weight:900}@media(max-width:520px){.lp-reward{padding:12px}.lp-stage{width:96vw}.lp-road-wrap{height:105px}.lp-score{font-size:52px}}@media(prefers-reduced-motion:reduce){.lp-die.spin{animation:none}.lp-token{transition:none}}";
  document.head.appendChild(st);
}
function ensureHud(){
  ensureStyle();
  const host=document.getElementById("sessionLevel");
  if(!host)return null;
  let el=document.getElementById("languagePointsHud");
  if(!el){
    el=document.createElement("span");el.id="languagePointsHud";el.className="lp-hud";
    el.innerHTML="<b>0</b><small>PTS</small>";
    host.appendChild(el);
  }
  return el;
}
function updateHud(){
  const el=ensureHud();if(!el)return;
  el.querySelector("b").textContent=fmt(run?run.answerPoints:0);
}
function renderHome(){
  ensureStyle();
  const panel=document.querySelector("#startScreen .panel");if(!panel)return;
  let bar=document.getElementById("languagePointsHome");
  if(!bar){bar=document.createElement("div");bar.id="languagePointsHome";bar.className="lp-homebar";const anchor=panel.querySelector(".hero-progress");if(anchor)panel.insertBefore(bar,anchor);else panel.appendChild(bar);}
  const s=load(),p=boardPos(s.boardAbs),lap=boardLap(s.boardAbs);
  bar.innerHTML="<div class='lp-homecell'><b>"+fmt(s.totalPoints)+"</b><span>LANGUAGE PTS</span></div><div class='lp-homecell'><b>"+fmt(s.rating)+"</b><span>RATING</span></div><div class='lp-homecell'><b>"+p+"/100</b><span>CAMINO "+lap+"</span></div>";
}
function beginLevel(meta){
  run={id:APP+"-"+Date.now()+"-"+Math.random().toString(36).slice(2),target:Number.isFinite(meta&&meta.target)?Number(meta.target):null,answerPoints:0,answers:0,awarded:false};
  setTimeout(function(){ensureHud();updateHud();},0);
}
function recordAnswer(data){
  if(!run)beginLevel({});
  run.answers++;
  if(data&&data.correct){
    const limit=Math.max(.1,Number(data.timeLimit)||DEFAULT_LIMIT),sec=clamp(Number(data.sec)||limit,0,limit);
    const speed=clamp(1-sec/limit,0,1);
    run.answerPoints+=90+Math.round(30*speed);
  }
  updateHud();
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
  o.innerHTML="<div class='lp-stage'><div class='lp-kicker'>LEVEL SCORE</div><div class='lp-score' id='lpScore'>0 PTS</div><div class='lp-rating' id='lpRating'></div><div class='lp-dice-zone'><div class='lp-die-wrap'><div class='lp-die' id='lpDie' data-v='1'><div class='lp-face lp-f1'>⚀</div><div class='lp-face lp-f2'>⚁</div><div class='lp-face lp-f3'>⚂</div><div class='lp-face lp-f4'>⚃</div><div class='lp-face lp-f5'>⚄</div><div class='lp-face lp-f6'>⚅</div></div></div></div><div class='lp-dice-caption' id='lpDiceCaption'>TIRANDO DADO…</div><div class='lp-road-wrap'><div class='lp-road' id='lpRoad'></div><div class='lp-token' id='lpToken'></div></div><div class='lp-move' id='lpMove'></div><div class='lp-details' id='lpDetails'></div><div class='lp-lap' id='lpLap'></div></div>";
  document.body.appendChild(o);return o;
}
function renderRoad(abs){
  const road=document.getElementById("lpRoad");if(!road)return;
  let html="";
  for(let i=0;i<9;i++){const n=boardPos(abs+i),special=(n%10===0||n===25||n===50||n===75||n===100);html+="<div class='lp-tile"+(special?" special":"")+"'>"+n+"</div>";}
  road.innerHTML=html;
}
function showReward(r){
  return new Promise(function(resolve){
    const o=ensureOverlay(),die=document.getElementById("lpDie"),token=document.getElementById("lpToken");
    document.getElementById("lpScore").textContent=fmt(r.points)+" PTS";
    document.getElementById("lpRating").textContent="RATING "+(r.ratingDelta>=0?"+":"")+r.ratingDelta+" → "+fmt(r.rating);
    document.getElementById("lpDiceCaption").textContent="TIRANDO DADO…";
    document.getElementById("lpMove").textContent="BASE +"+r.baseMoves;
    document.getElementById("lpDetails").textContent=r.correct+"/15 · TARGET "+(Number.isFinite(r.target)?r.target.toFixed(1):"—")+" · BONUS TARGET "+(r.targetBonus>=0?"+":"")+r.targetBonus;
    document.getElementById("lpLap").textContent="CAMINO "+r.lap+" · CASILLA "+r.fromPos+" → "+r.toPos;
    renderRoad(r.beforeAbs);
    token.style.left="7.1%";
    die.classList.remove("spin");die.setAttribute("data-v","1");
    o.style.display="grid";o.setAttribute("aria-hidden","false");requestAnimationFrame(function(){o.classList.add("show");});
    setTimeout(function(){die.classList.add("spin");},180);
    setTimeout(function(){die.classList.remove("spin");die.setAttribute("data-v",String(r.die));document.getElementById("lpDiceCaption").textContent="DADO "+r.die+" · BONUS +"+r.diceBonus;document.getElementById("lpMove").textContent="AVANCE +"+r.moves+" CASILLAS";},1100);
    setTimeout(function(){token.style.left=(7.1+r.moves*10.72)+"%";try{navigator.vibrate&&navigator.vibrate([18,25,28]);}catch(e){}},1400);
    setTimeout(function(){o.classList.remove("show");},2920);
    setTimeout(function(){o.style.display="none";o.setAttribute("aria-hidden","true");resolve(r);},3120);
  });
}
function appendEndSummary(r){
  const e=document.getElementById("endSub");if(!e||!r)return;
  const bit=" · "+fmt(r.points)+" PTS · RATING "+(r.ratingDelta>=0?"+":"")+r.ratingDelta+" · CASILLA "+r.toPos;
  if(!e.textContent.includes(" PTS · RATING"))e.textContent+=bit;
}
async function awardLevel(meta){
  if(!run)beginLevel({target:meta&&meta.target});
  if(run.awarded)return run.result;
  run.awarded=true;
  meta=meta||{};
  const correct=Number(meta.correct)||0,total=Number(meta.total)||15,target=Number.isFinite(meta.target)?Number(meta.target):run.target;
  let targetBonus=0;
  if(Number.isFinite(target)){
    if(correct>=target)targetBonus=100+Math.round(Math.max(0,correct-target)*45);
    else targetBonus=-Math.round(Math.max(0,target-correct)*35);
  }
  const recoveryBonus=(Number(meta.recovered)||0)*15,masteryBonus=(Number(meta.mastered)||0)*30,perfectBonus=correct===total&&total===15?150:0;
  const points=clamp(Math.round(run.answerPoints+targetBonus+recoveryBonus+masteryBonus+perfectBonus),0,2200);
  const base=baseMoves(points),die=dieRoll(),dBonus=diceBonus(die),moves=base+dBonus,rd=ratingDelta(points);
  const s=load(),beforeAbs=Math.max(1,Number(s.boardAbs)||1),afterAbs=beforeAbs+moves;
  s.totalPoints=(Number(s.totalPoints)||0)+points;s.rating=Math.max(0,(Number(s.rating)||1000)+rd);s.bestRating=Math.max(Number(s.bestRating)||1000,s.rating);s.boardAbs=afterAbs;s.sessions=(Number(s.sessions)||0)+1;
  const ap=s.apps[APP]&&typeof s.apps[APP]==="object"?s.apps[APP]:{points:0,sessions:0,best:0};ap.points=(Number(ap.points)||0)+points;ap.sessions=(Number(ap.sessions)||0)+1;ap.best=Math.max(Number(ap.best)||0,points);s.apps[APP]=ap;
  const result={appId:APP,points:points,answerPoints:run.answerPoints,targetBonus:targetBonus,recoveryBonus:recoveryBonus,masteryBonus:masteryBonus,perfectBonus:perfectBonus,correct:correct,total:total,target:target,baseMoves:base,die:die,diceBonus:dBonus,moves:moves,ratingDelta:rd,rating:s.rating,beforeAbs:beforeAbs,afterAbs:afterAbs,fromPos:boardPos(beforeAbs),toPos:boardPos(afterAbs),lap:boardLap(afterAbs),at:Date.now(),runId:run.id};
  s.history.push(result);s.history=s.history.slice(-250);save(s);run.result=result;
  await showReward(result);appendEndSummary(result);renderHome();return result;
}
function snapshot(){return load();}
ensureStyle();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderHome);else setTimeout(renderHome,0);
window.LanguagePoints={beginLevel:beginLevel,recordAnswer:recordAnswer,awardLevel:awardLevel,snapshot:snapshot,renderHome:renderHome,appendEndSummary:appendEndSummary};
})();