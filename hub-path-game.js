(()=>{
"use strict";
const VERSION="1.0.0",BOARD=60,KEY="adrian_hub_path_game_v1";
const THEMES={
 english:{title:"ENGLISH TRAIL",scene:"COUNTRYSIDE",sky:"#182a25",ground:"#2c4735",accent:"#8fd19e",token:"EN"},
 catala:{title:"RUTA MEDITERRÀNIA",scene:"MEDITERRANI",sky:"#17313b",ground:"#624435",accent:"#efb46e",token:"CA"},
 "b2-cloze":{title:"B2 TERRITORY",scene:"CAMBRIDGE",sky:"#20283b",ground:"#42394b",accent:"#9fb8f4",token:"B2"},
 "phrasal-verbs":{title:"CITY ROUTE",scene:"CITY",sky:"#171f35",ground:"#343451",accent:"#b39df2",token:"PV"},
 hoti0108:{title:"RUTA HOTELERA",scene:"DESTINATION",sky:"#173333",ground:"#43513a",accent:"#e8c56b",token:"HT"},
 default:{title:"HUB ROUTE",scene:"HUB",sky:"#172822",ground:"#35483b",accent:"#96c9aa",token:"H"}
};
const SPECIAL={7:{kind:"boost",delta:2,icon:"↑"},12:{kind:"back",delta:-2,icon:"↓"},18:{kind:"boost",delta:3,icon:"↑"},24:{kind:"shield",icon:"◇"},31:{kind:"boost",delta:4,icon:"↑"},38:{kind:"back",delta:-3,icon:"↓"},45:{kind:"boost",delta:5,icon:"↑"},52:{kind:"shield",icon:"◇"},58:{kind:"boost",delta:6,icon:"↑"},60:{kind:"finish",icon:"✦"}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sk=id=>`${KEY}:${id||"default"}`;
function load(id){try{return {...{steps:0,shields:0,seeds:0,totalNet:0,lastEventId:"",lastResult:null},...JSON.parse(localStorage.getItem(sk(id))||"{}")};}catch(e){return {steps:0,shields:0,seeds:0,totalNet:0,lastEventId:"",lastResult:null};}}
function save(id,s){try{localStorage.setItem(sk(id),JSON.stringify(s));}catch(e){}return s;}
function cell(abs){return abs<=0?0:((abs-1)%BOARD)+1;}
function lap(abs){return abs<=0?1:Math.floor((abs-1)/BOARD)+1;}
function movement({correct=0,total=15,bestCombo=0}={}){
 const t=Math.max(1,Number(total)||15),c=clamp(Number(correct)||0,0,t),wrong=t-c,eq=15*c/t;
 const base=Math.round(15*(c-wrong)/t),medal=eq>=14.5?5:eq>=13.5?3:eq>=12.5?2:0,combo=base>0?(bestCombo>=10?2:bestCombo>=5?1:0):0;
 return {correct:c,total:t,wrong,eq15:eq,base,medal,combo,move:clamp(base+medal+combo,-6,22)};
}
function apply(opts={}){
 const id=opts.appId||"default",eventId=String(opts.eventId||""),s=load(id);
 if(eventId&&s.lastEventId===eventId&&s.lastResult)return {...s.lastResult,duplicate:true};
 const m=movement(opts),start=Math.max(0,Number(s.steps)||0),shielded=m.move<0&&(s.shields||0)>0;
 let primary=shielded?0:m.move;if(shielded)s.shields--;
 let landed=Math.max(0,start+primary),sp=primary!==0?(SPECIAL[cell(landed)]||null):null,effect=0,reward="";
 if(sp?.kind==="boost"){effect=sp.delta;reward=`IMPULSO +${sp.delta}`;}
 else if(sp?.kind==="back"){effect=sp.delta;reward=`RETROCESO ${sp.delta}`;}
 else if(sp?.kind==="shield"){s.shields=(s.shields||0)+1;reward="ESCUDO CONSEGUIDO";}
 if(shielded)reward="ESCUDO · RETROCESO BLOQUEADO";
 const end=Math.max(0,landed+effect),crossings=Math.max(0,Math.floor(end/BOARD)-Math.floor(start/BOARD));
 if(crossings){s.seeds=(s.seeds||0)+crossings;reward=crossings>1?`META ×${crossings} · +${crossings} SEMILLAS`:"META · +1 SEMILLA";}
 s.steps=end;s.totalNet=(s.totalNet||0)+(end-start);
 const result={...m,start,landed,end,effect,net:end-start,shielded,special:sp,reward,lap:lap(end),cell:cell(end),shields:s.shields||0,seeds:s.seeds||0,crossings};
 s.lastEventId=eventId;s.lastResult=result;save(id,s);
 if(crossings)try{window.dispatchEvent(new CustomEvent("hub:path-reward",{detail:{appId:id,type:"seed",amount:crossings,state:s,result}}));}catch(e){}
 return result;
}
function inject(){
 if(document.getElementById("hub-path-game-style"))return;
 const st=document.createElement("style");st.id="hub-path-game-style";st.textContent=`
.hpg-overlay{position:fixed;inset:0;z-index:99990;display:grid;place-items:center;padding:14px;background:rgba(3,8,7,.88);backdrop-filter:blur(12px)}
.hpg-card{--hpg-accent:#96c9aa;--hpg-sky:#172822;--hpg-ground:#35483b;width:min(620px,96vw);border:1px solid rgba(255,255,255,.13);border-radius:24px;overflow:hidden;background:linear-gradient(180deg,var(--hpg-sky),#101815 54%,var(--hpg-ground));box-shadow:0 24px 80px #0009;color:#eef7f1;font-family:Inter,system-ui,sans-serif}
.hpg-host{width:100%}.hpg-stage{position:relative;overflow:hidden;padding:17px 16px 14px;background:radial-gradient(circle at 78% 18%,color-mix(in srgb,var(--hpg-accent) 26%,transparent),transparent 34%),linear-gradient(180deg,var(--hpg-sky),#101815 58%,var(--hpg-ground));border-radius:20px}
.hpg-stage:before{content:"";position:absolute;left:-8%;right:-8%;bottom:26%;height:32%;background:linear-gradient(155deg,transparent 16%,rgba(255,255,255,.05) 17% 20%,transparent 21%),linear-gradient(25deg,transparent 43%,rgba(0,0,0,.13) 44% 50%,transparent 51%);opacity:.85;pointer-events:none}
.hpg-stage:after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.34}
.hpg-stage[data-scene="COUNTRYSIDE"]:after{background:radial-gradient(circle at 82% 18%,#dfe9ad 0 5%,transparent 5.5%),radial-gradient(ellipse at 18% 72%,#446845 0 23%,transparent 24%),radial-gradient(ellipse at 72% 76%,#315a3b 0 31%,transparent 32%)}
.hpg-stage[data-scene="MEDITERRANI"]:after{background:radial-gradient(circle at 80% 18%,#ffd38c 0 6%,transparent 6.5%),linear-gradient(180deg,transparent 58%,rgba(63,154,170,.44) 59% 73%,transparent 74%),radial-gradient(ellipse at 22% 79%,#594f37 0 23%,transparent 24%)}
.hpg-stage[data-scene="CAMBRIDGE"]:after{background:repeating-radial-gradient(ellipse at 70% 70%,transparent 0 17px,rgba(193,205,235,.12) 18px 19px),linear-gradient(115deg,transparent 0 58%,rgba(159,184,244,.16) 59% 61%,transparent 62%)}
.hpg-stage[data-scene="CITY"]:after{background:linear-gradient(90deg,transparent 0 5%,rgba(179,157,242,.18) 5% 12%,transparent 12% 16%,rgba(255,255,255,.10) 16% 25%,transparent 25% 31%,rgba(179,157,242,.13) 31% 43%,transparent 43% 50%,rgba(255,255,255,.08) 50% 60%,transparent 60% 69%,rgba(179,157,242,.16) 69% 81%,transparent 81%) 0 78%/100% 33% no-repeat}
.hpg-stage[data-scene="DESTINATION"]:after{background:radial-gradient(circle at 79% 18%,#efd98f 0 5%,transparent 5.5%),linear-gradient(155deg,transparent 0 54%,rgba(87,122,94,.26) 55% 64%,transparent 65%),linear-gradient(25deg,transparent 0 58%,rgba(232,197,107,.12) 59% 61%,transparent 62%)}
.hpg-top,.hpg-scoreline,.hpg-foot{position:relative;z-index:2;display:flex;align-items:end;justify-content:space-between;gap:10px}.hpg-top small,.hpg-foot small{display:block;font-size:10px;font-weight:900;letter-spacing:.14em;color:#b8c9bf}.hpg-top b{font-size:16px;letter-spacing:.06em}.hpg-scene{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--hpg-accent)}
.hpg-scoreline{align-items:center;margin:10px 0 11px}.hpg-score{font-size:clamp(34px,10vw,58px);line-height:.9;font-weight:950}.hpg-score small{font-size:.36em;color:#c5d3cb}.hpg-move{font-size:clamp(27px,8vw,48px);font-weight:950;color:var(--hpg-accent);text-align:right}.hpg-move small{display:block;font-size:9px;letter-spacing:.13em;color:#c5d3cb}
.hpg-label{position:relative;z-index:2;min-height:17px;margin:-2px 0 8px;font-size:10px;font-weight:950;letter-spacing:.10em;color:#d9e7df}.hpg-board{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px;border-radius:18px;background:rgba(3,8,7,.42);border:1px solid rgba(255,255,255,.07)}
.hpg-cell{min-width:0;aspect-ratio:1.18;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.065);display:grid;place-items:center;position:relative;transition:transform .09s ease,background .09s ease,border-color .09s ease,box-shadow .09s ease}.hpg-cell span{font-size:12px;font-weight:950;color:#d7e5dd}.hpg-cell i{position:absolute;right:4px;top:2px;font-style:normal;font-size:10px;color:var(--hpg-accent)}
.hpg-cell.special{background:color-mix(in srgb,var(--hpg-accent) 12%,rgba(255,255,255,.055))}.hpg-cell.token{transform:scale(1.12);z-index:3;background:var(--hpg-accent);border-color:#fff8;box-shadow:0 0 0 3px #0004,0 0 22px color-mix(in srgb,var(--hpg-accent) 65%,transparent)}.hpg-cell.token span,.hpg-cell.token i{color:#101815}
.hpg-cell.hit{animation:hpg-hit .45s ease}.hpg-tokenmark{position:absolute;left:4px;bottom:2px;font-size:8px;font-weight:1000;color:#101815}.hpg-progress{position:relative;z-index:2;height:7px;margin:11px 1px 7px;border-radius:999px;background:#07100d;overflow:hidden}.hpg-progress i{display:block;height:100%;width:var(--p,0%);background:var(--hpg-accent);border-radius:inherit;transition:width 1.6s cubic-bezier(.18,.8,.18,1)}
.hpg-foot{align-items:center}.hpg-foot b{font-size:13px}.hpg-reward{color:var(--hpg-accent);text-align:right}.hpg-breakdown{position:relative;z-index:2;margin-top:7px;text-align:center;font-size:9px;font-weight:850;letter-spacing:.05em;color:#aebdb5}
@keyframes hpg-hit{50%{transform:scale(1.18);filter:brightness(1.35)}}@media(max-width:430px){.hpg-stage{padding:14px 11px 11px}.hpg-board{gap:4px;padding:6px}.hpg-cell{border-radius:9px}.hpg-cell span{font-size:11px}.hpg-scoreline{margin:8px 0}.hpg-breakdown{font-size:8px}}
@media(prefers-reduced-motion:reduce){.hpg-cell,.hpg-progress i{transition:none!important}.hpg-cell.hit{animation:none!important}}`;
 document.head.appendChild(st);
}
function windowCells(start,end){
 const lo0=Math.max(1,Math.min(start>0?start:1,end>0?end:1)-2),hiNeed=Math.max(start,end,1);
 let lo=lo0;if(hiNeed>lo+23)lo=hiNeed-23;lo=Math.max(1,lo);
 const rows=[];for(let r=0;r<4;r++){let row=[];for(let c=0;c<6;c++)row.push(lo+r*6+c);if(r%2)row.reverse();rows.push(...row);}return rows;
}
function specialClass(abs){return SPECIAL[cell(abs)]?" special":"";}
function markup(r,theme,label){
 const cells=windowCells(r.start,r.end).map(abs=>{const sp=SPECIAL[cell(abs)],mark=abs===r.start&&r.start>0?" token":"";return `<div class="hpg-cell${specialClass(abs)}${mark}" data-abs="${abs}"><span>${cell(abs)}</span>${sp?`<i>${sp.icon}</i>`:""}${mark?`<em class="hpg-tokenmark">${esc(theme.token)}</em>`:""}</div>`;}).join("");
 const pct=Math.max(0,Math.min(100,(r.cell||0)/BOARD*100)),sign=r.net>0?"+":"",achievement=r.eq15>=14.5?"GOLD":r.eq15>=13.5?"VIOLET":r.eq15>=12.5?"BLUE":"";
 const bits=[`BASE ${r.base>=0?"+":""}${r.base}`,r.medal?`${achievement} +${r.medal}`:"",r.combo?`COMBO +${r.combo}`:""].filter(Boolean).join(" · ");
 return `<div class="hpg-stage" data-scene="${esc(theme.scene)}" style="--hpg-accent:${theme.accent};--hpg-sky:${theme.sky};--hpg-ground:${theme.ground}"><div class="hpg-top"><div><small>HUB ROUTE · ${esc(theme.scene)}</small><b>${esc(theme.title)}</b></div><div class="hpg-scene">RUTA ${r.lap}</div></div><div class="hpg-scoreline"><div class="hpg-score">${Math.round(r.correct)}<small>/${Math.round(r.total)}</small></div><div class="hpg-move">${sign}${r.net}<small>CASILLAS</small></div></div><div class="hpg-label">${esc(label||"RONDA COMPLETA")}</div><div class="hpg-board">${cells}</div><div class="hpg-progress"><i style="--p:${pct}%"></i></div><div class="hpg-foot"><div><small>PROGRESO</small><b>${r.cell||0} / ${BOARD}</b></div><div class="hpg-reward"><small>${r.shields?`◇ ${r.shields} ESCUDO${r.shields===1?"":"S"}`:"SIN ESCUDO"}</small><b>${esc(r.reward||`${r.seeds} SEMILLA${r.seeds===1?"":"S"}`)}</b></div></div><div class="hpg-breakdown">${esc(bits)}</div></div>`;
}
async function animate(host,r,theme,duration){
 const board=host.querySelector(".hpg-board"),progress=host.querySelector(".hpg-progress i");if(!board)return;
 const mark=abs=>{board.querySelectorAll(".hpg-cell").forEach(x=>{x.classList.remove("token","hit");x.querySelector(".hpg-tokenmark")?.remove();});const el=board.querySelector(`[data-abs="${abs}"]`);if(el){el.classList.add("token");const m=document.createElement("em");m.className="hpg-tokenmark";m.textContent=theme.token;el.appendChild(m);}};
 if(progress)requestAnimationFrame(()=>progress.style.width=`${Math.max(0,Math.min(100,(r.cell||0)/BOARD*100))}%`);
 const dir=r.landed>=r.start?1:-1,steps=Math.abs(r.landed-r.start),travel=Math.min(1500,Math.max(360,steps*80)),delay=steps?travel/steps:0;
 for(let i=1;i<=steps;i++){mark(r.start+dir*i);if(delay)await sleep(delay);}
 if(r.effect){await sleep(120);const dir2=r.effect>0?1:-1;for(let i=1;i<=Math.abs(r.effect);i++){mark(r.landed+dir2*i);await sleep(95);}}
 mark(r.end);const final=board.querySelector(`[data-abs="${r.end}"]`);if(final)final.classList.add("hit");
 await sleep(Math.max(350,duration-travel-Math.abs(r.effect)*95-120));
}
async function resolve(opts={}){
 inject();const id=opts.appId||"default",theme={...THEMES.default,...(THEMES[opts.theme||id]||{}),...(opts.themeConfig||{})},r=apply(opts),duration=clamp(Number(opts.duration)||3200,1800,4500);
 let host=opts.mount||null,overlay=null;if(!host){overlay=document.createElement("div");overlay.className="hpg-overlay";overlay.innerHTML=`<div class="hpg-card"></div>`;document.body.appendChild(overlay);host=overlay.firstElementChild;}
 host.classList.add("hpg-host");host.innerHTML=markup(r,theme,opts.label||"");await sleep(90);await animate(host,r,theme,duration-90);if(overlay)overlay.remove();return r;
}
window.HubPathGame={version:VERSION,resolve,calculate:movement,getState:load,themes:THEMES};
})();