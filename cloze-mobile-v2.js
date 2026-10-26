/* Cloze Arena & Mission Deck · Gemini Mobile First v2.
   Adapted to original engine hooks, not a replacement for core scoring/session. */
(function(){
"use strict";
const PACE_KEY="b2_cloze_pace_v1";
const PACE_MODES=Object.freeze({
 fast:{label:"Ágil ×0.85",factor:.85},
 standard:{label:"B2 ×1.0",factor:1},
 calm:{label:"Calma ×1.2",factor:1.2}
});
function mode(){
 try{const a=localStorage.getItem(PACE_KEY);return PACE_MODES[a]?a:"standard"}catch(_){return "standard"}
}
function setPaceMode(v){
 if(!PACE_MODES[v])return;
 try{localStorage.setItem(PACE_KEY,v)}catch(_){}
 syncHomeControls();
}
function getPaceFactor(){return PACE_MODES[mode()].factor}
function el(id){return document.getElementById(id)}
function getSession(){try{return typeof session!=="undefined"?session:null}catch(_){return null}}
function getCurrent(){try{return typeof current!=="undefined"?current:null}catch(_){return null}}
function getSound(){try{return typeof soundOn!=="undefined"?!!soundOn:false}catch(_){return false}}
function escapeHtml(str){return String(str??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function appendGap(node,text){
 for(const piece of String(text).split(/(_{2,})/)){
  if(/^_{2,}$/.test(piece)){const s=document.createElement("span");s.className="gap-slot";s.textContent="____";s.setAttribute("aria-label","Hueco de respuesta");node.append(s)}
  else if(piece)node.append(document.createTextNode(piece))
 }
}
function formatPromptForPart(){
 const node=el("questionText"),q=getCurrent();
 if(!node||!q)return;
 // Render only prior to answering; the original engine handles the answer reveal.
 try{if(typeof locked!=="undefined"&&locked)return}catch(_){}
 const raw=String(q.visibleQuestion||q.q||"");
 const part=Number(q.sourcePart)||1;
 const stamp=String(q.id??"")+"|"+raw;
 if(node.dataset.cmv2Stamp===stamp&&node.querySelector(".cmv2-p4-layout,.cmv2-root-word-bar,.gap-slot"))return;
 // Never override original answer highlights or existing interactive production helpers.
 if(node.querySelector(".ql-answer,.grammar-answer,.focus-active"))return;
 if(part===4&&raw.includes("\n")){
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const keyLine=lines.find(x=>/^KEY\s*WORD\s*:/i.test(x));
  if(lines.length>=3&&keyLine){
   const wrap=document.createElement("div");wrap.className="cmv2-p4-layout";
   const lead=document.createElement("div");lead.className="cmv2-p4-lead";lead.textContent=lines[0];
   const key=document.createElement("div");key.className="cmv2-p4-keybar";
   const small=document.createElement("small");small.textContent="KEY WORD";
   const strong=document.createElement("b");strong.textContent=keyLine.replace(/^KEY\s*WORD\s*:\s*/i,"").trim()||String(q.keyword||"");
   key.append(small,strong);
   const target=document.createElement("div");target.className="cmv2-p4-target";
   appendGap(target,lines.filter(x=>x!==lines[0]&&x!==keyLine).join(" "));
   wrap.append(lead,key,target);node.replaceChildren(wrap);node.dataset.cmv2Stamp=stamp;return;
  }
 }
 if(part===3){
  const m=raw.match(/^(.*?)\s*\(([A-Z][A-Z-]{1,})\)\s*$/s);
  if(m){
   const stem=document.createElement("div");appendGap(stem,m[1]);
   const bar=document.createElement("div");bar.className="cmv2-root-word-bar";
   const label=document.createElement("span");label.textContent="WORD FORMATION · RAÍZ";
   const key=document.createElement("strong");key.textContent=m[2];
   bar.append(label,key);node.replaceChildren(stem,bar);node.dataset.cmv2Stamp=stamp;return;
  }
 }
 if([1,2,3].includes(part)&&/_{2,}/.test(raw)){
  node.replaceChildren();appendGap(node,raw);node.dataset.cmv2Stamp=stamp;
 }
}
function syncHomeControls(){
 for(const btn of document.querySelectorAll(".cmv2-seg-btn")){
  btn.setAttribute("aria-pressed",String(btn.dataset.pace===mode()));
 }
 const sound=getSound();
 const home=el("cmv2HomeSoundBtn");
 if(home)home.textContent=sound?"🔊 Sonido sí":"🔇 Silencio";
 const arena=el("cmv2ArenaSound");
 if(arena)arena.textContent=sound?"🔊":"🔇";
 const src=[["cmv2SnapCoverage","coverageText"],["cmv2SnapAccuracy","startAccuracy"],["cmv2SnapRank","startAiLevel"]];
 for(const [dest,id] of src){const a=el(dest),b=el(id);if(a&&b){const s=(b.textContent||"").trim().replace(/\s*\/\s*15$/,"");if(a.textContent!==s)a.textContent=s||"—"}}
}
function enhanceHomeDeck(){
 const panel=document.querySelector("#startScreen>.panel");
 if(!panel||panel.querySelector(".cmv2-home-top"))return;
 const top=document.createElement("div");top.className="cmv2-home-top";
 top.innerHTML='<div class="cmv2-brand-pill"><span class="cmv2-brand-monogram">CQ</span><span>CAMBRIDGE B2 · CLOZE</span></div><button type="button" id="cmv2HomeSoundBtn" class="cmv2-home-audio-btn">🔊 Audio</button>';
 panel.prepend(top);
 const meta=panel.querySelector(".meta");
 if(meta){
  const snap=document.createElement("div");snap.className="cmv2-hero-snapshot";
  snap.innerHTML='<div class="cmv2-snap-tile"><b id="cmv2SnapCoverage">0 / 900</b><span>Cobertura</span></div><div class="cmv2-snap-tile"><b id="cmv2SnapAccuracy">—</b><span>Precisión</span></div><div class="cmv2-snap-tile"><b id="cmv2SnapRank">—</b><span>Rango</span></div>';
  meta.after(snap);
 }
 const readRow=panel.querySelector(".read-first-row");
 if(readRow){
  const deck=document.createElement("div");deck.className="cmv2-deck-controls";
  deck.innerHTML='<span class="cmv2-control-label">Ritmo del cronómetro adaptado</span><div class="cmv2-segmented" role="group" aria-label="Ritmo del cronómetro"><button type="button" class="cmv2-seg-btn" data-pace="fast">Ágil · ×0.85</button><button type="button" class="cmv2-seg-btn" data-pace="standard">B2 · ×1.0</button><button type="button" class="cmv2-seg-btn" data-pace="calm">Calma · ×1.2</button></div>';
  readRow.before(deck);
  for(const btn of deck.querySelectorAll(".cmv2-seg-btn"))btn.addEventListener("click",()=>setPaceMode(btn.dataset.pace));
 }
 el("cmv2HomeSoundBtn")?.addEventListener("click",()=>{el("soundBtn")?.click();syncHomeControls()});
 syncHomeControls();
}
function ensureArenaHud(){
 const stage=el("gameScreen"),playfield=stage?.querySelector(".playfield");
 if(!stage||!playfield)return;
 if(el("cmv2ArenaHeader"))return;
 const header=document.createElement("header");header.className="cmv2-arena-header";header.id="cmv2ArenaHeader";
 header.innerHTML='<div class="cmv2-hud-bar"><button id="cmv2ExitProxy" class="cmv2-exit-btn" type="button">↩ Salir</button><div class="cmv2-hud-center"><span id="cmv2PartBadge" class="cmv2-part-badge">PART 1</span><span id="cmv2QCounter" class="cmv2-q-counter">1 / 15</span><span id="cmv2ComboPill" class="cmv2-combo-pill hidden">🔥 ×2</span></div><button id="cmv2ArenaSound" type="button" class="cmv2-sound-btn" aria-label="Alternar sonido">🔊</button></div><div id="cmv2Progress" class="cmv2-progress-track" role="progressbar" aria-label="Progreso de la partida" aria-valuemin="0" aria-valuemax="15" aria-valuenow="0"></div><div id="cmv2TimerCard" class="cmv2-timer-card" data-phase="answer" data-state="normal"><div class="cmv2-timer-top"><span id="cmv2TimerLabel" class="cmv2-timer-status">Tiempo adaptado</span><strong id="cmv2TimerDigits" class="cmv2-timer-digits">18.0s</strong></div><div class="cmv2-timer-track"><div id="cmv2TimerTargetMark" class="cmv2-timer-target-mark" title="Tiempo objetivo"></div><div id="cmv2TimerFill" class="cmv2-timer-fill"></div></div></div>';
 stage.insertBefore(header,playfield);
 el("cmv2ExitProxy")?.addEventListener("click",()=>el("abortSessionBtn")?.click());
 el("cmv2ArenaSound")?.addEventListener("click",()=>{el("soundBtn")?.click();syncHomeControls()});
 for(let i=0;i<15;i++){const pill=document.createElement("i");pill.className="cmv2-progress-pill";el("cmv2Progress").append(pill)}
}
let lastCombo=0,preReadAt=0,preReadIndex=-1,preReadTotal=3500;
function tickArenaUi(){
 const game=el("gameScreen"),s=getSession(),q=getCurrent();
 if(!game||game.classList.contains("hidden")||!s||!q)return;
 ensureArenaHud();
 formatPromptForPart();
 const part=Number(q.sourcePart)||1,exam=String(q.sourceExam||"1");
 if(el("cmv2PartBadge"))el("cmv2PartBadge").textContent="EX "+(exam.length<=2?exam.padStart(2,"0"):exam)+" · P"+part;
 if(el("cmv2QCounter"))el("cmv2QCounter").textContent=Math.min(s.plan.length,s.index+1)+" / "+s.plan.length;
 const combo=Number(s.combo)||0,pill=el("cmv2ComboPill");
 if(pill){
  pill.classList.toggle("hidden",combo<2);pill.textContent="🔥 ×"+combo;
  if(combo!==lastCombo&&combo>=2){pill.classList.remove("pop");void pill.offsetWidth;pill.classList.add("pop")}
  lastCombo=combo;
 }
 const progress=el("cmv2Progress"),children=progress?.children||[];
 if(progress){progress.setAttribute("aria-valuemax",String(s.plan.length));progress.setAttribute("aria-valuenow",String(s.index));
  if(children.length!==s.plan.length){progress.replaceChildren();for(let i=0;i<s.plan.length;i++){const n=document.createElement("i");n.className="cmv2-progress-pill";progress.append(n)}}
  [...progress.children].forEach((p,i)=>{const rec=s.records?.[i];p.className="cmv2-progress-pill"+(i===s.index?" current":rec?(rec.correct?" correct":" wrong"):"")});
 }
 const limit=Math.max(1,Number(typeof currentTimeLimitSec!=="undefined"?currentTimeLimitSec:15)||15);
 const target=Number(typeof currentTimeTargetSec!=="undefined"?currentTimeTargetSec:8.5)||8.5;
 const answers=el("answers"),preread=!!answers?.classList.contains("read-first-hidden");
 const timerCard=el("cmv2TimerCard"),digits=el("cmv2TimerDigits"),label=el("cmv2TimerLabel"),fill=el("cmv2TimerFill"),mark=el("cmv2TimerTargetMark");
 if(!timerCard||!digits||!label||!fill)return;
 if(mark)mark.style.left=(Math.max(8,Math.min(92,(1-target/limit)*100)).toFixed(1))+"%";
 if(preread){
  const configured=(Number(answers?.dataset?.nucleoReadSeconds)||3.5)*1000;
  if(preReadIndex!==s.index||preReadAt===0){preReadAt=performance.now();preReadIndex=s.index;preReadTotal=configured}
  const remaining=Math.max(0,preReadTotal-(performance.now()-preReadAt));
  timerCard.dataset.phase="preread";timerCard.dataset.state="normal";
  label.textContent="Lectura previa · sin presión";digits.textContent=(remaining/1000).toFixed(1)+"s";
  fill.style.width=(remaining/Math.max(1,preReadTotal)*100).toFixed(1)+"%";
  return;
 }
 preReadAt=0;timerCard.dataset.phase="answer";
 let activeDeadline=0,wasLocked=false;
 try{activeDeadline=typeof deadline!=="undefined"?deadline:0;wasLocked=typeof locked!=="undefined"?locked:false}catch(_){}
 const left=wasLocked?Number(el("timerText")?.textContent)||0:Math.max(0,(activeDeadline-performance.now())/1000);
 const pct=Math.max(0,Math.min(100,left/limit*100));
 timerCard.dataset.state=left<=4.2?"urgent":pct<=42?"warn":"normal";
 label.textContent=wasLocked?"Respuesta registrada":"Tiempo adaptado · Meta ≤"+target.toFixed(0)+"s";
 digits.textContent=left.toFixed(1)+"s";fill.style.width=pct.toFixed(1)+"%";
}
function showLiveFeedback(payload){
 const box=el("feedback");if(!box||!payload)return;
 const {ok,type,sec,correct,rule}=payload;
 const badge={automatic:"⚡ AUTOMATIC",secure:"✓ SECURE","slow-correct":"✓ CORRECT",
 "fast-wrong":"✕ IMPULSIVE MISS","slow-wrong":"✕ REVIEW",timeout:"⏱ TIME OUT"}[type]||(ok?"✓ CORRECT":"✕ REVIEW");
 const r=String(rule||"").replace(/^[A-D]\s*-\s*[^.]+\.\s*/i,"");
 const bonus=ok?(getSession()?.lastReward||"COMBO ×"+(getSession()?.combo||1)):"CLAVE: "+String(correct??"");
 box.className="feedback cmv2-live-feedback show "+(ok?"ok":"no");
 box.innerHTML='<div class="cmv2-fb-head"><b>'+escapeHtml(badge)+" · "+Number(sec||0).toFixed(1)+'s</b><span>'+escapeHtml(bonus)+'</span></div><div class="cmv2-fb-rule">'+escapeHtml(r||"Revisa la respuesta resaltada.")+"</div>";
}
function clearLiveFeedback(){
 const box=el("feedback");if(box){box.className="feedback cmv2-live-feedback";box.replaceChildren()}
}
function compactEndScreen(){
 const panel=document.querySelector("#endScreen>.panel");
 if(!panel||panel.querySelector(".cmv2-end-fold"))return;
 const fold=document.createElement("details");fold.className="cmv2-end-fold";
 const summary=document.createElement("summary");summary.textContent="📊 Estadísticas, gráficas y JSON · Ver detalles";fold.append(summary);
 const selected=["#endAiHandoff",".ai-valuation-box","#endCampaignPracticeEstimate",".grid",".learning-score-box",".charts"];
 let moved=0;
 for(const sel of selected){
  const node=[...panel.children].find(x=>x.matches?.(sel));
  if(node){fold.append(node);moved++}
 }
 if(moved){const bottom=panel.querySelector(".end-secondary-actions");if(bottom)bottom.before(fold);else panel.append(fold)}
}
function boot(){
 enhanceHomeDeck();ensureArenaHud();compactEndScreen();clearLiveFeedback();syncHomeControls();
 setInterval(()=>{tickArenaUi();syncHomeControls()},100);
}
window.ClozeMobileV2=Object.freeze({version:"2.0.0",getPaceMode:mode,setPaceMode,getPaceFactor,showLiveFeedback,clearLiveFeedback,syncHomeControls});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();