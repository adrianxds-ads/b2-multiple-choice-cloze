
const INITIAL_PRIORS = {};
const APP_VERSION = "1.2.0";
const STORAGE_KEY = "adaptive_b2_cloze_campaign1_v1";
const GLOBAL_LEVEL_KEY = "adaptive_b2_cloze_global_level_v1";
const SESSION_SIZE = 15;
const TIME_LIMIT = 15;
const HISTORY_LIMIT = 6000;
const SESSION_HISTORY_LIMIT = 1000;
const VISUAL_SYSTEM=window.ADRIAN_VISUAL_SYSTEM||null;
const AVS_RANKS=VISUAL_SYSTEM?.ranks||[{color:"#422522",surface:"#1A1714",band:"#291F1B",text:"#91817F"},{color:"#512927",surface:"#1F1915",band:"#30211D",text:"#9A8382"},{color:"#632D2A",surface:"#241A16",band:"#3A231F",text:"#A58583"},{color:"#762F32",surface:"#2B1B19",band:"#442423",text:"#B08688"},{color:"#843729",surface:"#2F1D16",band:"#4B281E",text:"#B88B83"},{color:"#904311",surface:"#33210E",band:"#512E12",text:"#BF9275"},{color:"#90570C",surface:"#33270D",band:"#51390F",text:"#BF9E72"},{color:"#8B6B05",surface:"#312E0A",band:"#4F430C",text:"#BCA96E"},{color:"#798136",surface:"#2B351A",band:"#454F25",text:"#B1B68A"},{color:"#57965A",surface:"#213C26",band:"#335A38",text:"#9EC29F"},{color:"#32A48F",surface:"#154037",band:"#206153",text:"#88CABE"},{color:"#4AA7C8",surface:"#1C4149",band:"#2D6271",text:"#96CCDF"},{color:"#7AA5EC",surface:"#2C4054",band:"#466184",text:"#B2CBF4"},{color:"#BB9EF0",surface:"#413E56",band:"#675E86",text:"#D8C7F6"},{color:"#E7BF57",surface:"#4F4925",band:"#7E6F36",text:"#F1DA9E"}];
const COLOR_BANDS_15=AVS_RANKS.map(x=>x.color);
const SURFACE_BANDS_15=AVS_RANKS.map(x=>x.surface||x.color);
const GRAPH_BANDS_15=AVS_RANKS.map(x=>x.band||x.color);
const AVS_TEXT_BANDS_15=AVS_RANKS.map(x=>x.text||x.color);
let CAMPAIGN=null, BANK=[], state=null, session=null, timerHandle=null, deadline=0, current=null, locked=false;
let audioCtx=null, soundOn=true, lastTickShown=TIME_LIMIT+1, lastUrgentBeat=-1;
let focusLastActivityTs=Date.now(),focusLastTickTs=Date.now(),focusSaveMs=0,focusTimerHandle=null;

const $=id=>document.getElementById(id);
function applyVisualSystemTokens(){const r=document.documentElement;AVS_RANKS.forEach((x,i)=>{r.style.setProperty(`--rank-${i+1}`,x.color);r.style.setProperty(`--rank-${i+1}-surface`,x.surface||x.color);r.style.setProperty(`--rank-${i+1}-band`,x.band||x.color);r.style.setProperty(`--rank-${i+1}-text`,x.text||x.color);});r.style.setProperty("--reward-gold",COLOR_BANDS_15[14]);r.style.setProperty("--reward-gold-text",AVS_TEXT_BANDS_15[14]);r.style.setProperty("--elite-violet",COLOR_BANDS_15[13]);r.style.setProperty("--negative-wine",COLOR_BANDS_15[3]);}
function storedGlobalLevel(){try{return Math.max(1,Math.floor(Number(localStorage.getItem(GLOBAL_LEVEL_KEY))||1));}catch(e){return 1;}}
function syncGlobalLevel(level){const n=Math.max(1,Math.floor(Number(level)||1),storedGlobalLevel());try{localStorage.setItem(GLOBAL_LEVEL_KEY,String(n));}catch(e){}return n;}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const pct=x=>Math.round(x*100);
const fmtSec=ms=>(ms/1000).toFixed(1)+"s";
const stageNames=["Foundations","Control","B2 Patterns","Fluency","Automaticity","Mastery"];
const RATING_BANDS=[
  {min:0,key:"forest",name:"FOUNDATION"},
  {min:.35,key:"teal",name:"BUILDING"},
  {min:.50,key:"blue",name:"SOLID"},
  {min:.65,key:"indigo",name:"STRONG"},
  {min:.78,key:"amber",name:"ADVANCED"},
  {min:.88,key:"gold",name:"GOLD MASTERY"}
];
function ratingBand(r){
  let b=RATING_BANDS[0];
  for(const x of RATING_BANDS) if(r>=x.min)b=x;
  return b;
}
function applyRatingTheme(r){
  const b=ratingBand(r),rank=Math.max(1,Math.min(15,Math.ceil(clamp(Number(r)||0)*15))),color=COLOR_BANDS_15[rank-1];
  document.body.dataset.ratingBand=b.key;document.body.dataset.avsRatingRank=String(rank);document.documentElement.style.setProperty("--rating-rank-color",color);document.documentElement.style.setProperty("--rating-rank-rgb",colorRgb(color));
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
function playComplete(){tone(392,.075,.022,'sine');tone(523.25,.085,.024,'triangle',.070);tone(659.25,.100,.026,'sine',.145);tone(783.99,.155,.028,'sine',.230);}
function playCountdownStep(n){tone(n===1?1046.5:783.99,.055,.018,'triangle');}
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
const MEMORY_ECHOES={
  would_rather:{title:"Rather Be",artist:"Clean Bandit",cue:"WOULD RATHER"},
  inversion:{title:"Never Ever",artist:"All Saints",cue:"NEGATIVE FIRST → INVERSION"},
  third_conditional:{title:"If I Could Turn Back Time",artist:"Cher",cue:"PAST IMPOSSIBLE"},
  allow_to:{title:"Permission to Dance",artist:"BTS",cue:"ALLOW + OBJECT + TO"},
  neednt_have:{title:"No Need to Argue",artist:"The Cranberries",cue:"DID IT · NOT NECESSARY"},
  should_have:{title:"Should've Said No",artist:"Taylor Swift",cue:"PAST ADVICE / REGRET"},
  modal_deduction:{title:"It Must Have Been Love",artist:"Roxette",cue:"MODAL + HAVE + PARTICIPLE"},
  wish_past:{title:"Back to December",artist:"Taylor Swift",cue:"WISH + HAD + PARTICIPLE"},
  wish_present:{title:"Wish You Were Here",artist:"Pink Floyd",cue:"WISH + PAST SIMPLE"},
  mixed_conditional:{title:"The Scientist",artist:"Coldplay",cue:"PAST CAUSE → NOW RESULT"},
  causative:{title:"Fix You",artist:"Coldplay",cue:"HAVE + OBJECT + PARTICIPLE"},
  passive:{title:"Written in the Stars",artist:"Tinie Tempah",cue:"BE + PARTICIPLE"},
  backshift:{title:"She Said She Said",artist:"The Beatles",cue:"SAID → BACKSHIFT"},
  past_perfect:{title:"Already Gone",artist:"Kelly Clarkson",cue:"EARLIER PAST → HAD"},
  unless:{title:"If I Ain't Got You",artist:"Alicia Keys",cue:"UNLESS = IF NOT"},
  despite:{title:"I'm Still Standing",artist:"Elton John",cue:"DESPITE + NOUN / -ING"},
  look_forward:{title:"I Can't Wait",artist:"Nu Shooz",cue:"LOOK FORWARD TO + -ING"},
  get_used_to:{title:"Getting Used to You",artist:"Selena",cue:"GET USED TO + -ING"},
  used_to:{title:"Somebody That I Used to Know",artist:"Gotye",cue:"USED TO + INFINITIVO SIN TO"},
  make_bare:{title:"(You Make Me Feel Like) A Natural Woman",artist:"Aretha Franklin",cue:"MAKE/MADE → NO TO · MAKE ME FEEL"},
  whose:{title:"Whose Bed Have Your Boots Been Under?",artist:"Shania Twain",cue:"WHOSE + NOUN"},
  second_conditional:{title:"If I Were a Boy",artist:"Beyoncé",cue:"IF + PAST → WOULD"},
  had_better:{title:"You Better Run",artist:"Pat Benatar",cue:"HAD BETTER + INFINITIVO SIN TO"}
};
function learningTerminology(text){
  return String(text??"")
    .replace(/\bBASE VERB\b/g,"INFINITIVO SIN TO")
    .replace(/\bbase verb\b/gi,"infinitivo sin to")
    .replace(/\bbare infinitive\b/gi,"infinitivo sin to")
    .replace(/\bbase form of the verb\b/gi,"infinitivo sin to")
    .replace(/\bbase form\b/gi,"infinitivo sin to")
    .replace(/\bforma base\b/gi,"infinitivo sin to")
    .replace(/\bverbo base\b/gi,"infinitivo sin to")
    .replace(/\bverbo desnudo\b/gi,"infinitivo sin to");
}
const DISCOVERY_CARDS=[];
function unlockedDiscoveryCards(){const today=localDateKey();return DISCOVERY_CARDS.filter(x=>!x.releasedOn||x.releasedOn<=today);}
function memoryEchoFor(cat,correctAnswer=""){
  if(cat==="so_such")return /\bsuch\b/i.test(correctAnswer)?{title:"Such Great Heights",artist:"The Postal Service",cue:"SUCH + NOUN"}:{title:"So What",artist:"P!nk",cue:"SO + ADJECTIVE"};
  if(cat==="too_enough")return /\benough\b/i.test(correctAnswer)?{title:"Never Enough",artist:"Loren Allred",cue:"ADJECTIVE + ENOUGH"}:{title:"Too Much",artist:"Spice Girls",cue:"TOO + ADJECTIVE"};
  return MEMORY_ECHOES[cat]||null;
}
function spotifySearchUrl(e){return e?`https://open.spotify.com/search/${encodeURIComponent(`${e.artist} ${e.title}`)}`:"";}
function spotifyOpenHtml(e,cls="spotify-open"){if(!e)return "";return `<a class="${cls}" href="${escapeHtml(spotifySearchUrl(e))}" target="_blank" rel="noopener noreferrer">▶ OPEN IN SPOTIFY</a>`;}
function keyMemoryEchoHtml(cat){
  const x=memoryEchoFor(cat,cat==="so_such"?"such":cat==="too_enough"?"enough":"");if(!x)return "";
  return `<em class="key-memory-echo"><small>MUSIC ECHO</small><span>${escapeHtml(x.artist)} · ${escapeHtml(x.title)}</span><b>${escapeHtml(x.cue)}</b></em>`;
}
function showMemoryEcho(cat,correctAnswer=""){
  const el=$("memoryEcho"),x=memoryEchoFor(cat,correctAnswer);if(!el||!x)return;
  el.innerHTML=`<b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.artist)}</span>`;
  el.classList.remove("show");void el.offsetWidth;el.classList.add("show");
  clearTimeout(showMemoryEcho._timer);showMemoryEcho._timer=setTimeout(()=>el.classList.remove("show"),1350);
}
function playKeyFlip(revealed=true,soft=false){
  const notes=revealed?[[659.25,0],[987.77,.045],[1318.5,.095]]:[[987.77,0],[783.99,.045],[587.33,.09]],gain=soft?.006:.011;
  notes.forEach(([f,d],i)=>tone(f,i===2?.085:.055,i===2?gain:gain*.82,i===1?'triangle':'sine',d));
}
function haptic(ok){
  try{if(navigator.vibrate)navigator.vibrate(ok?18:[24,16,42]);}catch(e){}
}
function pulseFeedback(ok){
  const cls=ok?"feedback-correct":"feedback-wrong";
  document.body.classList.remove("feedback-correct","feedback-wrong");
  void document.body.offsetWidth;
  document.body.classList.add(cls);
  setTimeout(()=>document.body.classList.remove(cls),430);
}
function burstParticles(anchor){
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const layer=$("particles");if(!layer)return;
  const r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():null;
  const cx=r?r.left+r.width/2:innerWidth/2,cy=r?r.top+r.height/2:innerHeight*.55;
  const colors=[COLOR_BANDS_15[14],COLOR_BANDS_15[13],COLOR_BANDS_15[12],COLOR_BANDS_15[11],COLOR_BANDS_15[9]];
  for(let i=0;i<6;i++){
    const p=document.createElement("i"),a=(Math.PI*2*i/6)+(Math.random()-.5)*.28,d=26+Math.random()*42;
    p.className="particle";p.style.left=cx+"px";p.style.top=cy+"px";
    p.style.setProperty("--dx",Math.cos(a)*d+"px");p.style.setProperty("--dy",Math.sin(a)*d+"px");
    p.style.setProperty("--rot",Math.round((Math.random()-.5)*180)+"deg");p.style.setProperty("--size",(4+Math.random()*4)+"px");
    p.style.setProperty("--delay",Math.round(Math.random()*70)+"ms");p.style.setProperty("--particle-color",colors[i%colors.length]);
    layer.appendChild(p);setTimeout(()=>p.remove(),460);
  }
}
function refreshSoundButton(){const b=$("soundBtn");if(!b)return;if(!audioSupported()){soundOn=false;b.disabled=true;b.textContent='🔇';b.setAttribute('aria-label','Audio unavailable');b.title='Audio unavailable';return;}b.disabled=false;b.textContent=soundOn?'🔊':'🔇';b.setAttribute('aria-label',soundOn?'Sound on':'Sound off');b.title='';}

async function loadCampaign(){
  if(window.__AE_CAMPAIGN__) return window.__AE_CAMPAIGN__;
  const r=await fetch(`./campaign-01.json?v=${encodeURIComponent(APP_VERSION)}`,{cache:"no-store"});
  if(!r.ok) throw new Error("Cannot load campaign");
  return r.json();
}

function seedMetric(cat){
  const p=INITIAL_PRIORS[cat]||[.42,.28,.34];
  return {k:p[0],a:p[1],t:p[2],attempts:0,correct:0,automatic:0,lapses:0,streak:0,interval:1,lastLevel:-99,lastTs:0,intervalDays:1,domains:{},lastMs:0};
}
function newState(){
  const metrics={}; CAMPAIGN.skills.forEach(s=>metrics[s.id]=seedMetric(s.id));
  return {
    schemaVersion:1,campaignId:CAMPAIGN.campaignId,level:Math.max(CAMPAIGN.startingLevel||1,storedGlobalLevel()),sessions:0,totalAttempts:0,totalCorrect:0,
    metrics,seen:{},templateLast:{},templateSeen:{},history:[],sessionHistory:[],finalAttempts:0,completed:false,contentRevision:5,
    dailyKey:{date:"",cat:""},keyring:[],keyJourneyStart:"",personalBestFluency:0,activeTrainingMs:0,focusTimeByDate:{},focusTargetsByDate:{},focusTrackingStartedAt:Date.now(),createdAt:Date.now(),updatedAt:Date.now()
  };
}
function validProgressState(s){
  return !!s&&typeof s==="object"&&s.campaignId===CAMPAIGN.campaignId&&s.schemaVersion===1&&
    s.metrics&&typeof s.metrics==="object"&&Number.isFinite(s.level)&&Number.isFinite(s.sessions)&&
    Number.isFinite(s.totalAttempts)&&(s.history==null||Array.isArray(s.history))&&
    (s.sessionHistory==null||Array.isArray(s.sessionHistory))&&(s.seen==null||typeof s.seen==="object");
}
function normaliseProgressState(s){
  s.level=syncGlobalLevel(s.level);
  if(!Number.isFinite(s.totalCorrect))s.totalCorrect=Object.values(s.metrics||{}).reduce((n,m)=>n+(Number(m?.correct)||0),0);
  for(const skill of CAMPAIGN.skills)if(!s.metrics[skill.id])s.metrics[skill.id]=seedMetric(skill.id);
  s.history=Array.isArray(s.history)?s.history.slice(-HISTORY_LIMIT):[];
  if(!Number.isFinite(s.activeTrainingMs))s.activeTrainingMs=s.history.reduce((sum,r)=>sum+(Number.isFinite(r?.ms)?r.ms:0),0);
  s.focusTimeByDate=s.focusTimeByDate&&typeof s.focusTimeByDate==="object"?s.focusTimeByDate:{};s.focusTargetsByDate=s.focusTargetsByDate&&typeof s.focusTargetsByDate==="object"?s.focusTargetsByDate:{};if(!Number.isFinite(s.focusTrackingStartedAt))s.focusTrackingStartedAt=Date.now();
  s.sessionHistory=Array.isArray(s.sessionHistory)?s.sessionHistory.slice(-SESSION_HISTORY_LIMIT):[];
  s.seen=s.seen&&typeof s.seen==="object"?s.seen:{};s.templateLast=s.templateLast&&typeof s.templateLast==="object"?s.templateLast:{};s.templateSeen=s.templateSeen&&typeof s.templateSeen==="object"?s.templateSeen:{};
  {const activeFp=new Set(CAMPAIGN.questions.map(q=>q.fingerprint));for(const [fp,info] of Object.entries(s.seen))if(info&&typeof info==="object")info.retired=!activeFp.has(fp);}
  s.dailyKey=s.dailyKey&&typeof s.dailyKey==="object"?s.dailyKey:{date:"",cat:""};s.keyring=Array.isArray(s.keyring)?s.keyring.filter(x=>x&&typeof x.cat==="string").slice(0,25):[];const firstKeyDate=s.keyring.map(x=>x.firstDate).filter(Boolean).sort()[0]||s.dailyKey.date||"";s.keyJourneyStart=typeof s.keyJourneyStart==="string"&&s.keyJourneyStart?s.keyJourneyStart:firstKeyDate;s.keyring.forEach((x,i)=>x.number=i+1);const rebuildTemplateSeen=!Object.keys(s.templateSeen).length;
  for(const skill of CAMPAIGN.skills){const m=s.metrics[skill.id];if(!Number.isFinite(m.intervalDays))m.intervalDays=1;if(!Number.isFinite(m.lastTs))m.lastTs=0;}
  for(const r of s.history){const m=s.metrics[r.cat];if(m&&Number.isFinite(r.ts)&&r.ts>(m.lastTs||0))m.lastTs=r.ts;if(rebuildTemplateSeen&&r.templateId){const g=s.templateSeen[r.templateId]||(s.templateSeen[r.templateId]={count:0,lastTs:0,lastLevel:-99});g.count++;if((r.ts||0)>g.lastTs){g.lastTs=r.ts||0;g.lastLevel=r.level??g.lastLevel;}}}
  if((s.contentRevision||1)<2){
    const revisedCats=new Set(["despite","unless","whose"]),revisedFp=new Set(CAMPAIGN.questions.filter(q=>revisedCats.has(q.cat)).map(q=>q.fingerprint));
    for(const fp of Object.keys(s.seen))if(revisedFp.has(fp))delete s.seen[fp];
    for(const t of Object.keys(s.templateLast))if(t.startsWith("despite-")||t.startsWith("unless-")||t.startsWith("whose-"))delete s.templateLast[t];
    s.contentRevision=2;
  }
  if((s.contentRevision||2)<3){
    const revisedCats=new Set(["mixed_conditional","modal_deduction"]),revisedFp=new Set(CAMPAIGN.questions.filter(q=>revisedCats.has(q.cat)).map(q=>q.fingerprint));
    for(const fp of Object.keys(s.seen))if(revisedFp.has(fp))delete s.seen[fp];
    for(const t of Object.keys(s.templateLast))if(t.startsWith("mixed-")||t.startsWith("deduct-"))delete s.templateLast[t];
    for(const t of Object.keys(s.templateSeen))if(t.startsWith("mixed-")||t.startsWith("deduct-"))delete s.templateSeen[t];
    s.contentRevision=3;
  }
  if((s.contentRevision||3)<4){
    const repurposedCats=new Set(["verb_ing","verb_to","bare_infinitive","phrasal_get_take","phrasal_put_set","phrasal_look_come"]);
    s.legacyRepurposedMetrics=s.legacyRepurposedMetrics&&typeof s.legacyRepurposedMetrics==="object"?s.legacyRepurposedMetrics:{};
    for(const cat of repurposedCats){if(s.metrics[cat])s.legacyRepurposedMetrics[cat]=s.metrics[cat];s.metrics[cat]=seedMetric(cat);}
    const moved=s.history.filter(r=>repurposedCats.has(r.cat));s.legacyHistory=(Array.isArray(s.legacyHistory)?s.legacyHistory:[]).concat(moved).slice(-1500);s.history=s.history.filter(r=>!repurposedCats.has(r.cat));
    for(const fp of Object.keys(s.seen)){const cat=fp.split("|")[0];if(repurposedCats.has(cat)&&s.seen[fp])s.seen[fp].retired=true;}
    for(const t of Object.keys(s.templateLast))if([...repurposedCats].some(cat=>t.startsWith(cat+"-")))delete s.templateLast[t];
    for(const t of Object.keys(s.templateSeen))if([...repurposedCats].some(cat=>t.startsWith(cat+"-")))delete s.templateSeen[t];
    s.keyring=s.keyring.filter(x=>!repurposedCats.has(x.cat));if(repurposedCats.has(s.dailyKey?.cat))s.dailyKey={date:"",cat:""};
    s.contentRevision=4;
  }
  if((s.contentRevision||4)<5){
    const activeFp=new Set(CAMPAIGN.questions.map(q=>q.fingerprint));
    for(const [fp,info] of Object.entries(s.seen))if(info&&typeof info==="object")info.retired=!activeFp.has(fp);
    s.contentRevision=5;
  }
  return s;
}
function loadState(){
  try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");return validProgressState(s)?normaliseProgressState(s):newState();}
  catch(e){return newState();}
}
function save(){
  state.updatedAt=Date.now();state.history=state.history.slice(-HISTORY_LIMIT);state.sessionHistory=state.sessionHistory.slice(-SESSION_HISTORY_LIMIT);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  catch(e){console.error("Progress save failed",e);state.history=state.history.slice(-3000);state.sessionHistory=state.sessionHistory.slice(-500);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
}

function formatStudyTime(ms){const total=Math.max(0,Math.round((ms||0)/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h?`${h}h ${String(m).padStart(2,"0")}m`:m?`${m}m ${String(s).padStart(2,"0")}s`:`${s}s`;}
function localDayKey(ts=Date.now()){const d=new Date(ts),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
function dueQuestionCountNow(){const now=Date.now();return Object.values(state?.seen||{}).filter(x=>!x?.retired&&x?.lastTs&&now>=(x.nextDueTs||x.lastTs+(x.intervalDays||1)*86400000)).length;}
function focusPlanModel(){
  const due=dueQuestionCountNow(),weak=Object.values(state?.metrics||{}).filter(m=>metricMastery(m)<.45).length,recent=(state?.sessionHistory||[]).filter(x=>x.mode==="training").slice(-4);
  const dueBonus=due>=700?5:due>=350?4:due>=150?2:due>=50?1:0,weakBonus=weak>=6?4:weak>=3?2:weak>=1?1:0;
  const acc=recent.length?mean(recent.map(x=>x.accuracy||0)):1,ms=recent.length?mean(recent.map(x=>x.avgMs||0)):0,fatigue=recent.length>=3&&acc<.52&&ms>6500?-2:0;
  const recommended=Math.round(clamp(15+dueBonus+weakBonus+fatigue,12,25)),minimum=Math.max(10,recommended-5),stretch=Math.min(30,recommended+6);
  const why=["Base 15m",dueBonus?`reviews +${dueBonus}m`:"reviews estable",weakBonus?`${weak} Keys débiles +${weakBonus}m`:"Keys estables",fatigue?"fatiga -2m":""].filter(Boolean).join(" · ");
  return {minimum,recommended,stretch,due,weak,fatigue,why};
}
function ensureFocusTarget(day=localDayKey()){state.focusTargetsByDate=state.focusTargetsByDate||{};if(!state.focusTargetsByDate[day]){const p=focusPlanModel();state.focusTargetsByDate[day]={minimum:p.minimum,recommended:p.recommended,stretch:p.stretch,why:p.why,createdAt:Date.now()};}return state.focusTargetsByDate[day];}
function weekDays(){const now=new Date(),day=(now.getDay()+6)%7,monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-day);return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return {key:localDayKey(d.getTime()),label:["L","M","X","J","V","S","D"][i],future:d>Date.now(),today:localDayKey(d.getTime())===localDayKey()};});}
function focusSummary(){const day=localDayKey(),target=ensureFocusTarget(day),todayMs=state.focusTimeByDate?.[day]||0,totalMs=Object.values(state.focusTimeByDate||{}).reduce((s,v)=>s+(Number(v)||0),0),days=weekDays(),weekMs=days.reduce((s,d)=>s+(state.focusTimeByDate?.[d.key]||0),0);return {day,target,todayMs,totalMs,days,weekMs};}
function focusStatus(todayMin,t){if(todayMin>=t.stretch)return "STRETCH COMPLETE";if(todayMin>=t.recommended)return "RECOMMENDED COMPLETE";if(todayMin>=t.minimum)return `${Math.ceil(t.recommended-todayMin)}m to recommended`;return `${Math.ceil(t.minimum-todayMin)}m to minimum`;}

function metricMastery(m){return .45*m.k+.35*m.a+.20*m.t;}
function recentRows(n=75){return state.history.slice(-n);}
function recentWrong(cat,n=20){
  const r=state.history.filter(x=>x.cat===cat).slice(-n);
  return r.length?r.filter(x=>!x.correct).length/r.length:0;
}
function recentFastWrong(cat,n=50){return state.history.slice(-n).filter(x=>x.cat===cat&&x.type==="fast-wrong").length;}
function elapsedDays(ts){return Number.isFinite(ts)&&ts>0?Math.max(0,(Date.now()-ts)/86400000):0;}
function skillTimeDue(m){
  if(!m||!m.attempts||!m.lastTs)return {due:false,overdue:0,elapsed:0};
  const elapsed=elapsedDays(m.lastTs),target=Math.max(.5,m.intervalDays||1);
  return {due:elapsed>=target,overdue:Math.max(0,elapsed-target),elapsed};
}
function catPriority(cat){
  const m=state.metrics[cat],weak=(1-m.k)*.42+(1-m.a)*.33+(1-m.t)*.25;
  const sessionDue=(state.level-m.lastLevel)>=m.interval,timeDue=skillTimeDue(m);
  const due=(sessionDue||timeDue.due)?.09:0;
  const sessionOver=Math.max(0,(state.level-m.lastLevel)-m.interval),timeOver=timeDue.overdue;
  const overdue=Math.min(.14,sessionOver*.012+timeOver*.035);
  const errors=recentWrong(cat)*.13,misconception=Math.min(.10,recentFastWrong(cat)*.025);
  return weak+due+overdue+errors+misconception;
}
function overallStats(){
  const metrics=Object.values(state.metrics),history=recentRows(75);
  const coverage=activeSeenCount()/CAMPAIGN.questions.length;
  const mastery=mean(metrics.map(metricMastery));
  const minSkill=Math.min(...metrics.map(metricMastery));
  const allTimeAttempts=Number(state.totalAttempts)||0;
  const allTimeCorrect=Number(state.totalCorrect)||0;
  const allTimeAccuracy=allTimeAttempts?allTimeCorrect/allTimeAttempts:0;
  const accuracy=history.length?history.filter(r=>r.correct).length/history.length:0;
  const auto=history.length?history.filter(r=>r.type==="automatic").length/history.length:0;
  const avgMs=history.length?Math.round(mean(history.map(r=>r.ms))):0;
  const speed=history.length?mean(history.map(r=>r.correct?r.speedScore:0)):0;
  const transfer=mean(metrics.map(m=>m.t));
  const fluency=history.length?clamp(.50*accuracy+.30*speed+.20*transfer):0;
  const rating=history.length?clamp(.35*accuracy+.25*speed+.20*transfer+.20*mastery):0;
  const mastered=metrics.filter(m=>metricMastery(m)>=.80&&m.a>=.65&&m.attempts>=8).length;
  const keysUnlocked=Math.min(25,Array.isArray(state.keyring)?state.keyring.length:0);
  const base={coverage,mastery,minSkill,accuracy,allTimeAccuracy,allTimeCorrect,allTimeAttempts,auto,avgMs,speed,transfer,fluency,rating,mastered,keysUnlocked};
  const graduation=graduationEvidence(base);
  return {...base,eligible:graduation.eligible,graduation};
}
function graduationEvidence(st){
  const now=Date.now(),day=86400000,hist=state.history||[],training=hist.filter(r=>r.sessionMode!=="final"),reviews=training.filter(r=>r.review).slice(-300);
  const retentionAccuracy=reviews.length?reviews.filter(r=>r.correct).length/reviews.length:0;
  const firstTs=hist.find(r=>Number.isFinite(r.ts))?.ts||state.createdAt||now,spanDays=Math.max(0,(now-firstTs)/day);
  const recentSessions=(state.sessionHistory||[]).filter(x=>x.mode==="training").slice(-8),stableAccuracy=recentSessions.length?mean(recentSessions.map(x=>Number(x.accuracy)||0)):0,stableTimeMs=recentSessions.length?mean(recentSessions.map(x=>Number(x.avgMs)||0)):0;
  const fluencyPass=st.auto>=.04||(st.accuracy>=.80&&st.avgMs>0&&st.avgMs<=5500);
  const gates={coverage:st.coverage>=.999,mastery:st.mastery>=.85,minSkill:st.minSkill>=.70,keys:st.keysUnlocked>=25,calendar:spanDays>=14,retentionEvidence:reviews.length>=150,retention:retentionAccuracy>=.72,stabilityEvidence:recentSessions.length>=8,stability:stableAccuracy>=.68,fluency:fluencyPass};
  return {eligible:Object.values(gates).every(Boolean),gates,reviewCount:reviews.length,retentionAccuracy,spanDays,recentSessions:recentSessions.length,stableAccuracy,stableTimeMs};
}
function phraseExposureStats(){const rows=activeSeenRows(),unique=rows.length,repeatedUnique=rows.filter(x=>(x?.count||1)>1).length,repeatAttempts=rows.reduce((n,x)=>n+Math.max(0,(x?.count||1)-1),0);return {unique,repeatedUnique,repeatAttempts};}
function campaign2Readiness(){
  const st=overallStats(),metrics=Object.values(state.metrics),learning=learningScoreStats(),g=st.graduation;
  const breadth=metrics.filter(m=>metricMastery(m)>=.55).length/metrics.length,strong=metrics.filter(m=>metricMastery(m)>=.70).length/metrics.length,weak=metrics.filter(m=>metricMastery(m)<.40).length;
  const evidence=clamp((state.totalAttempts||0)/4500),curve=clamp((learning.current??st.mastery*100)/100),minSkillScore=clamp(st.minSkill/.70),retentionScore=g.reviewCount?clamp(g.retentionAccuracy/.72):0,stabilityScore=g.recentSessions?clamp(g.stableAccuracy/.75):0,autoScore=clamp(st.auto/.12),calendarScore=clamp(g.spanDays/14);
  const score=clamp(.15*st.coverage+.19*st.mastery+.09*breadth+.07*strong+.10*minSkillScore+.14*retentionScore+.08*stabilityScore+.05*autoScore+.05*calendarScore+.03*evidence+.05*curve);
  const ready=g.eligible&&score>=.82;
  const stage=ready?"Campaign 2 gate achieved":score>=.72?"Late consolidation":score>=.55?"Building graduation evidence":"Building foundation";
  const blockers=[];
  if(!g.gates.coverage)blockers.push(`${Math.max(0,Math.ceil(CAMPAIGN.questions.length*.999)-activeSeenCount()).toLocaleString()} more unique questions`);
  if(!g.gates.mastery)blockers.push(`mastery ${pct(st.mastery)}% → 85%`);
  if(!g.gates.minSkill)blockers.push(`weakest Key ${pct(st.minSkill)}% → 70%`);
  if(!g.gates.calendar)blockers.push(`${Math.max(0,Math.ceil(14-g.spanDays))} more calendar days of longitudinal evidence`);
  if(!g.gates.retentionEvidence)blockers.push(`${Math.max(0,150-g.reviewCount)} more spaced-review answers`);
  else if(!g.gates.retention)blockers.push(`review retention ${pct(g.retentionAccuracy)}% → 72%`);
  if(!g.gates.stability)blockers.push(`8-level stability ${pct(g.stableAccuracy)}% → 68%`);
  if(!g.gates.fluency)blockers.push(`fluency gate: automatic ≥4% OR recent accuracy ≥80% with ≤5.5s average`);
  if(!g.gates.keys)blockers.push(`${25-st.keysUnlocked} more base Keys to unlock`);
  return {score,ready,stage,breadth,strong,weak,evidence,curve,blockers,graduation:g,retentionScore,stabilityScore,autoScore};
}
function campaign2Brief(){
  const r=campaign2Readiness(),st=overallStats();
  return `Adaptive B2 Cloze recommends preparing Campaign 2. I will attach/export my Campaign 1 progress JSON. Use that export as the primary diagnostic. Build Campaign 2 as a separate 3,000-question bank that preserves Campaign 1 and the existing app architecture. Prioritize genuinely new C1 material plus targeted transfer for my remaining weak patterns; avoid duplicate questions and retain 15 questions per level, 15-second timing, adaptive selection, dynamic names, micro-lessons, AI Valoration and the long-term Learning Curve. Current handoff: readiness ${pct(r.score)}%, coverage ${pct(st.coverage)}%, mastery ${pct(st.mastery)}%, weakest Key ${pct(st.minSkill)}%, review retention ${pct(r.graduation.retentionAccuracy)}% across ${r.graduation.reviewCount} recent review answers, automatic ${pct(st.auto)}%, 8-level stability ${pct(r.graduation.stableAccuracy)}%, real evidence span ${r.graduation.spanDays.toFixed(1)} days, Key Journey ${st.keysUnlocked}/25. Campaign 2 must remain locked until every graduation gate and the final challenge are passed. First analyze my export and propose the Campaign 2 skill map before generating the new 3,000 questions.`;
}
function stageInfo(coverage){
  const seen=activeSeenCount();
  const index=Math.min(5,Math.floor(Math.min(2999,seen)/500));
  return {index,name:stageNames[index],from:index*500,to:(index+1)*500,seen};
}

function outcomeType(ok,sec,target,timeout){
  if(timeout)return "timeout";
  const auto=Math.min(3.0,target*.85);
  const secure=Math.min(6.0,target*1.35);
  const fastWrong=Math.min(3.2,target*.9);
  if(ok&&sec<=auto)return "automatic";
  if(ok&&sec<=secure)return "secure";
  if(ok)return "slow-correct";
  if(sec<=fastWrong)return "fast-wrong";
  return "slow-wrong";
}
function updateMetric(q,ok,sec,type){
  const m=state.metrics[q.cat],target=q.targetTime||3.6;
  const speed=ok?clamp(target/Math.max(.8,sec),0,1):0;
  const newDomain=!m.domains[q.domain];
  const oldTemplate=state.templateLast[q.templateId]!=null;
  m.k=clamp(m.k*.86+(ok?1:0)*.14,.03,.99);
  m.a=clamp(m.a*.89+speed*.11,.03,.99);
  m.t=clamp(m.t*.90+(ok?(newDomain?1:(oldTemplate?.78:.9)):0)*.10,.03,.99);
  if(type==="fast-wrong"){m.k=clamp(m.k-.035,.03,.99);m.a=clamp(m.a-.05,.03,.99);}
  m.attempts++;if(ok)m.correct++;if(type==="automatic")m.automatic++;if(!ok)m.lapses++;
  m.streak=ok?m.streak+1:0;m.lastMs=Math.round(sec*1000);m.lastLevel=state.level;
  m.domains[q.domain]=(m.domains[q.domain]||0)+1;
  const sameDay=m.lastTs&&elapsedDays(m.lastTs)<.5,dayFactor=sameDay?1:1.0;
  if(type==="automatic"){m.interval=Math.min(40,Math.max(2,Math.round(m.interval*2.2+1)));m.intervalDays=sameDay?Math.max(1,m.intervalDays||1):Math.min(30,Math.max(2,Math.round((m.intervalDays||1)*2.2)));}
  else if(type==="secure"){m.interval=Math.min(28,Math.max(2,Math.round(m.interval*1.7+1)));m.intervalDays=sameDay?Math.max(1,m.intervalDays||1):Math.min(21,Math.max(1,Math.round((m.intervalDays||1)*1.7)));}
  else if(type==="slow-correct"){m.interval=Math.min(12,Math.max(1,Math.round(m.interval*1.25)));m.intervalDays=sameDay?Math.max(1,m.intervalDays||1):Math.min(10,Math.max(1,Math.round((m.intervalDays||1)*1.25)));}
  else {m.interval=1;m.intervalDays=1;}
  m.lastTs=Date.now();
  return speed;
}
function reviewIntervalDays(info,type){
  const prev=Math.max(1,info?.intervalDays||1),sameDay=info?.lastTs&&elapsedDays(info.lastTs)<.5;
  if(type==="timeout"||type==="fast-wrong"||type==="slow-wrong")return 1;
  if(sameDay)return prev;
  if(type==="automatic")return Math.min(30,Math.max(3,Math.round(prev*2.2)));
  if(type==="secure")return Math.min(21,Math.max(2,Math.round(prev*1.7)));
  return Math.min(10,Math.max(1,Math.round(prev*1.25)));
}
function seenInfo(q){const x=state.seen[q.fingerprint]||null;return x?.retired?null:x;}
function activeSeenRows(){const active=new Set(CAMPAIGN.questions.map(q=>q.fingerprint));return Object.entries(state.seen||{}).filter(([fp,v])=>active.has(fp)&&!v?.retired).map(([,v])=>v);}
function activeSeenCount(){return activeSeenRows().length;}
const DISPLAY_NAMES={
  Marta:{kind:"f",pool:["Ana","Eva","Mia","Zoe","Lea","Sara","Emma","Nora","Lisa","Luna","Amy","Ava","Ivy","May","Lia","Noa","Iris","Elsa","Alma","Lucy"]},
  Nina:{kind:"f",pool:["Ana","Eva","Mia","Zoe","Lea","Sara","Emma","Nora","Lisa","Luna","Amy","Ava","Ivy","May","Lia","Noa","Iris","Elsa","Alma","Lucy"]},
  Clara:{kind:"f",pool:["Ana","Eva","Mia","Zoe","Lea","Sara","Emma","Nora","Lisa","Luna","Amy","Ava","Ivy","May","Lia","Noa","Iris","Elsa","Alma","Lucy"]},
  Daniel:{kind:"m",pool:["Tom","Ben","Max","Ian","Dan","Eli","Hugo","Luca","Noah","Adam","Eric","Joel","Marc","Luke","Jack","Liam","Owen","Ryan","Paul","Nico"]},
  Leo:{kind:"m",pool:["Tom","Ben","Max","Ian","Dan","Eli","Hugo","Luca","Noah","Adam","Eric","Joel","Marc","Luke","Jack","Liam","Owen","Ryan","Paul","Nico"]},
  Alex:{kind:"n",pool:["Sam","Kim","Lee","Ari","Ash","Sky","Robin","Jules","Casey","Jamie","Remy","Riley"]}
};
function stableHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function visibleCard(q){
  const occurrence=(seenInfo(q)?.count||0)+1,all=[q.q,...(q.display||[])].join(" "),map={};
  for(const [original,def] of Object.entries(DISPLAY_NAMES))if(new RegExp(`\\b${original}\\b`).test(all)){
    const base=stableHash(`${q.fingerprint}|${original}`)%def.pool.length,used=session?.usedDisplayNames;let name=def.pool[(base+occurrence-1)%def.pool.length];
    if(used){for(let step=0;step<def.pool.length&&used.has(name);step++)name=def.pool[(base+occurrence+step)%def.pool.length];used.add(name);}
    map[original]=name;
  }
  const swap=text=>Object.entries(map).reduce((s,[from,to])=>s.replace(new RegExp(`\\b${from}\\b`,"g"),to),String(text));
  return {question:swap(q.q),options:(q.display||[]).map(swap),focus:(q.focus||[]).map(swap),names:map,occurrence};
}

function focusMarkup(text,answer,fragments=[]){
  text=String(text);const ranges=[];
  for(const frag of [...new Set(fragments.filter(Boolean))].sort((a,b)=>b.length-a.length)){
    const start=text.indexOf(frag);if(start>=0)ranges.push({start,end:start+frag.length,kind:"cue",text:frag});
  }
  const gap=text.indexOf("___");if(gap>=0)ranges.push({start:gap,end:gap+3,kind:"answer",text:String(answer)});
  ranges.sort((a,b)=>a.start-b.start||(a.kind==="answer"?-1:1));let cursor=0,html="";
  for(const r of ranges){if(r.start<cursor)continue;html+=escapeHtml(text.slice(cursor,r.start));html+=`<span class="grammar-${r.kind}">${escapeHtml(r.text)}</span>`;cursor=r.end;}
  return html+escapeHtml(text.slice(cursor));
}
function flashGrammarFocus(text,answer,fragments){
  const el=$("questionText");if(!el)return;el.innerHTML=focusMarkup(text,answer,fragments);el.classList.remove("focus-active");void el.offsetWidth;el.classList.add("focus-active");
}
function hideCorrectReveal(){const el=$("correctReveal");if(!el)return;el.className="correct-reveal";el.innerHTML="";}
function showCorrectReveal(answer,pos){
  const el=$("correctReveal");if(!el)return;const letter=String.fromCharCode(65+Math.max(0,Math.min(3,pos||0)));
  el.className=`correct-reveal show pos-${Math.max(0,Math.min(3,pos||0))+1}`;
  el.innerHTML=`<span class="correct-reveal-kicker"><i></i>CORRECT ANSWER · ${letter}</span><strong>${escapeHtml(answer)}</strong>`;
}

function qScore(q,sessionCats,sessionTemplates,mode){
  const info=seenInfo(q),isNew=!info,m=state.metrics[q.cat];
  let s=Math.random()*.10;
  if(mode==="focus")s+=catPriority(q.cat)*1.65;
  if(mode==="explore"){
    // Prefer skills with little evidence and those not sampled recently.
    s+=Math.max(0,.85-Math.min(.85,m.attempts/18));
    s+=Math.min(.55,Math.max(0,state.level-m.lastLevel)*.035);
  }
  if(mode==="review"){
    const overdue=Math.max(0,(state.level-m.lastLevel)-m.interval);
    s+=.45+Math.min(.75,overdue*.08)+catPriority(q.cat)*.55;
  }
  if(mode==="wild")s+=.28+Math.max(0,.45-m.attempts/40);
  if(isNew)s+=mode==="review"?.06:.62; else if(mode==="review")s+=.32;
  if(info){
    const ago=state.level-info.lastLevel,days=elapsedDays(info.lastTs),dueTs=info.nextDueTs||((info.lastTs||0)+(info.intervalDays||1)*86400000),timeDue=info.lastTs&&Date.now()>=dueTs;
    if(!timeDue){if(ago<4)s-=3.0;else if(ago<9)s-=1.15;else if(ago<16)s-=.35;if(days<.5)s-=1.35;else if(days<1)s-=.55;}
    else{s+=.55+Math.min(.85,Math.max(0,(Date.now()-dueTs)/86400000)*.12);}
    s-=Math.min(.65,Math.log1p(info.count)*.18);
    if(info.lastCorrect===false&&(ago>=4||timeDue))s+=Math.min(.85,.38+(info.lapses||1)*.12);
  }
  const ta=state.templateLast[q.templateId];
  if(ta!=null){
    const ago=state.level-ta;
    if(ago<6)s-=3.2;else if(ago<12)s-=1.2;else if(ago<18)s-=.35;
  }
  const cc=sessionCats[q.cat]||0,tc=sessionTemplates[q.templateId]||0;
  if(cc>=2)s-=20; else if(cc===1)s-=.20;
  if(tc>=1)s-=12;
  if(!m.domains[q.domain])s+=.20;
  return s;
}
function chooseOne(pool,chosen,sessionCats,sessionTemplates,mode,allowedCats=null){
  const chosenFp=new Set(chosen.map(q=>q.fingerprint));
  let cand=pool.filter(q=>!chosenFp.has(q.fingerprint));
  if(allowedCats) cand=cand.filter(q=>allowedCats.has(q.cat));
  if(state.sessions<40){const short=cand.filter(q=>q.q.trim().split(/\s+/).length<=14);if(short.length)cand=short;}
  if(mode!=="review"){const unseenTemplates=cand.filter(q=>!state.templateSeen[q.templateId]);if(unseenTemplates.length)cand=unseenTemplates;}
  cand=cand.filter(q=>(sessionCats[q.cat]||0)<2 && (sessionTemplates[q.templateId]||0)<1);
  if(!cand.length)return null;
  cand.sort((a,b)=>qScore(b,sessionCats,sessionTemplates,mode)-qScore(a,sessionCats,sessionTemplates,mode));
  return cand[Math.floor(Math.random()*Math.min(5,cand.length))];
}
function buildTrainingPlan(){
  const chosen=[],cats={},temps={};
  const addQ=q=>{if(!q)return false;chosen.push(q);cats[q.cat]=(cats[q.cat]||0)+1;temps[q.templateId]=(temps[q.templateId]||0)+1;return true;};
  const newPool=BANK.filter(q=>!seenInfo(q)),reviewPool=BANK.filter(q=>!!seenInfo(q));
  const skills=CAMPAIGN.skills.map(s=>({id:s.id,m:state.metrics[s.id],priority:catPriority(s.id)}));

  // Deliberate interleaving: a weak pattern can never swallow the session.
  // Early sessions are deliberately broad diagnostics; later sessions consolidate more deeply.
  const surveyMode=state.sessions<8;
  const focusGoal=surveyMode?4:6, exploreGoal=surveyMode?7:4, reviewGoal=surveyMode?3:4;
  const focusCats=skills.slice().sort((a,b)=>b.priority-a.priority).slice(0,surveyMode?4:3).map(x=>x.id);
  let focusSlots=focusGoal;
  for(let round=0;round<2&&focusSlots>0;round++){
    for(const cat of focusCats){
      if(focusSlots<=0)break;
      const q=chooseOne(newPool.length?newPool:BANK,chosen,cats,temps,"focus",new Set([cat])) || chooseOne(BANK,chosen,cats,temps,"focus",new Set([cat]));
      if(addQ(q))focusSlots--;
    }
  }

  const exploreCats=skills.slice().sort((a,b)=>{
    const evidence=(a.m.attempts-b.m.attempts);
    if(evidence)return evidence;
    return a.m.lastLevel-b.m.lastLevel;
  }).map(x=>x.id);
  let exploreSlots=exploreGoal;
  for(const cat of exploreCats){
    if(exploreSlots<=0)break;
    if((cats[cat]||0)>0)continue;
    const q=chooseOne(newPool,chosen,cats,temps,"explore",new Set([cat]));
    if(addQ(q))exploreSlots--;
  }

  const dueCats=skills.filter(x=>x.m.attempts>0&&((state.level-x.m.lastLevel)>=x.m.interval||skillTimeDue(x.m).due))
    .sort((a,b)=>{const bt=skillTimeDue(b.m),at=skillTimeDue(a.m);return (bt.overdue-at.overdue)||(((state.level-b.m.lastLevel)-b.m.interval)-((state.level-a.m.lastLevel)-a.m.interval));})
    .map(x=>x.id);
  let reviewSlots=reviewGoal;
  for(const cat of dueCats){
    if(reviewSlots<=0)break;
    const q=chooseOne(reviewPool,chosen,cats,temps,"review",new Set([cat]));
    if(addQ(q))reviewSlots--;
  }
  while(reviewSlots>0){
    const q=chooseOne(reviewPool,chosen,cats,temps,"review");
    if(!q)break;addQ(q);reviewSlots--;
  }

  const wild=chooseOne(newPool.length?newPool:BANK,chosen,cats,temps,"wild");
  addQ(wild);

  while(chosen.length<SESSION_SIZE){
    const q=chooseOne(BANK,chosen,cats,temps,"explore");
    if(!q)break;addQ(q);
  }

  // Shuffle, then repair adjacent same-skill pairs when possible.
  for(let i=chosen.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}
  for(let k=0;k<80;k++){
    let bad=-1;
    for(let i=1;i<chosen.length;i++)if(chosen[i].cat===chosen[i-1].cat){bad=i;break;}
    if(bad<0)break;
    const j=[...Array(chosen.length).keys()].find(x=>Math.abs(x-bad)>1&&chosen[x].cat!==chosen[bad].cat&&(x===0||chosen[x-1].cat!==chosen[bad].cat));
    if(j!=null)[chosen[bad],chosen[j]]=[chosen[j],chosen[bad]];else break;
  }
  return chosen.slice(0,SESSION_SIZE);
}
function buildFinalPlan(){
  const ranked=[...CAMPAIGN.skills].sort((a,b)=>catPriority(b.id)-catPriority(a.id)),result=[];
  for(const s of ranked){
    const pool=BANK.filter(q=>q.cat===s.id).sort((a,b)=>(seenInfo(a)?.lastLevel||-999)-(seenInfo(b)?.lastLevel||-999));
    if(pool[0])result.push(pool[0]);
  }
  while(result.length<30){const q=chooseOne(BANK,result,{},{},"review");if(!q)break;result.push(q);}
  return result.slice(0,30);
}
function shuffleOptions(q){
  const items=q.a.map((x,i)=>({x,ok:i===q.c})),correct=items.find(x=>x.ok),wrong=items.filter(x=>!x.ok);
  for(let i=wrong.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[wrong[i],wrong[j]]=[wrong[j],wrong[i]];}
  const seenCount=seenInfo(q)?.count||0,cycle=[0,3,1,2],start=stableHash(q.fingerprint)%4,targetPos=cycle[(start+seenCount)%4],arr=[];
  let wi=0;for(let i=0;i<4;i++)arr.push(i===targetPos?correct:wrong[wi++]);
  return {...q,display:arr.map(x=>x.x),correctPos:targetPos};
}
function currentStageText(){const s=stageInfo(overallStats().coverage);return `Stage ${s.index+1}/6 · ${s.name}`;}
function deltaText(value,goodUp=true,suffix=""){
  if(value==null||Number.isNaN(value))return '<span class="delta neutral">—</span>';
  const good=goodUp?value>0:value<0,bad=goodUp?value<0:value>0,arrow=value>0?"↑":value<0?"↓":"→",color=semanticDeltaColor(value,goodUp);
  return `<span class="delta ${good?"good":bad?"bad":"neutral"}" style="color:${color}">${arrow} ${Math.abs(value).toFixed(1)}${suffix}</span>`;
}
function sparkline(values,format=v=>String(Math.round(v)),lowerBetter=false,refLine=null,refLabel="Avg"){
  values=Array.isArray(values)?values.filter(Number.isFinite):[];
  if(values.length<2)return '<div class="footerline">Complete a few levels to build this graph.</div>';
  const w=600,h=108,p=10,min=Math.min(...values),max=Math.max(...values),span=Math.max(.01,max-min);
  const xy=values.map((v,i)=>({v,x:p+i*(w-2*p)/(values.length-1),y:h-p-(v-min)/span*(h-2*p)}));
  const current=values[values.length-1],best=lowerBetter?min:max;
  const shadow=`<polyline points="${xy.map(q=>`${q.x},${q.y}`).join(" ")}" fill="none" stroke="#050806" stroke-opacity=".72" stroke-width="6" vector-effect="non-scaling-stroke"/>`;
  const segments=xy.slice(1).map((q,i)=>`<line x1="${xy[i].x}" y1="${xy[i].y}" x2="${q.x}" y2="${q.y}" stroke="${valueColor(q.v/100)}" stroke-width="3.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join("");
  const dots=xy.map(q=>`<circle cx="${q.x}" cy="${q.y}" r="2.3" fill="${valueColor(q.v/100)}" stroke="${valueTextColor(q.v/100)}" stroke-width="1.1" vector-effect="non-scaling-stroke"/>`).join("");
  const meanSvg=Number.isFinite(refLine)?`<line x1="${p}" y1="${h-p-(refLine-min)/span*(h-2*p)}" x2="${w-p}" y2="${h-p-(refLine-min)/span*(h-2*p)}" stroke="${valueColor(refLine/100)}" stroke-opacity=".90" stroke-width="2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>`:"";
  const meanMeta=Number.isFinite(refLine)?`<span style="color:${valueTextColor(refLine/100)}">${refLabel} ${format(refLine)}</span>`:`<span>${values.length} levels</span>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="${h-p}" x2="${w}" y2="${h-p}" stroke="rgba(255,255,255,.12)"/><line x1="0" y1="${p}" x2="${w}" y2="${p}" stroke="rgba(255,255,255,.07)"/>${meanSvg}${shadow}${segments}${dots}</svg><div class="chartmeta"><span style="color:${valueTextColor(current/100)}">Now ${format(current)}</span><span style="color:${valueTextColor(best/100)}">Best ${format(best)}</span>${meanMeta}</div>`;
}
function sessionScoreChart(rows,expanded=false){
  rows=(rows||[]).filter(x=>x.mode==="training"&&Number.isFinite(x.correct)&&Number.isFinite(x.ts));
  if(rows.length<2)return '<div class="footerline">Complete a few levels to build this graph.</div>';
  const colors=GRAPH_BANDS_15,mobile=!expanded&&window.innerWidth<=620;
  const w=mobile?360:(expanded?920:720),h=mobile?320:(expanded?520:310),L=mobile?40:58,R=mobile?12:22,T=mobile?24:28,B=mobile?42:44,maxY=15;
  const first=rows[0].ts,last=rows[rows.length-1].ts,span=Math.max(1,last-first);
  const xFor=(ts,i)=>rows.length===1?L+(w-L-R)/2:L+((last===first?i/(rows.length-1):(ts-first)/span)*(w-L-R));
  const yFor=c=>T+((maxY-c)/maxY)*(h-T-B),correct=r=>Math.max(0,Math.min(15,r.correct));
  const actualXY=rows.map((r,i)=>({r,i,x:xFor(r.ts,i),y:yFor(correct(r)),v:correct(r)}));
  const bands=colors.map((c,i)=>`<rect x="${L}" y="${yFor(i+1)}" width="${w-L-R}" height="${Math.max(1,yFor(i)-yFor(i+1))}" fill="${c}" fill-opacity=".82"/>`).join('');
  const grid=[...Array(16).keys()].map(v=>`<line x1="${L}" y1="${yFor(v)}" x2="${w-R}" y2="${yFor(v)}" stroke="rgba(255,255,255,${v===0||v===15?'.38':'.14'})"/><text x="${L-9}" y="${yFor(v)+3.5}" text-anchor="end" fill="${v===0?'#b7c9bf':scoreTextColor(v)}" font-size="${expanded?12:(mobile?9:10)}" font-weight="850">${v}</text>`).join('');
  const shortSpan=(last-first)<=36*3600000,maxLabels=expanded?9:(mobile?5:6);let labels='';
  if(shortSpan){const count=Math.min(maxLabels,rows.length),idx=[...new Set(Array.from({length:count},(_,k)=>Math.round(k*(rows.length-1)/(count-1))))];labels=idx.map(i=>{const r=rows[i],d=new Date(r.ts),lab=d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});return `<text x="${xFor(r.ts,i)}" y="${h-13}" text-anchor="middle" fill="#c7d8ce" font-size="${mobile?10:12}" font-weight="800">${lab}</text>`;}).join('');}
  else{const dayMap=new Map();for(const r of rows){const d=new Date(r.ts),key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;if(!dayMap.has(key))dayMap.set(key,{ts:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),label:d.toLocaleDateString('es-ES',{day:'numeric',month:'short'})});}const days=[...dayMap.values()],step=Math.max(1,Math.ceil(days.length/maxLabels));labels=days.filter((_,i)=>i%step===0||i===days.length-1).map(d=>`<text x="${xFor(d.ts,0)}" y="${h-13}" text-anchor="middle" fill="#c7d8ce" font-size="${mobile?10:12}" font-weight="800">${d.label}</text>`).join('');}
  const lineShadow=`<polyline points="${actualXY.map(q=>`${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#050806" stroke-opacity=".78" stroke-width="${expanded?7:6}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const actualSegments=actualXY.slice(1).map((q,i)=>`<line x1="${actualXY[i].x.toFixed(1)}" y1="${actualXY[i].y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${scoreColor(q.v)}" stroke-width="${expanded?3.8:3.2}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('');
  const dots=actualXY.map(q=>{const d=new Date(q.r.ts),stamp=d.toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),targetTxt=Number.isFinite(q.r.target)?` · target ${q.r.target.toFixed(1)}`:"";return `<circle cx="${q.x}" cy="${q.y}" r="${expanded?4.1:3}" fill="${scoreColor(q.v)}" stroke="${scoreTextColor(q.v)}" stroke-width="1.6"><title>Nivel ${q.r.level}: ${q.v}/15 correctas${targetTxt} · ${stamp}</title></circle>`;}).join('');
  const targetRows=rows.map((r,i)=>({r,i,x:xFor(r.ts,i),y:yFor(Math.max(0,Math.min(15,r.target))),v:Math.max(0,Math.min(15,r.target))})).filter(x=>Number.isFinite(x.r.target));
  const targetSegments=targetRows.slice(1).map((q,i)=>`<line x1="${targetRows[i].x.toFixed(1)}" y1="${targetRows[i].y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${scoreColor(q.v)}" stroke-width="${expanded?2.5:2.1}" stroke-dasharray="6 5" stroke-linecap="round" opacity=".96" vector-effect="non-scaling-stroke"/>`).join('');
  const targetDots=targetRows.map(q=>`<circle cx="${q.x}" cy="${q.y}" r="${expanded?3.5:2.6}" fill="#101815" stroke="${scoreTextColor(q.v)}" stroke-width="2"><title>Nivel ${q.r.level}: target ${q.v.toFixed(1)}</title></circle>`).join('');
  return `<svg class="score-chart ${expanded?'expanded':''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"><rect x="${L}" y="${T}" width="${w-L-R}" height="${h-T-B}" rx="8" fill="#101815"/>${bands}${grid}${targetSegments}${targetDots}${lineShadow}${actualSegments}${dots}${labels}<text x="${L}" y="15" fill="#dfece5" font-size="${mobile?9:11}" font-weight="900">SOLID = SCORE · DASHED = TARGET · COLOR = AVS RANK</text></svg>`;
}
function learningCurveBase(x){
  const mastery=x.mastery??0,coverage=x.coverage??0,automatic=x.automatic??0;
  return clamp(.65*mastery+.25*coverage+.10*automatic);
}
function learningCurveSeries(alpha=.15){
  const raw=state.sessionHistory.filter(x=>x.mode==="training").map(x=>learningCurveBase(x)*100);
  let ema=null;return raw.map(v=>{ema=ema==null?v:alpha*v+(1-alpha)*ema;return ema;});
}
function learningScoreStats(values=learningCurveSeries(),windowSize=8){
  if(!values.length)return {current:null,previous:null,delta:null,windowSize:0,start:null,gain:null};
  const current=values[values.length-1],start=values[0],n=Math.min(windowSize,Math.max(1,Math.floor(values.length/2)));
  if(values.length<2)return {current,previous:null,delta:null,windowSize:1,start,gain:0};
  const recent=mean(values.slice(-n)),previous=mean(values.slice(-2*n,-n));
  return {current,previous,delta:recent-previous,windowSize:n,start,gain:current-start};
}
function colorRgb(hex){const n=parseInt(hex.slice(1),16);return `${(n>>16)&255},${(n>>8)&255},${n&255}`;}
function mixHex(hex,target="#ffffff",amount=.34){const a=parseInt(hex.slice(1),16),b=parseInt(target.slice(1),16),ch=(n,s)=>Math.round(((a>>s)&255)*(1-n)+((b>>s)&255)*n);return `#${[ch(amount,16),ch(amount,8),ch(amount,0)].map(x=>x.toString(16).padStart(2,"0")).join("")}`;}
const AI_LEVELS=COLOR_BANDS_15.map((color,i)=>({level:i+1,color,rgb:colorRgb(color)}));
function aiValorationStats(){
  const st=overallStats(),learning=learningScoreStats();
  const learningBase=(learning.current??(st.rating*100))/100;
  const performance=clamp(.40*learningBase+.25*st.mastery+.15*st.accuracy+.10*st.auto+.10*st.coverage);
  const attemptEvidence=Math.sqrt(Math.min(1,(state.totalAttempts||0)/1500)),coverageEvidence=Math.sqrt(Math.min(1,st.coverage));
  const confidence=clamp(.35+.65*(.55*attemptEvidence+.45*coverageEvidence));
  const adjusted=clamp(.5+(performance-.5)*confidence),score=adjusted*100;
  return {level:valueLevel(score/100),score,confidence,performance:performance*100};
}
function applyAiTheme(ai=aiValorationStats()){
  const def=AI_LEVELS[ai.level-1]||AI_LEVELS[0],rank=AVS_RANKS[ai.level-1]||AVS_RANKS[0],surface=rank.surface||def.color;document.body.dataset.aiLevel=String(ai.level);
  document.documentElement.style.setProperty("--ai-color",def.color);document.documentElement.style.setProperty("--ai-rgb",def.rgb);document.documentElement.style.setProperty("--ambient-rank-color",def.color);document.documentElement.style.setProperty("--ambient-rank-rgb",def.rgb);document.documentElement.style.setProperty("--ambient-rank-surface",surface);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',surface);return ai;
}
function applyCoverRankTheme(ai=aiValorationStats()){const i=Math.max(0,Math.min(14,(ai.level||1)-1)),c=COLOR_BANDS_15[i]||COLOR_BANDS_15[0],surface=SURFACE_BANDS_15[i]||c,el=$("startScreen");if(el){el.style.setProperty("--cover-rank-color",c);el.style.setProperty("--cover-rank-surface",surface);el.dataset.avsRank=String(ai.level||1);}return c;}
function aiLegendHtml(current){return AI_LEVELS.map(x=>`<div class="ai-legend-item ${x.level===current?"current":""}"><i style="--swatch:${x.color}"></i><b>${x.level}</b></div>`).join("");}
const AI_TEXT_COLORS=AVS_TEXT_BANDS_15;
function valueLevel(v){return Math.max(1,Math.min(15,Math.ceil(clamp(Number(v)||0)*15)));}
function valueColor(v){return AI_LEVELS[valueLevel(v)-1].color;}
function valueTextColor(v){return AI_TEXT_COLORS[valueLevel(v)-1];}
function paintText(id,v){const el=$(id);if(el)el.style.color=valueTextColor(v);}
function paintFill(id,v){const el=$(id);if(el)el.style.background=valueColor(v);}
function scoreValue(score,max=15){return clamp((Number(score)||0)/Math.max(1,Number(max)||15));}
function scoreColor(score,max=15){return valueColor(scoreValue(score,max));}
function scoreTextColor(score,max=15){return valueTextColor(scoreValue(score,max));}
function semanticDeltaColor(value,goodUp=true){const v=Number(value)||0;if(Math.abs(v)<1e-9)return "#b7c9bf";const good=goodUp?v>0:v<0;return good?AI_TEXT_COLORS[9]:AI_TEXT_COLORS[3];}
function paintScore(id,score,max=15){const el=$(id);if(el)el.style.color=scoreTextColor(score,max);}
function paintDelta(id,value,goodUp=true){const el=$(id);if(el)el.style.color=semanticDeltaColor(value,goodUp);}

function rankedSkills(){
  return CAMPAIGN.skills.map(s=>({...s,name:learningTerminology(s.name),m:state.metrics[s.id],mastery:metricMastery(state.metrics[s.id])})).sort((a,b)=>b.mastery-a.mastery||b.m.attempts-a.m.attempts||a.name.localeCompare(b.name));
}
function skillRankPositions(){const out={};rankedSkills().forEach((x,i)=>out[x.id]=i+1);return out;}
function latestRankMoves(){const s=[...state.sessionHistory].reverse().find(x=>x&&x.rankMoves);return s?.rankMoves||{};}
function leagueEvents(before,after){const out=[];for(const s of CAMPAIGN.skills){const a=before?.[s.id],b=after?.[s.id];if(!a||!b)continue;if(a>3&&b<=3)out.push(`▲ NEW TOP 3 · ${skillLabel(s.id)}`);else if(a>=23&&b<23)out.push(`▲ ESCAPED BOTTOM 3 · ${skillLabel(s.id)}`);}return out;}
function skillLabel(cat){const s=CAMPAIGN.skills.find(x=>x.id===cat);return learningTerminology(s?.name||cat);}
function coachPriority(cat){
  const m=state.metrics[cat],mastery=metricMastery(m),rows=state.history.filter(r=>r.cat===cat).slice(-30);
  const wrongRate=rows.length?rows.filter(r=>!r.correct).length/rows.length:1,autoRate=rows.length?rows.filter(r=>r.type==="automatic").length/rows.length:0;
  return .55*(1-mastery)+.35*wrongRate+.10*(1-autoRate);
}
function coachSkillStats(){
  return CAMPAIGN.skills.map(s=>{const m=state.metrics[s.id],mastery=metricMastery(m),rows=state.history.filter(r=>r.cat===s.id).slice(-30),wrong=rows.filter(r=>!r.correct).length,wrongRate=rows.length?wrong/rows.length:1;return {...s,name:learningTerminology(s.name),m,mastery,rows,wrong,wrongRate,priority:coachPriority(s.id)};}).sort((a,b)=>b.priority-a.priority||a.mastery-b.mastery);
}
function typicalLearnerStats(){
  const actual=learningScoreStats().current,attempts=Math.max(0,state.totalAttempts||0);
  // Campaign-calibrated practice model: diminishing gains, not a population average.
  const typical=70-42*Math.exp(-attempts/4458),spread=5.0;
  const healthyMin=Math.max(0,typical-spread),strongPace=Math.min(100,typical+spread);
  const delta=actual==null?null:actual-typical;
  let band="Building evidence",label="Building evidence";
  if(delta!=null){if(actual>strongPace){band="Above strong pace";label="Clearly ahead";}else if(actual>=typical+2){band="Typical-high";label="Slightly ahead";}else if(actual>=typical-2){band="Typical range";label="On typical pace";}else if(actual>=healthyMin){band="Typical-low";label="Slightly behind typical pace";}else{band="Below healthy reference";label="Review strategy / consolidation";}}
  return {actual,typical,healthyMin,strongPace,delta,band,label,attempts};
}

function coachTrendSummary(){
  const rows=state.sessionHistory.filter(x=>x.mode==="training"),n=Math.min(8,Math.floor(rows.length/2));
  if(!n)return {window:0};
  const recent=rows.slice(-n),prior=rows.slice(-2*n,-n),avg=(a,k)=>mean(a.map(x=>Number(x[k])||0));
  return {window:n,accuracyDelta:(avg(recent,"accuracy")-avg(prior,"accuracy"))*100,timeDeltaMs:avg(recent,"avgMs")-avg(prior,"avgMs"),masteryDelta:(avg(recent,"mastery")-avg(prior,"mastery"))*100,autoDelta:(avg(recent,"automatic")-avg(prior,"automatic"))*100,ratingDelta:(avg(recent,"rating")-avg(prior,"rating"))*100};
}
function coachSkillMovement(limit=5){
  const out=[];for(const s of CAMPAIGN.skills){const rows=state.history.filter(r=>r.cat===s.id).slice(-40);if(rows.length<12)continue;const cut=Math.floor(rows.length/2),a=rows.slice(0,cut),b=rows.slice(cut);const acc=x=>x.length?x.filter(r=>r.correct).length/x.length:0;out.push({skill:s.name,delta:(acc(b)-acc(a))*100,recent:acc(b)*100,n:b.length});}
  return out.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,limit);
}
function coachSnapshot(){
  const st=overallStats(),ai=aiValorationStats(),learning=learningScoreStats(),peer=typicalLearnerStats(),c2=campaign2Readiness(),estimate=campaignPracticeEstimate(),focus=coachSkillStats().slice(0,5),mistakes=commonMistakeGroups(8),trend=coachTrendSummary(),moves=coachSkillMovement(),targetPerf=targetPerformanceStats(),readingLoad=readingLoadStats(),focusTime=focusSummary();
  const firstTs=state.history.find(r=>Number.isFinite(r.ts))?.ts||state.createdAt||Date.now(),studySpanDays=Math.max(0,(Date.now()-firstTs)/86400000),dueQuestionCount=activeSeenRows().filter(x=>x?.lastTs&&Date.now()>=(x.nextDueTs||x.lastTs+(x.intervalDays||1)*86400000)).length;
  return {appVersion:APP_VERSION,campaign:CAMPAIGN.campaignId||CAMPAIGN.id||"AE-C1",level:state.level,sessions:state.sessions,totalAnswers:state.totalAttempts,uniqueSeen:activeSeenCount(),bankSize:BANK.length,studySpanDays:+studySpanDays.toFixed(1),focusTime:{todayMin:+(focusTime.todayMs/60000).toFixed(1),weekMin:+(focusTime.weekMs/60000).toFixed(1),totalMin:+(focusTime.totalMs/60000).toFixed(1),dailyTargetMin:focusTime.target.recommended,minimumMin:focusTime.target.minimum,stretchMin:focusTime.target.stretch},dueQuestionCount,coveragePct:+(st.coverage*100).toFixed(1),masteryPct:+(st.mastery*100).toFixed(1),allTimeAccuracyPct:+(st.allTimeAccuracy*100).toFixed(1),allTimeCorrect:st.allTimeCorrect,avgHitsPerLevel:+(lifetimeLevelScoreStats().avgHits??0).toFixed(2),completedTrainingLevels:lifetimeLevelScoreStats().levels,recentAccuracyPct:+(st.accuracy*100).toFixed(1),recentAutomaticPct:+(st.auto*100).toFixed(1),avgResponseSec:+(st.avgMs/1000).toFixed(2),aeRating:+(st.rating*100).toFixed(1),learningScore:learning.current==null?null:+learning.current.toFixed(1),learningTrendDelta:learning.delta==null?null:+learning.delta.toFixed(1),aiLevel:ai.level,aiConfidencePct:+(ai.confidence*100).toFixed(1),typicalLearner:{you:peer.actual==null?null:+peer.actual.toFixed(1),healthyMin:+peer.healthyMin.toFixed(1),typical:+peer.typical.toFixed(1),strongPace:+peer.strongPace.toFixed(1),paceDelta:peer.delta==null?null:+peer.delta.toFixed(1),label:peer.label},graduationReadinessPct:+(c2.score*100).toFixed(1),campaignLearningProgressPct:+(estimate.learningProgress*100).toFixed(1),campaign2PracticeEstimate:{practiceHours:+estimate.hours.toFixed(1),rangeHours:[+estimate.hoursLow.toFixed(1),+estimate.hoursHigh.toFixed(1)],daysAtCurrentPace:estimate.days,dailyPaceMin:+estimate.paceMinutes.toFixed(1),paceBasis:estimate.paceBasis,calendarFloorDays:estimate.calendarFloor,mainGate:estimate.mainGate,confidence:estimate.confidenceLabel,hourDriver:estimate.hourDriver,gateHours:estimate.gateHours,dailyPlan:estimate.dailyPlan},targetPerformance:targetPerf.n?{levels:targetPerf.n,avgTarget:+targetPerf.avgTarget.toFixed(2),avgActual:+targetPerf.avgActual.toFixed(2),avgDelta:+targetPerf.avgDelta.toFixed(2),hitRatePct:+(targetPerf.hitRate*100).toFixed(1),abovePct:+(targetPerf.aboveRate*100).toFixed(1),exactPct:+(targetPerf.onRate*100).toFixed(1),belowPct:+(targetPerf.belowRate*100).toFixed(1)}:null,readingLoad:{windowAnswers:readingLoad.windowAnswers,short:readingLoadBucketForCoach(readingLoad.short),medium:readingLoadBucketForCoach(readingLoad.medium),long:readingLoadBucketForCoach(readingLoad.long),longVsShort:{accuracyDeltaPts:readingLoad.longVsShort.accuracyDeltaPts==null?null:+readingLoad.longVsShort.accuracyDeltaPts.toFixed(1),timeDeltaSec:readingLoad.longVsShort.timeDeltaMs==null?null:+(readingLoad.longVsShort.timeDeltaMs/1000).toFixed(2),timeoutDeltaPts:readingLoad.longVsShort.timeoutDeltaPts==null?null:+readingLoad.longVsShort.timeoutDeltaPts.toFixed(1)},evidence:readingLoad.evidence.label,lengthSensitiveSkills:readingLoad.sensitiveSkills.map(x=>({skill:x.skill,shortN:x.shortN,longN:x.longN,longVsShortAccuracyPts:+x.accuracyDeltaPts.toFixed(1),longVsShortTimeSec:+(x.timeDeltaMs/1000).toFixed(2)}))},recentTrend:trend,focus:focus.map(x=>({skill:x.name,masteryPct:+(x.mastery*100).toFixed(1),recentErrorPct:+(x.wrongRate*100).toFixed(1),attempts:x.m.attempts||0})),skillMovement:moves.map(x=>({skill:x.skill,deltaAccuracyPts:+x.delta.toFixed(1),recentAccuracyPct:+x.recent.toFixed(1),recentN:x.n})),commonMistakes:mistakes.map(g=>({skill:skillLabel(g.cat),recentMisses:g.count,question:g.record.question||g.record.originalQuestion||"",yourAnswer:g.record.userAnswer||"",correct:g.record.correctAnswer||"",rule:learningTerminology(g.record.rule||"")})),allSkills:[...rankedSkills()].reverse().map(x=>({skill:x.name,masteryPct:+(x.mastery*100).toFixed(1),attempts:x.m.attempts||0}))};
}
const AI_ANALYSIS_CONTRACT={
  language:"Answer mainly in Spanish; keep English examples in English.",
  goal:"Act as an English coach. Compare trends, not only current scores; distinguish acquisition from longitudinal retention.",
  priorities:"Identify 3-5 highest-value grammar targets, conceptual confusions versus speed/automaticity slips, and a concrete focus for the next 5-10 levels.",
  spanishL1:"The learner is a native Spanish speaker. When evidence supports it, explain the Spanish mental pattern or calque that is tempting the learner, then contrast it with the English pattern. Do not force a Spanish-L1 explanation when an error is better explained by speed, reading load or attention.",
  discoveryMethod:"Prefer pattern discovery: confusion → contrast → short retrieval rule. Only propose a mnemonic/hook when it compresses a demonstrated recurring problem; do not front-load many tricks.",
  terminology:"Use 'infinitivo sin to' rather than 'base verb' or 'bare infinitive' in learner-facing explanations.",
  timer:"The 15-second clock is intentionally fixed. Do not recommend changing it from weak or insufficient reading-load evidence.",
  typicalLearner:"Typical Learner figures are a synthetic model, not measured population averages. Treat them only as an internal pace reference.",
  retention:"Use real calendar study span and due-review count when judging consolidation. High same-week volume is not proof of long-term retention."
};
function learningMethodContext(){return {nativeLanguage:"Spanish",preferredTerm:"infinitivo sin to",provenHooks:[{skill:"make + object + infinitivo sin to",hook:"MAKE/MADE → NO TO · MAKE ME FEEL"},{skill:"used to + infinitivo sin to vs get/be used to + -ing",hook:"GOTYE → CORTO · BE/GET → -ING"},{skill:"would rather",hook:"MISMO → INFINITIVO SIN TO · OTRO → PASADO",status:"new; test before calling it consolidated"},{skill:"must have vs should have",hook:"DETECTIVE → MUST HAVE · MADRE REGAÑANDO → SHOULD HAVE",status:"new; test before calling it consolidated"}],method:"Let the learner struggle enough to expose the pattern, then compress it into a short retrieval cue and verify it on later spaced questions."};}
function globalCoachPayload(){return {schema:"ADAPTIVE_ENGLISH_GLOBAL_V1",task:"analyze_longitudinal_campaign_progress",analysisContract:AI_ANALYSIS_CONTRACT,learningMethod:learningMethodContext(),global:coachSnapshot()};}
function globalCoachJsonText(){return JSON.stringify(globalCoachPayload(),null,2);}
function coachPromptText(){const p=globalCoachPayload();return `Analyze this Adaptive B2 Cloze Campaign 1 snapshot as my English coach. Follow the analysisContract in the JSON.\n\nADAPTIVE_ENGLISH_GLOBAL_JSON\n${JSON.stringify(p)}`;}
async function writeClipboardText(text){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch(e){}
  try{const t=document.createElement("textarea");t.value=text;t.setAttribute("readonly","");t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();t.setSelectionRange(0,t.value.length);const ok=document.execCommand("copy");t.remove();return !!ok;}catch(e){return false;}
}
async function copyGlobalCoachJson(btn=null){const ok=await writeClipboardText(globalCoachJsonText());if(btn){const old=btn.textContent;btn.textContent=ok?"GLOBAL JSON COPIED":"COPY BLOCKED · TAP AGAIN";setTimeout(()=>btn.textContent=old,1500);}return ok;}
function generateCoachPrompt(){const box=$("coachPromptBox"),area=$("coachPromptText");if(!box||!area)return;area.value=globalCoachJsonText();box.classList.remove("hidden");area.focus();area.select();}
async function copyCoachPrompt(){const text=globalCoachJsonText(),btn=$("coachPromptCopy");const ok=await writeClipboardText(text);if(btn){btn.textContent=ok?"GLOBAL JSON COPIED":"COPY BLOCKED · TAP AGAIN";setTimeout(()=>btn.textContent="COPY GLOBAL JSON",1400);}}

function commonMistakeGroups(limit=8){
  const groups={};for(const r of state.history.filter(x=>!x.correct).slice(-500)){const key=`${r.cat}|${r.templateId||r.qid||r.originalQuestion}`;const g=groups[key]||(groups[key]={cat:r.cat,templateId:r.templateId,count:0,record:r,lastTs:0});g.count++;if((r.ts||0)>=g.lastTs){g.record=r;g.lastTs=r.ts||0;}}
  return Object.values(groups).sort((a,b)=>b.count-a.count||b.lastTs-a.lastTs).slice(0,limit);
}
function skillRowsHtml(rows,ascending=false){
  const list=ascending?[...rows].reverse():rows,ranks=skillRankPositions(),moves=latestRankMoves();
  return list.map(x=>{const rank=ranks[x.id]||25,move=Number(moves[x.id]||0),zone=rank<=3?` podium rank-${rank}`:rank>=23?` bottom3 rank-${rank}`:"",moveText=move>0?`▲${move}`:move<0?`▼${Math.abs(move)}`:"—",full=escapeHtml(x.name);return `<div class="skillrow${zone}"><div class="skill-position"><i class="skill-rank">${String(rank).padStart(2,"0")}</i><em class="rank-move ${move>0?"up":move<0?"down":"flat"}">${moveText}</em></div><button class="skill-name-hit" type="button" aria-label="${full}" title="${full}" onclick="this.classList.toggle('show-tip')" onblur="this.classList.remove('show-tip')"><span class="skill-name-text">${full}</span><span class="skill-name-popup" role="tooltip">${full}</span></button><div class="track"><div class="fill mastery" style="width:${pct(x.mastery)}%;background:${valueColor(x.mastery)}"></div></div><div class="pct" style="color:${valueTextColor(x.mastery)}">${pct(x.mastery)}%</div></div>`;}).join("");
}
function leagueWindowStats(window=8){
  const levels=state.sessionHistory.filter(x=>x?.mode==="training").slice(-window),net={},ranks=skillRankPositions();
  for(const row of levels)for(const [id,delta] of Object.entries(row.rankMoves||{}))net[id]=(net[id]||0)+Number(delta||0);
  const entries=CAMPAIGN.skills.map(s=>{const current=ranks[s.id]||25,delta=net[s.id]||0,prior=clamp(current+delta,1,25);return {id:s.id,name:learningTerminology(s.name),current,prior,delta};});
  const climbers=entries.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta||a.current-b.current),drops=entries.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta||b.current-a.current);
  const podium=entries.filter(x=>x.current<=3&&x.prior>3).sort((a,b)=>a.current-b.current),escaped=entries.filter(x=>x.current<23&&x.prior>=23).sort((a,b)=>b.delta-a.delta);
  return {window:levels.length,entries,climber:climbers[0]||null,drop:drops[0]||null,podium:podium[0]||null,escaped:escaped[0]||null};
}
function leagueReportHtml(){
  const x=leagueWindowStats(8);if(!x.window)return '<div class="league-report"><div class="league-report-head"><span>LEAGUE REPORT</span><b>Building evidence</b></div></div>';
  const cards=[];if(x.climber)cards.push(`<div class="league-note up"><small>BIGGEST CLIMBER</small><b>▲${x.climber.delta}</b><span>${escapeHtml(x.climber.name)}</span></div>`);if(x.drop)cards.push(`<div class="league-note down"><small>BIGGEST DROP</small><b>▼${Math.abs(x.drop.delta)}</b><span>${escapeHtml(x.drop.name)}</span></div>`);if(x.podium)cards.push(`<div class="league-note medal"><small>NEW PODIUM</small><b>#${x.podium.current}</b><span>${escapeHtml(x.podium.name)}</span></div>`);else if(x.escaped)cards.push(`<div class="league-note escape"><small>ESCAPED BOTTOM 3</small><b>▲${x.escaped.delta}</b><span>${escapeHtml(x.escaped.name)}</span></div>`);
  if(!cards.length)cards.push('<div class="league-note steady"><small>TABLE STATUS</small><b>—</b><span>No net position changes in this window</span></div>');
  return `<div class="league-report"><div class="league-report-head"><span>LEAGUE REPORT · LAST ${x.window} LEVELS</span><b>movement, not mastery change</b></div><div class="league-report-grid">${cards.join("")}</div></div>`;
}
function skillLeagueHtml(rows,compactReport=false){return `<div class="skill-league-list">${skillRowsHtml(rows)}</div>${compactReport?`<button class="league-study-open" type="button" onclick="openLeagueStudy()"><span>LEAGUE STUDY</span><b>Explore the last 8 levels</b><em>OPEN →</em></button>`:leagueReportHtml()}`;}
function renderLeagueScreen(){const host=$("leagueStudyBody");if(!host)return;host.innerHTML=`<div class="section league-study-table"><h3>Current table</h3>${skillRowsHtml(rankedSkills())}</div><div class="section league-study-report"><h3>Last 8 levels</h3>${leagueReportHtml()}</div>`;}
function openLeagueStudy(){renderLeagueScreen();showScreen("leagueScreen");}
function targetPerformanceStats(){
  const rows=state.sessionHistory.filter(x=>x.mode==="training"&&Number.isFinite(x.target)&&Number.isFinite(x.correct));
  if(!rows.length)return {n:0,avgTarget:null,avgActual:null,avgDelta:null,hitRate:null,aboveRate:null,onRate:null,belowRate:null};
  const avgTarget=mean(rows.map(x=>x.target)),avgActual=mean(rows.map(x=>x.correct)),avgDelta=mean(rows.map(x=>x.correct-x.target));
  const above=rows.filter(x=>x.correct>x.target).length,on=rows.filter(x=>x.correct===x.target).length,below=rows.length-above-on,hit=above+on;
  return {n:rows.length,avgTarget,avgActual,avgDelta,hitRate:hit/rows.length,aboveRate:above/rows.length,onRate:on/rows.length,belowRate:below/rows.length};
}
function lifetimeLevelScoreStats(){
  const rows=(state.sessionHistory||[]).filter(x=>x?.mode==="training"&&Number.isFinite(Number(x.correct))&&Number.isFinite(Number(x.total))&&Number(x.total)>0);
  if(!rows.length)return {levels:0,avgHits:null};
  return {levels:rows.length,avgHits:mean(rows.map(x=>15*Number(x.correct)/Number(x.total)))};
}

function promptLoadMeta(text){
  const s=String(text||"").trim(),words=s?s.split(/\s+/).filter(Boolean).length:0,chars=s.length;
  return {words,chars,band:words<=12?"short":words<=17?"medium":"long"};
}
function readingLoadRowMeta(r){const words=Number.isFinite(r.promptWords)?r.promptWords:promptLoadMeta(r.question||r.originalQuestion||"").words;return {words,band:words<=12?"short":words<=17?"medium":"long"};}
function summariseReadingRows(rows){return {n:rows.length,accuracy:rows.length?rows.filter(r=>r.correct).length/rows.length:0,avgMs:rows.length?mean(rows.map(r=>Number(r.ms)||0)):0,timeoutRate:rows.length?rows.filter(r=>r.type==="timeout").length/rows.length:0,automaticRate:rows.length?rows.filter(r=>r.type==="automatic").length/rows.length:0};}
function readingLoadSkillStats(limit=5){
  const rows=state.history.slice(-3000),out=[];
  for(const skill of CAMPAIGN.skills){const sr=rows.filter(r=>r.cat===skill.id),short=sr.filter(r=>readingLoadRowMeta(r).band==="short"),long=sr.filter(r=>readingLoadRowMeta(r).band==="long");if(short.length<8||long.length<8)continue;const a=summariseReadingRows(short),b=summariseReadingRows(long);out.push({skill:skill.name,shortN:a.n,longN:b.n,accuracyDeltaPts:(b.accuracy-a.accuracy)*100,timeDeltaMs:b.avgMs-a.avgMs});}
  return out.sort((a,b)=>a.accuracyDeltaPts-b.accuracyDeltaPts||b.timeDeltaMs-a.timeDeltaMs).slice(0,limit);
}
function readingLoadStats(){
  const rows=state.history.slice(-1500).filter(r=>(r.question||r.originalQuestion)&&Number.isFinite(Number(r.ms))),groups={short:[],medium:[],long:[]};for(const r of rows)groups[readingLoadRowMeta(r).band].push(r);
  const short=summariseReadingRows(groups.short),medium=summariseReadingRows(groups.medium),long=summariseReadingRows(groups.long),enough=short.n>=30&&long.n>=30;
  const deltaAccuracy=enough?(long.accuracy-short.accuracy)*100:null,deltaTimeMs=enough?long.avgMs-short.avgMs:null,deltaTimeout=enough?(long.timeoutRate-short.timeoutRate)*100:null;
  let label="BUILDING EVIDENCE",detail=`Need ≥30 short and ≥30 long responses · now ${short.n}/${long.n}.`;
  if(enough){const strong=deltaAccuracy<=-10||deltaTimeMs>=1250||deltaTimeout>=8,moderate=deltaAccuracy<=-5||deltaTimeMs>=650||deltaTimeout>=4;label=strong?"STRONG LOAD SIGNAL":moderate?"MODERATE LOAD SIGNAL":"NO CLEAR LOAD PENALTY";detail=`Long vs short: ${deltaAccuracy>=0?"+":""}${deltaAccuracy.toFixed(1)} accuracy pts · ${deltaTimeMs>=0?"+":""}${(deltaTimeMs/1000).toFixed(2)}s · ${deltaTimeout>=0?"+":""}${deltaTimeout.toFixed(1)} timeout pts.`;}
  return {windowAnswers:rows.length,short,medium,long,longVsShort:{accuracyDeltaPts:deltaAccuracy,timeDeltaMs:deltaTimeMs,timeoutDeltaPts:deltaTimeout},evidence:{enough,label,detail},sensitiveSkills:readingLoadSkillStats()};
}
function readingLoadBucketForCoach(x){return {n:x.n,accuracyPct:+(x.accuracy*100).toFixed(1),avgResponseSec:+(x.avgMs/1000).toFixed(2),timeoutPct:+(x.timeoutRate*100).toFixed(1),automaticPct:+(x.automaticRate*100).toFixed(1)};}
function focusPanelHtml(){
  const s=focusSummary(),t=s.target,todayMin=s.todayMs/60000,stretchMs=t.stretch*60000,p=Math.min(100,s.todayMs/stretchMs*100),recPos=Math.min(100,t.recommended/t.stretch*100),minPos=Math.min(100,t.minimum/t.stretch*100);
  const maxDay=Math.max(t.stretch,...s.days.map(d=>(state.focusTimeByDate?.[d.key]||0)/60000),1),bars=s.days.map(d=>{const mins=(state.focusTimeByDate?.[d.key]||0)/60000,h=d.future?0:Math.max(4,Math.min(100,mins/maxDay*100));return `<div class="focus-day ${d.today?"today":""} ${d.future?"future":""}"><div class="focus-bar-mini"><i style="height:${h}%"></i></div><b>${d.label}</b><small>${mins?Math.round(mins)+"m":"·"}</small></div>`;}).join("");
  return `<div class="focus-head"><div><span>FOCUS TIME · TODAY</span><strong>${formatStudyTime(s.todayMs)} <small>/ ${t.recommended}m</small></strong></div><em>${escapeHtml(focusStatus(todayMin,t))}</em></div><div class="focus-progress"><i style="width:${p}%"></i><b class="focus-mark min" style="left:${minPos}%"></b><b class="focus-mark rec" style="left:${recPos}%"></b></div><div class="focus-targets"><span>MIN ${t.minimum}m</span><span>REC ${t.recommended}m</span><span>STRETCH ${t.stretch}m</span></div><p class="focus-why">${escapeHtml(t.why)}</p><div class="focus-week"><div class="focus-week-head"><b>THIS WEEK · ${formatStudyTime(s.weekMs)}</b><span>TOTAL FOCUS · ${formatStudyTime(s.totalMs)}</span></div><div class="focus-week-bars">${bars}</div></div><small class="focus-note">Focus Time cuenta uso visible y activo; se pausa en segundo plano o tras 90s sin interacción.</small>`;
}
function renderFocusWidgets(){for(const id of ["startFocusPanel","statsFocusPanel"]){const el=$(id);if(el)el.innerHTML=focusPanelHtml();}}
function markFocusActivity(){focusLastActivityTs=Date.now();}
function flushFocusSave(){if(!state||focusSaveMs<1)return;focusSaveMs=0;try{save();}catch(e){console.error("Focus Time save failed",e);}}
function focusTick(){const now=Date.now(),dt=Math.max(0,Math.min(1600,now-focusLastTickTs));focusLastTickTs=now;if(!state||document.visibilityState!=="visible"||now-focusLastActivityTs>90000)return;const day=localDayKey(now);state.focusTimeByDate[day]=(state.focusTimeByDate[day]||0)+dt;focusSaveMs+=dt;if(focusSaveMs>=15000)flushFocusSave();renderFocusWidgets();}
function startFocusTracking(){if(focusTimerHandle)return;ensureFocusTarget();focusLastActivityTs=focusLastTickTs=Date.now();["pointerdown","keydown","touchstart","scroll"].forEach(ev=>document.addEventListener(ev,markFocusActivity,{passive:true}));document.addEventListener("visibilitychange",()=>{focusLastTickTs=Date.now();if(document.visibilityState==="hidden")flushFocusSave();else markFocusActivity();});window.addEventListener("beforeunload",flushFocusSave);focusTimerHandle=setInterval(focusTick,1000);}

function renderStatsScreen(){
  renderFocusWidgets();
  const st=overallStats(),ai=aiValorationStats(),learning=learningScoreStats(),c2=campaign2Readiness(),peer=typicalLearnerStats(),trend=state.sessionHistory.filter(x=>x.mode==="training"),tgt=targetPerformanceStats(),readingLoad=readingLoadStats();applyRatingTheme(st.rating);applyAiTheme(ai);
  $("statsAiLevel").textContent=`${ai.level} / 15`;paintText("statsAiLevel",ai.score/100);$("statsAiConfidence").textContent=`Evidence ${Math.round(ai.confidence*100)}%`;paintText("statsAiConfidence",ai.confidence);
  $("statsLearningScore").textContent=learning.current==null?"—":learning.current.toFixed(1);if(learning.current!=null)paintText("statsLearningScore",learning.current/100);const ld=$("statsLearningDelta");if(learning.delta==null){ld.className="learning-direction neutral";ld.textContent="→";ld.style.color="#b7c9bf";}else{const up=learning.delta>.05,down=learning.delta<-.05;ld.className=`learning-direction ${up?"good":down?"bad":"neutral"}`;ld.textContent=`${up?"↑":down?"↓":"→"} ${learning.delta>=0?"+":""}${learning.delta.toFixed(1)}`;ld.style.color=semanticDeltaColor(learning.delta,true);}$("statsLearningWindow").textContent=`Last ${learning.windowSize} vs previous ${learning.windowSize} levels`;
  [["statsCoverage",st.coverage,true],["statsMastery",st.mastery,true],["statsAccuracy",st.accuracy,true],["statsAutomatic",st.auto,true]].forEach(([id,v,pc])=>{$(id).textContent=pc?`${pct(v)}%`:String(v);paintText(id,v);});{const life=lifetimeLevelScoreStats();$("statsAllAccuracy").textContent=life.avgHits==null?"-":`${life.avgHits.toFixed(1)} /15`;if(life.avgHits!=null)paintScore("statsAllAccuracy",life.avgHits);}$("statsAvg").textContent=st.avgMs?fmtSec(st.avgMs):"—";$("statsTotal").textContent=(state.totalAttempts||0).toLocaleString();$("statsStudyTime").textContent=formatStudyTime(state.activeTrainingMs||0);
  $("statsAccuracyChart").innerHTML=sessionScoreChart(trend,false);$("statsLearningChart").innerHTML=sparkline(learningCurveSeries(),v=>`${v.toFixed(1)}`,false,learning.start,"Start");$("statsSkills").innerHTML=skillLeagueHtml(rankedSkills(),true);
  if(tgt.n){$("targetAvg").textContent=tgt.avgTarget.toFixed(1);paintScore("targetAvg",tgt.avgTarget);$("targetActualAvg").textContent=tgt.avgActual.toFixed(1);paintScore("targetActualAvg",tgt.avgActual);$("targetDeltaAvg").textContent=`${tgt.avgDelta>=0?"+":""}${tgt.avgDelta.toFixed(2)}`;paintDelta("targetDeltaAvg",tgt.avgDelta,true);$("targetHitRate").textContent=`${Math.round(tgt.hitRate*100)}%`;paintText("targetHitRate",tgt.hitRate);$("targetBreakdown").textContent=`${tgt.n} target levels · Above ${Math.round(tgt.aboveRate*100)}% · Exact ${Math.round(tgt.onRate*100)}% · Below ${Math.round(tgt.belowRate*100)}%`; }else{$("targetBreakdown").textContent="Complete levels with TARGET to build this statistic.";}
  [["readingShort", "readingShortMeta", readingLoad.short],["readingMedium", "readingMediumMeta", readingLoad.medium],["readingLong", "readingLongMeta", readingLoad.long]].forEach(([id,metaId,x])=>{const main=$(id),meta=$(metaId);main.textContent=x.n?`${Math.round(x.accuracy*100)}%`:"—";if(x.n)paintText(id,x.accuracy);meta.textContent=x.n?`${fmtSec(x.avgMs)} avg · ${Math.round(x.timeoutRate*100)}% timeout · n=${x.n}`:"No evidence yet";});
  const loadInsight=$("readingLoadInsight"),sensitive=readingLoad.sensitiveSkills[0];loadInsight.textContent=`${readingLoad.evidence.label} · ${readingLoad.evidence.detail}${sensitive?` Most length-sensitive key so far: ${sensitive.skill} (${sensitive.accuracyDeltaPts.toFixed(1)} pts long vs short).`:""}`;
  $("statsPeerYou").textContent=peer.actual==null?"—":peer.actual.toFixed(1);if(peer.actual!=null)paintText("statsPeerYou",peer.actual/100);$("statsPeerHealthy").textContent=peer.healthyMin.toFixed(1);paintText("statsPeerHealthy",peer.healthyMin/100);$("statsPeerExpected").textContent=peer.typical.toFixed(1);paintText("statsPeerExpected",peer.typical/100);$("statsPeerStrong").textContent=peer.strongPace.toFixed(1);paintText("statsPeerStrong",peer.strongPace/100);const peerText=peer.delta==null?"—":`${peer.delta>=0?"+":""}${peer.delta.toFixed(1)}`;$("statsPeerDelta").textContent=peerText;$("statsPeerDeltaMini").textContent=peerText;if(peer.delta!=null){paintDelta("statsPeerDelta",peer.delta,true);paintDelta("statsPeerDeltaMini",peer.delta,true);}const pd=$("statsPeerDelta");pd.className=`peer-delta ${peer.delta==null||Math.abs(peer.delta)<2?"neutral":peer.delta>0?"good":"bad"}`;$("statsPeerLabel").textContent=`${peer.label} · Typical range ${peer.healthyMin.toFixed(1)}–${peer.strongPace.toFixed(1)} at ${peer.attempts.toLocaleString()} answers. Model-based reference, not measured users.`;
  $("statsCampaign2").textContent=`Graduation readiness ${pct(c2.score)}% · ${c2.stage}${c2.ready?" · Graduation gate achieved":" · "+(c2.blockers[0]||"Keep consolidating")}`;$("statsCampaign2").style.color=valueTextColor(c2.score);
}
function campaignLearningProgress(st=overallStats()){
  const initialMastery=mean(Object.values(INITIAL_PRIORS).map(x=>.45*x[0]+.35*x[1]+.20*x[2]));
  const baseline=.65*initialMastery,target=.65*.85+.25*.999+.10*.04,learning=learningScoreStats();
  const raw=.65*st.mastery+.25*st.coverage+.10*st.auto,current=clamp((learning.current??raw*100)/100);
  const progress=clamp((current-baseline)/Math.max(.001,target-baseline));
  return {progress,current,raw,baseline,target,initialMastery};
}
function estimatedLevelPracticeHours(x){const n=Math.max(1,Number(x?.total)||15),avgSec=Math.max(.8,(Number(x?.avgMs)||6000)/1000);return (n*(avgSec+.90)+6)/3600;}
function observedRate(rows,valueFn,current,start){
  const all=rows.filter(x=>Number.isFinite(valueFn(x))),totalHours=Math.max(.10,all.reduce((n,x)=>n+estimatedLevelPracticeHours(x),0)),longRate=Math.max(0,current-start)/totalHours;
  const recent=all.slice(-48);let recentRate=0;
  if(recent.length>=12){const k=Math.max(3,Math.min(8,Math.floor(recent.length/4))),a=mean(recent.slice(0,k).map(valueFn)),b=mean(recent.slice(-k).map(valueFn)),h=Math.max(.10,recent.reduce((n,x)=>n+estimatedLevelPracticeHours(x),0));recentRate=Math.max(0,b-a)/h;}
  const blended=recentRate>0?.65*recentRate+.35*longRate:.35*longRate;
  const floor=Math.max(.0015,longRate*.25),ceiling=Math.max(.008,longRate*1.8);
  return {rate:clamp(blended,floor,ceiling),longRate,recentRate,totalHours};
}
function campaignPracticeEstimate(){
  const c=campaign2Readiness(),st=overallStats(),g=c.graduation,hist=state.history||[],sessions=(state.sessionHistory||[]).filter(x=>x.mode==="training"),now=Date.now(),day=86400000,focus=focusSummary(),lp=campaignLearningProgress(st);
  const firstTs=hist.find(x=>Number.isFinite(x.ts))?.ts||state.createdAt||now,spanDays=Math.max(.25,(now-firstTs)/day),todayMin=focus.todayMs/60000,recommendedMin=Math.max(1,focus.target.recommended||15);
  const due=activeSeenRows().filter(x=>x?.lastTs&&now>=(x.nextDueTs||x.lastTs+(x.intervalDays||1)*day)).length,dueRatio=activeSeenCount()?due/activeSeenCount():1;
  const progressForRow=x=>clamp(((.65*(x.mastery??lp.initialMastery)+.25*(x.coverage??0)+.10*(x.automatic??0))-lp.baseline)/Math.max(.001,lp.target-lp.baseline));
  const learningRate=observedRate(sessions,progressForRow,lp.progress,0),masteryRate=observedRate(sessions,x=>Number(x.mastery),st.mastery,lp.initialMastery),coverageRate=observedRate(sessions,x=>Number(x.coverage),st.coverage,0);
  const hoursLearning=Math.max(0,(1-lp.progress)/Math.max(.0015,learningRate.rate)),hoursMastery=Math.max(0,(.85-st.mastery)/Math.max(.0015,masteryRate.rate)),hoursCoverage=Math.max(0,(.999-st.coverage)/Math.max(.002,coverageRate.rate));
  const weakRate=Math.max(.0015,masteryRate.rate*1.25),hoursWeak=Math.max(0,(.70-st.minSkill)/weakRate);
  const candidates=[{gate:"LEARNING PROGRESS",hours:hoursLearning},{gate:"MASTERY",hours:hoursMastery},{gate:"COVERAGE",hours:hoursCoverage},{gate:"WEAKEST SKILLS",hours:hoursWeak}],driver=[...candidates].sort((a,b)=>b.hours-a.hours)[0];
  const hours=state.completed?0:Math.min(120,driver.hours),calendarFloor=Math.max(0,Math.ceil(14-g.spanDays));
  const minimumMin=Math.max(1,focus.target.minimum||Math.max(10,recommendedMin-5)),stretchMin=Math.max(recommendedMin,focus.target.stretch||recommendedMin+6),planDays=min=>state.completed?0:Math.max(calendarFloor,Math.ceil(hours*60/Math.max(1,min)));
  const dailyPlan={minimum:{minutes:minimumMin,days:planDays(minimumMin)},recommended:{minutes:recommendedMin,days:planDays(recommendedMin)},stretch:{minutes:stretchMin,days:planDays(stretchMin)},today:todayMin>=10?{minutes:Math.round(todayMin),days:planDays(todayMin)}:null};
  const paceMinutes=recommendedMin,paceBasis="RECOMMENDED",practiceDays=dailyPlan.recommended.days,days=practiceDays;
  const confidence=clamp((spanDays-5)/18)*clamp(sessions.length/100),spread=.42-.20*confidence,hoursLow=Math.max(0,hours*(1-spread)),hoursHigh=Math.min(160,hours*(1+spread));
  let mainGate=!g.gates.calendar?"LONGITUDINAL RETENTION":!g.gates.retentionEvidence||!g.gates.retention||dueRatio>.60?"RETENTION":driver.gate;
  const confidenceLabel=confidence>=.65?"HIGH":confidence>=.30?"MEDIUM":"LOW";
  if(state.completed)mainGate="CLEARED";else if(st.eligible)mainGate="FINAL CHALLENGE";
  return {days:state.completed?0:days,practiceDays:state.completed?0:practiceDays,calendarFloor:state.completed?0:calendarFloor,hours,hoursLow:state.completed?0:hoursLow,hoursHigh:state.completed?0:hoursHigh,paceMinutes,paceBasis,recommendedMin,minimumMin,stretchMin,dailyPlan,mainGate,hourDriver:driver.gate,learningProgress:lp.progress,due,dueRatio,spanDays,confidence,confidenceLabel,eligible:st.eligible,completed:state.completed,rates:{learning:learningRate.rate,mastery:masteryRate.rate,coverage:coverageRate.rate},gateHours:Object.fromEntries(candidates.map(x=>[x.gate,+x.hours.toFixed(2)]))};
}
function campaignPracticeEstimateHtml(){
  const e=campaignPracticeEstimate(),h=e.hours<10?e.hours.toFixed(1):Math.round(e.hours).toString(),hl=e.hoursLow<10?e.hoursLow.toFixed(1):Math.round(e.hoursLow).toString(),hh=e.hoursHigh<10?e.hoursHigh.toFixed(1):Math.round(e.hoursHigh).toString(),p=e.dailyPlan;
  const headline=e.completed?"CLEARED":e.eligible?"FINAL":`~${h} h`;
  const sub=e.completed?"Campaign 1 completed.":e.eligible?"Graduation gates passed · final challenge remains.":`RECOMMENDED PLAN · ${Math.round(p.recommended.minutes)} min/day → ~${p.recommended.days} days`;
  const scenarios=e.completed||e.eligible?"":`<div class="campaign-plan-scenarios"><span>MIN ${Math.round(p.minimum.minutes)}m → ${p.minimum.days}d</span><span>STRETCH ${Math.round(p.stretch.minutes)}m → ${p.stretch.days}d</span>${p.today?`<span>TODAY ${Math.round(p.today.minutes)}m → ${p.today.days}d</span>`:""}</div>`;
  return `<article class="campaign-eta"><div><small>CAMPAIGN 2 · ESTIMATED PRACTICE LEFT</small><h2>${headline}</h2><p>${sub}</p>${scenarios}<div class="campaign-eta-range">LEARNING PROGRESS · ${Math.round(e.learningProgress*100)}% · RANGE ${hl}–${hh} h · HOUR DRIVER ${escapeHtml(e.hourDriver)}${e.calendarFloor?` · calendar floor ${e.calendarFloor}d`:""} · confidence ${e.confidenceLabel}</div></div><aside><span>MAIN GATE</span><b>${escapeHtml(e.mainGate)}</b><em>${e.due.toLocaleString()} reviews due</em></aside><footer>The recommended plan uses today's adaptive Focus target. More focused minutes usually shorten the modeled practice horizon; fewer minutes lengthen it. The estimate counts focused app practice, not passive screen time, and calendar/retention gates can still keep Campaign 1 open.</footer></article>`;
}
function localCoachReport(){
  const hist=state.history||[],recent=hist.slice(-120),prev=hist.slice(-240,-120),stats=overallStats(),trend=coachTrendSummary(),focus=coachSkillStats(),top=focus.slice(0,5),due=Object.values(state.seen||{}).filter(x=>x?.lastTs&&Date.now()>=(x.nextDueTs||x.lastTs+(x.intervalDays||1)*86400000)).length;
  const acc=a=>a.length?a.filter(x=>x.correct).length/a.length:null,avg=a=>a.length?a.reduce((n,x)=>n+(x.ms||0),0)/a.length:null,auto=a=>a.length?a.filter(x=>x.type==="automatic").length/a.length:null;
  const ra=acc(recent),pa=acc(prev),rt=avg(recent),pt=avg(prev),rau=auto(recent),pau=auto(prev),delta=ra!=null&&pa!=null?(ra-pa)*100:null,timeDelta=rt!=null&&pt!=null?(rt-pt)/1000:null,autoDelta=rau!=null&&pau!=null?(rau-pau)*100:null;
  let phase="BUILDING EVIDENCE",phaseText="Todavía necesito más historial reciente para separar una tendencia real de la variación normal.";
  if(recent.length>=60&&prev.length>=60){if(delta>=4&&timeDelta<=.35){phase="IMPROVING";phaseText=`La precisión reciente sube ${delta.toFixed(1)} puntos frente a la ventana anterior sin pagar una penalización clara de tiempo.`;}else if(delta<=-5){phase="VOLATILE / REVIEW";phaseText=`La precisión reciente cae ${Math.abs(delta).toFixed(1)} puntos frente a la ventana anterior. Conviene leerlo como señal de consolidación pendiente, no como pérdida demostrada de aprendizaje.`;}else if(autoDelta>=3&&timeDelta<0){phase="AUTOMATIZING";phaseText=`La precisión está relativamente estable, pero la automaticidad sube ${autoDelta.toFixed(1)} puntos y respondes ${Math.abs(timeDelta).toFixed(2)} s más rápido.`;}else{phase="CONSOLIDATING";phaseText="El rendimiento reciente está relativamente estable: ahora importa especialmente si las revisiones espaciadas se sostienen mientras aumenta la cobertura.";}}
  const firstTs=hist.find(x=>Number.isFinite(x.ts))?.ts||state.createdAt||Date.now(),days=Math.max(0,(Date.now()-firstTs)/86400000),best=top[0],second=top[1];
  const misconceptionRows=[];for(const r of hist.filter(x=>!x.correct).slice(-500)){const m=misconceptionFingerprint(r);if(m.source==="fallback"||m.id==="NO_ANSWER")continue;if(!misconceptionRows.some(x=>x.id===m.id))misconceptionRows.push(m);}misconceptionRows.sort((a,b)=>b.recentCount-a.recentCount||b.count-a.count);const mc=misconceptionRows[0];
  const evidence=days<7?`Llevas ${days.toFixed(1)} días reales de evidencia. El volumen puede mostrar adquisición, pero todavía es pronto para llamar retención a largo plazo a una mejora reciente.`:`El historial cubre ${days.toFixed(1)} días reales y hay ${due} preguntas actualmente debidas para revisión.`;
  const next=best?`Durante los próximos 5 niveles, la prioridad principal es <b>${escapeHtml(best.name)}</b>${second?` y después <b>${escapeHtml(second.name)}</b>`:""}. ${best.rows.length?`En ${best.rows.length} intentos recientes, ${Math.round(best.wrongRate*100)}% fueron errores.`:""}`:"Sigue acumulando niveles para construir prioridades fiables.";
  return {phase,html:`${campaignPracticeEstimateHtml()}<article class="local-coach-hero"><small>LIVE · LEVEL ${state.level}</small><h2>${phase}</h2><p>${phaseText}</p></article><article class="coach-narrative"><h3>Qué está pasando</h3><p>Tu ventana inmediata contiene <b>${recent.length}</b> respuestas. Precisión: <b>${ra==null?"—":(ra*100).toFixed(1)+"%"}</b>; automaticidad: <b>${rau==null?"—":(rau*100).toFixed(1)+"%"}</b>; tiempo medio: <b>${rt==null?"—":(rt/1000).toFixed(2)+" s"}</b>. ${delta==null?"Aún no hay una ventana anterior comparable.":`Frente a las ${prev.length} respuestas anteriores: precisión ${delta>=0?"+":""}${delta.toFixed(1)} pp, tiempo ${timeDelta>=0?"+":""}${timeDelta.toFixed(2)} s y automaticidad ${autoDelta>=0?"+":""}${autoDelta.toFixed(1)} pp.`}</p><h3>Retención y carga pendiente</h3><p>${evidence} Ahora mismo hay <b>${due}</b> revisiones debidas.</p><h3>Cuello de botella</h3><p>${best?`La prioridad calculada es <b>${escapeHtml(best.name)}</b>, con mastery ${Math.round(best.mastery*100)}% y ${Math.round(best.wrongRate*100)}% de error en su ventana reciente.`:"Todavía no hay evidencia suficiente."}${mc?` La misconception con señal reciente más clara es <b>${escapeHtml(mc.label)}</b>: ${mc.count} casos históricos, ${mc.recentCount} entre los últimos 30 errores de esa skill (${mc.evidence} evidence).`:""}</p><h3>Próximos 5 niveles</h3><p>${next}</p><div class="coach-method">Informe local determinista · se recalcula después de cada nivel · no usa Internet ni modifica el motor adaptativo.</div></article>`};
}
function renderLocalCoach(){const host=$("localCoachReport");if(!host)return;host.innerHTML=localCoachReport().html;}
function renderCoachScreen(){
  renderLocalCoach();
  const focus=coachSkillStats(),top=focus.slice(0,5),mistakes=commonMistakeGroups(8),worst=[...rankedSkills()].reverse();applyRatingTheme(overallStats().rating);applyAiTheme(aiValorationStats());
  const weak40=focus.filter(x=>x.mastery<.40).length;$("coachIntro").textContent=`Based on ${(state.totalAttempts||0).toLocaleString()} answers, your coach is prioritising ${top.map(x=>x.name).slice(0,3).join(", ")||"more evidence"}. ${weak40} key${weak40===1?"":"s"} are still below 40% mastery.`;
  $("coachFocus").innerHTML=top.map(x=>{const l=(window.AE_LESSONS||{})[x.id]||{},recent=x.rows.length?`${pct(x.wrongRate)}% errors in last ${x.rows.length} attempts`:"Not enough recent evidence";return `<div class="coach-card"><div class="coach-head"><h3>${escapeHtml(x.name)}</h3><span class="coach-score" style="color:${valueTextColor(x.mastery)}">${pct(x.mastery)}%</span></div><p>${escapeHtml(recent)} · ${x.m.attempts||0} total attempts</p><p>${escapeHtml(l.es||"Keep identifying the grammar pattern before choosing the form.")}</p>${l.formula?`<div class="formula">${escapeHtml(l.formula)}</div>`:""}${l.cue?`<p>💡 ${escapeHtml(l.cue)}</p>`:""}</div>`;}).join("")||'<p class="meta">Complete a few levels to build your study file.</p>';
  $("coachMistakes").innerHTML=mistakes.map(g=>{const r=g.record,l=(window.AE_LESSONS||{})[g.cat]||{},item=itemCoach(r);return `<div class="mistake-card"><b>${escapeHtml(skillLabel(g.cat))} · ${g.count} recent miss${g.count===1?"":"es"}</b><p>${escapeHtml(r.question||r.originalQuestion||"")}</p><div class="mistake-choice"><div><b>You</b><br>${escapeHtml(r.userAnswer)}</div><div class="correct"><b>Correct</b><br>${escapeHtml(r.correctAnswer)}</div></div><p><b>Rule:</b> ${escapeHtml(learningTerminology(r.rule||l.es||"Review the structure and contrast it with the correct form."))}${item.quick?`<br><b>Coach:</b> ${escapeHtml(item.quick)}`:""}</p></div>`;}).join("")||'<p class="meta">No recurring mistakes yet.</p>';
  $("coachSkills").innerHTML=skillRowsHtml(worst);
}
function coachVariantKey(r){
  const c=normErrorAnswer(r?.correctAnswer||"");
  if(r?.cat==="mixed_conditional")return /would have/.test(c)?"present_to_past":"past_to_present";
  if(r?.cat==="unless"||r?.cat==="despite"||r?.cat==="whose")return c||"default";
  if(r?.cat==="modal_deduction")return /^must have/.test(c)?"must":/^can't have|^cannot have/.test(c)?"cant":"default";
  return "default";
}
function itemCoach(r){
  const lesson=(window.AE_LESSONS||{})[r?.cat]||{},coach=(window.AE_ERROR_COACH||{})[r?.cat]||{},c=normErrorAnswer(r?.correctAnswer||"");
  const out={formula:learningTerminology(r?.rule||lesson.formula||r?.correctAnswer||""),quick:learningTerminology(lesson.cue||coach.must||"Identifica primero el patrón."),whyEs:coach.must||lesson.es||r?.rule||"",whyEn:lesson.en||"Notice the pattern in the correct answer.",secret:coach.secret||lesson.cue||"",trap:coach.trap||""};
  if(r?.cat==="mixed_conditional"&&/would have/.test(c))return {...out,formula:"If + PAST SIMPLE → WOULD HAVE + participle (past result)",quick:"Condición de ahora + resultado de ayer → WOULD HAVE.",whyEs:"La condición describe una realidad presente irreal, pero la consecuencia pertenece al pasado. Por eso el resultado usa would have + participio.",secret:"MIXED: mira los DOS tiempos antes de elegir.",trap:"If I were more organised, I WOULD HAVE finished yesterday."};
  if(r?.cat==="mixed_conditional")return {...out,formula:"If + HAD + participle → WOULD + infinitivo sin to (now)",quick:"Causa pasada + resultado de ahora → WOULD + infinitivo sin to.",whyEs:"La causa irreal está en el pasado y el resultado se ve ahora. Por eso el resultado no lleva would have.",secret:"MIXED: mira los DOS tiempos antes de elegir.",trap:"If I had studied medicine, I WOULD BE a doctor now."};
  if(r?.cat==="unless"&&c==="unless")return {...out,formula:"UNLESS = IF NOT / A MENOS QUE",quick:"A MENOS QUE → UNLESS.",whyEs:"La condición funciona como una excepción negativa. Léela como «a menos que», sin añadir otra negación.",secret:"UNLESS = A MENOS QUE.",trap:"You can't enter UNLESS you show ID."};
  if(r?.cat==="unless"&&c==="if")return {...out,formula:"IF = positive condition",quick:"SI ocurre X → IF.",whyEs:"La condición es positiva: el resultado depende de que ocurra la condición, no de una excepción negativa.",secret:"IF = SI; UNLESS = A MENOS QUE.",trap:"You'll improve IF you practise."};
  if(r?.cat==="despite"&&c==="despite")return {...out,formula:"DESPITE + noun / -ing",quick:"Después viene una cosa/-ing → DESPITE.",whyEs:"Despite introduce un nombre, pronombre o forma en -ing; no una oración completa con sujeto y verbo.",secret:"DESPITE mira una COSA.",trap:"despite the rain ✓"};
  if(r?.cat==="despite"&&c==="although")return {...out,formula:"ALTHOUGH + subject + verb",quick:"Después viene sujeto + verbo → ALTHOUGH.",whyEs:"Although introduce una oración completa. Si después ves sujeto + verbo, no uses despite.",secret:"ALTHOUGH mira una FRASE.",trap:"although it was raining ✓"};
  if(r?.cat==="modal_deduction"&&/^must have/.test(c))return {...out,formula:"MUST HAVE + participle",quick:"La evidencia apunta a SÍ → MUST HAVE.",whyEs:"La evidencia apoya fuertemente que el hecho ocurrió en el pasado.",secret:"DEDUCCIÓN PASADA: SÍ casi seguro → MUST HAVE.",trap:"The log shows her account was active → she MUST HAVE used it."};
  if(r?.cat==="modal_deduction"&&(/^can't have/.test(c)||/^cannot have/.test(c)))return {...out,formula:"CAN'T HAVE + participle",quick:"La evidencia lo hace imposible → CAN'T HAVE.",whyEs:"La evidencia hace incompatible o imposible que el hecho ocurriera.",secret:"DEDUCCIÓN PASADA: imposible → CAN'T HAVE.",trap:"The train was cancelled before boarding → she CAN'T HAVE taken it."};
  if(r?.cat==="whose"&&c==="whose")return {...out,formula:"WHOSE + noun",quick:"Posesión / «cuyo» → WHOSE."};
  if(r?.cat==="whose"&&c==="who")return {...out,formula:"WHO + verb",quick:"Persona que hace la acción → WHO."};
  if(r?.cat==="whose"&&c==="which")return {...out,formula:"WHICH + verb",quick:"Cosa que hace/recibe la acción → WHICH."};
  if(r?.cat==="whose"&&c==="whom")return {...out,formula:"PREPOSITION + WHOM",quick:"Preposición + persona → WHOM (formal)." };
  return out;
}
function levelErrorGroups(records){
  const groups={},order=[];
  for(const r of (records||[]).filter(x=>!x.correct)){const key=`${r.cat}::${coachVariantKey(r)}`;if(!groups[key]){groups[key]={cat:r.cat,variant:coachVariantKey(r),records:[],firstTs:r.ts||0};order.push(key);}groups[key].records.push(r);}
  return order.map(key=>groups[key]).sort((a,b)=>b.records.length-a.records.length||a.firstTs-b.firstTs);
}
function solvedErrorSentence(r){const q=String(r.question||r.originalQuestion||"");return q.includes("___")?q.replace("___",r.correctAnswer||"___"):q;}
function normErrorAnswer(x){return String(x||"").trim().toLowerCase().replace(/\s+/g," ");}
function infinitiveBody(x){const m=normErrorAnswer(x).match(/^to\s+([a-z]+)$/);return m?m[1]:null;}
function isExactBareOf(w,c){const base=infinitiveBody(c);return !!base&&normErrorAnswer(w)===base;}
function isIngOf(w,c){const base=infinitiveBody(c),x=normErrorAnswer(w);if(!base)return false;const forms=new Set([base+"ing"]);if(base.endsWith("e"))forms.add(base.slice(0,-1)+"ing");if(/[^aeiou][aeiou][^aeiouwxy]$/.test(base))forms.add(base+base.slice(-1)+"ing");return forms.has(x);}
const MISCONCEPTION_RULES={
  unless:[
    {id:"CONDITION_TO_CAUSE",label:"condition → cause",test:(w,c)=>/\bbecause\b/.test(w)&&/\b(if|unless)\b/.test(c)},
    {id:"UNLESS_PLUS_NOT",label:"unless + explicit negation",test:(w,c)=>/\bunless\b/.test(w)&&/\b(not|don't|doesn't|didn't|won't|wouldn't|can't|cannot)\b/.test(w)},
    {id:"IF_UNLESS_POLARITY",label:"if / unless polarity",test:(w,c)=>/\b(if|unless)\b/.test(w)&&/\b(if|unless)\b/.test(c)&&w!==c}
  ],
  make_bare:[{id:"MAKE_TO_INFINITIVE",label:"make + object + to-infinitive",test:(w,c)=>/^to\s+/.test(w)&&!/^to\s+/.test(c)},{id:"MAKE_GERUND",label:"make + object + -ing",test:(w,c)=>/ing\b/.test(w)&&! /ing\b/.test(c)}],
  used_to:[{id:"USED_TO_INFLECTED",label:"used to + inflected verb",test:(w,c)=>/\b(ing|ed)\b/.test(w)||/ing$|ed$/.test(w)}],
  get_used_to:[{id:"USED_TO_BASE_INSTEAD_OF_ING",label:"be/get used to + infinitivo sin to",test:(w,c)=>! /ing\b/.test(w)&&/ing\b/.test(c)}],
  look_forward:[{id:"LOOK_FORWARD_TO_BASE",label:"look forward to + infinitivo sin to",test:(w,c)=>! /ing\b/.test(w)&&/ing\b/.test(c)}],
  allow_to:[{id:"ALLOW_BARE_INFINITIVE",label:"allow + object + infinitivo sin to",test:(w,c)=>isExactBareOf(w,c)},{id:"ALLOW_GERUND_INSTEAD_OF_TO",label:"allow + object + -ing instead of to-infinitive",test:(w,c)=>isIngOf(w,c)}],
  despite:[{id:"DESPITE_CLAUSE",label:"despite + finite clause",test:(w,c)=>/\b(although|though|even though)\b/.test(c)&&/\bdespite\b/.test(w)}],
  so_such:[{id:"SO_SUCH_SWAP",label:"so / such swap",test:(w,c)=>/\b(so|such)\b/.test(w)&&/\b(so|such)\b/.test(c)&&w!==c}],
  too_enough:[{id:"TOO_ENOUGH_SWAP",label:"too / enough swap",test:(w,c)=>/\b(too|enough)\b/.test(w)&&/\b(too|enough)\b/.test(c)&&w!==c}],
  second_conditional:[{id:"SECOND_CONDITIONAL_WILL",label:"will in the if-clause",test:(w,c)=>/\bwill\b/.test(w)&&! /\bwill\b/.test(c)}],
  third_conditional:[{id:"THIRD_CONDITIONAL_FORM",label:"third conditional form confusion",test:(w,c)=>w!==c}],
  modal_deduction:[{id:"MUST_CANT_POLARITY",label:"must have / can't have polarity",test:(w,c)=>/^(must have|can't have|cannot have)/.test(w)&&/^(must have|can't have|cannot have)/.test(c)&&w!==c},{id:"PAST_MODAL_FORM",label:"past modal deduction form",test:(w,c)=>w!==c}],
  backshift:[{id:"BACKSHIFT_TENSE",label:"reported-speech backshift",test:(w,c)=>w!==c}],
  mixed_conditional:[{id:"MIXED_TIME_REFERENCE",label:"mixed conditional time reference",test:(w,c)=>w!==c}]
};
function misconceptionFor(r){const w=normErrorAnswer(r.userAnswer),c=normErrorAnswer(r.correctAnswer);if(!w||w==="no answer")return {id:"NO_ANSWER",label:"timeout / no answer",source:"observed"};const rules=MISCONCEPTION_RULES[r.cat]||[];const hit=rules.find(x=>{try{return x.test(w,c,r);}catch(e){return false;}});return hit?{id:hit.id,label:hit.label,source:"rule"}:{id:`${String(r.cat||"skill").toUpperCase()}_OTHER`,label:"other distractor in this skill",source:"fallback"};}
function misconceptionFingerprint(r){const m=misconceptionFor(r),all=state.history.filter(x=>!x.correct&&x.cat===r.cat).map(x=>({r:x,m:misconceptionFor(x)})),same=all.filter(x=>x.m.id===m.id),recent=all.slice(-30),recentSame=recent.filter(x=>x.m.id===m.id);return {...m,count:same.length,shareOfSkillErrorsPct:all.length?+(same.length/all.length*100).toFixed(1):0,recentCount:recentSame.length,firstSeenLevel:same[0]?.r.level??r.level,lastSeenLevel:same[same.length-1]?.r.level??r.level,evidence:same.length>=8?"HIGH":same.length>=4?"MODERATE":"BUILDING"};}
function errorFingerprint(r){
  const skillRows=state.history.filter(x=>x.cat===r.cat),wrong=skillRows.filter(x=>!x.correct),same=wrong.filter(x=>normErrorAnswer(x.userAnswer)===normErrorAnswer(r.userAnswer)),recent=wrong.slice(-30),recentSame=recent.filter(x=>normErrorAnswer(x.userAnswer)===normErrorAnswer(r.userAnswer));
  return {skillAttempts:skillRows.length,skillMisses:wrong.length,sameWrongAnswerCount:same.length,shareOfSkillErrorsPct:wrong.length?+(same.length/wrong.length*100).toFixed(1):0,recentMisses:recent.length,recentSameWrongAnswerCount:recentSame.length,firstSeenLevel:same[0]?.level??r.level,lastSeenLevel:same[same.length-1]?.level??r.level,evidence:same.length>=5?"RECURRING":same.length>=3?"EMERGING":"BUILDING"};
}
function sessionSkillSummary(records){
  const groups={};for(const r of records||[]){const g=groups[r.cat]||(groups[r.cat]={cat:r.cat,attempts:0,correct:0,totalMs:0,automatic:0});g.attempts++;g.correct+=r.correct?1:0;g.totalMs+=r.ms||0;g.automatic+=r.type==="automatic"?1:0;}
  return Object.values(groups).map(g=>({skill:skillLabel(g.cat),attempts:g.attempts,correct:g.correct,accuracyPct:+(g.correct/g.attempts*100).toFixed(1),avgResponseSec:+(g.totalMs/g.attempts/1000).toFixed(2),automaticPct:+(g.automatic/g.attempts*100).toFixed(1)})).sort((a,b)=>a.accuracyPct-b.accuracyPct||b.attempts-a.attempts);
}
function compactSessionError(r){const fp=errorFingerprint(r),mc=misconceptionFingerprint(r);return {skill:skillLabel(r.cat),categoryId:r.cat,question:r.question||r.originalQuestion||"",myAnswer:r.userAnswer||"No answer",correctAnswer:r.correctAnswer||"",responseTimeSec:+((r.ms||0)/1000).toFixed(2),errorType:r.type||"wrong",readingLoad:r.readingLoad||null,review:!!r.review,reviewGapLevels:r.gap??null,rule:learningTerminology(r.rule||""),errorFingerprint:fp,misconceptionFingerprint:mc};}
function sessionErrorGroupsPayload(records){
  return levelErrorGroups(records).map(g=>{const item=itemCoach(g.records[0]||{}),mis={};for(const r of g.records){const m=misconceptionFingerprint(r),x=mis[m.id]||(mis[m.id]={id:m.id,label:m.label,count:0,evidence:m.evidence,historicalCount:m.count,recentCount:m.recentCount});x.count++;}return {skill:skillLabel(g.cat),categoryId:g.cat,variant:g.variant||"default",misses:g.records.length,formula:learningTerminology(item.formula||g.records[0]?.rule||""),quickRule:learningTerminology(item.quick||""),spanishContrastPrompt:"Explain this group contrastively when supported: Spanish mental pattern/calque → why it tempts me → English pattern. If the evidence looks like a speed/attention slip instead, say so rather than forcing an L1 explanation.",misconceptions:Object.values(mis),examples:g.records.map(r=>({question:r.question||r.originalQuestion||"",myAnswer:r.userAnswer||"No answer",correctAnswer:r.correctAnswer||"",responseTimeSec:+((r.ms||0)/1000).toFixed(2),errorType:r.type||"wrong"}))};});
}
function sessionErrorsPayload(records=session?.records||[]){const wrong=(records||[]).filter(r=>!r.correct);return {schema:"ADAPTIVE_ENGLISH_SESSION_ERRORS_V1",task:"diagnose_latest_level_errors",analysisContract:AI_ANALYSIS_CONTRACT,learningMethod:learningMethodContext(),session:{level:records?.[0]?.level??null,totalAnswers:records?.length||0,errors:wrong.length,skillSummary:sessionSkillSummary(records)},errorGroups:sessionErrorGroupsPayload(wrong),errors:wrong.map(compactSessionError)};}
function sessionHandoffPayload(snap,records=session?.records||[]){const wrong=(records||[]).filter(r=>!r.correct);return {schema:"ADAPTIVE_ENGLISH_GLOBAL_PLUS_SESSION_V1",task:"analyze_longitudinal_progress_and_latest_level",analysisContract:AI_ANALYSIS_CONTRACT,learningMethod:learningMethodContext(),global:coachSnapshot(),latestSession:{level:snap?.level??records?.[0]?.level??null,mode:snap?.mode||records?.[0]?.sessionMode||"training",correct:snap?.correct??records.filter(r=>r.correct).length,total:snap?.total??records.length,accuracyPct:snap?.accuracy==null?null:+(snap.accuracy*100).toFixed(1),avgResponseSec:snap?.avgMs==null?null:+(snap.avgMs/1000).toFixed(2),automaticPct:snap?.automatic==null?null:+(snap.automatic*100).toFixed(1),target:snap?.target??null,targetDelta:snap?.targetDelta??null,targetHit:snap?.targetHit??null,skillSummary:sessionSkillSummary(records),errorCount:wrong.length,errorGroups:sessionErrorGroupsPayload(wrong),errors:wrong.map(compactSessionError)}};}
let lastSessionHandoffText="";
function sessionHandoffJsonText(snap,records=session?.records||[]){return JSON.stringify(sessionHandoffPayload(snap,records),null,2);}
function setEndHandoffStatus(ok,copyFailed=false){const box=$("endAiHandoff"),status=$("endHandoffStatus"),meta=$("endHandoffMeta"),btn=$("endCopyHandoffBtn");if(!box||!status||!btn)return;box.classList.toggle("copied",!!ok);status.textContent=ok?"PROGRESS JSON COPIED":copyFailed?"COPY BLOCKED · TAP AGAIN":"PROGRESS JSON READY · OPTIONAL";if(meta)meta.textContent="Learning progress + this level + session errors. Nothing is copied automatically.";btn.textContent=ok?"COPY PROGRESS AGAIN":"COPY PROGRESS JSON";}
async function copyEndSessionHandoff(){if(!lastSessionHandoffText){const snap=state.sessionHistory[state.sessionHistory.length-1]||null;lastSessionHandoffText=sessionHandoffJsonText(snap,session?.records||[]);}const ok=await writeClipboardText(lastSessionHandoffText);setEndHandoffStatus(ok,!ok);return ok;}
async function copySessionErrorsJson(btn=null){const text=JSON.stringify(sessionErrorsPayload(session?.records||[]),null,2),ok=await writeClipboardText(text);if(btn){const old=btn.textContent;btn.textContent=ok?"SESSION ERRORS COPIED":"COPY BLOCKED · TAP AGAIN";setTimeout(()=>btn.textContent=old,1400);}return ok;}
function errorPromptPayload(r){const fp=errorFingerprint(r),mc=misconceptionFingerprint(r);return {task:"diagnose_one_english_error",app:"Adaptive B2 Cloze",version:APP_VERSION,skill:skillLabel(r.cat),question:r.question||r.originalQuestion||"",my_answer:r.userAnswer||"No answer",correct_answer:r.correctAnswer||"",response_time_sec:+((r.ms||0)/1000).toFixed(2),error_type:r.type||"wrong",level:r.level,error_fingerprint:fp,misconception_fingerprint:mc,instruction:"Diagnose only this error. Explain the likely misconception without pretending certainty. Use the historical pattern as evidence, distinguish conceptual confusion from a possible execution slip, contrast my wrong form with the correct form, and when supported explicitly show Spanish mental pattern/calque → English pattern. Do not force an L1 explanation for a likely speed/attention slip. Give one memorable rule, 3 minimal pairs, and a very short retrieval drill. Use the learner term infinitivo sin to. Answer mainly in Spanish, using English for the examples."};}
async function copyErrorPrompt(btn,index){const records=session?.records||[],groups=levelErrorGroups(records),r=groups[index]?.records?.slice(-1)[0];if(!r)return;const text=JSON.stringify(errorPromptPayload(r),null,2);try{await navigator.clipboard.writeText(text);btn.textContent="COPIED ✓";setTimeout(()=>btn.textContent="COPY ERROR JSON",1300);}catch(e){const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();btn.textContent="COPIED ✓";}}
function errorCoachCardHtml(group,index){
  const records=group.records||[],r=records[records.length-1]||{},lesson=(window.AE_LESSONS||{})[group.cat]||{},item=itemCoach(r),title=skillLabel(group.cat),echoes=[];
  for(const row of records){const e=memoryEchoFor(group.cat,row.correctAnswer||"");if(e&&!echoes.some(x=>x.artist===e.artist&&x.title===e.title))echoes.push(e);}
  const examples=records.map((row,i)=>`<div class="error-example"><div class="error-example-q"><b>${i+1}.</b> ${escapeHtml(row.question||row.originalQuestion||"")}</div><div class="mistake-choice"><div class="wrong"><b>You</b><br>${escapeHtml(row.userAnswer||"No answer")}</div><div class="correct"><b>Correct</b><br>${escapeHtml(row.correctAnswer||"")}</div></div><div class="error-solved">${escapeHtml(solvedErrorSentence(row))}</div></div>`).join("");
  const whyEs=item.whyEs||r.rule||"Fíjate en la estructura de la respuesta correcta.",whyEn=item.whyEn||"Notice the pattern in the correct answer and reuse it.",formula=item.formula||r.rule||r.correctAnswer||"",quick=item.quick||"Identifica primero el patrón.",secret=item.secret||quick,trap=item.trap||"Contrasta tu respuesta con la forma correcta hasta que la estructura salga automáticamente.";
  const music=echoes.length?`<div class="error-music">${echoes.map(e=>`<div><small>MUSIC ECHO</small><b>♪ ${escapeHtml(e.artist)} · ${escapeHtml(e.title)}</b><span>${escapeHtml(e.cue)}</span>${spotifyOpenHtml(e)}</div>`).join("")}</div>`:`<div class="error-music"><div><small>MEMORY ECHO</small><b>${escapeHtml(lesson.example||r.correctAnswer||title)}</b></div></div>`;
  const rank=Math.max(0,14-index),style=`--error-accent:${COLOR_BANDS_15[rank]};--error-surface:${SURFACE_BANDS_15[rank]};--error-text:${AVS_TEXT_BANDS_15[rank]}`;
  const fp=errorFingerprint(r),mc=misconceptionFingerprint(r),finger=`<div class="error-fingerprint"><span>${fp.evidence}</span><b>${fp.sameWrongAnswerCount}× same answer</b><small>${fp.shareOfSkillErrorsPct}% of this skill’s recorded misses</small></div><div class="misconception-fingerprint"><span>${mc.evidence} EVIDENCE</span><b>${escapeHtml(mc.label)}</b><small>${mc.count} cases · ${mc.shareOfSkillErrorsPct}% of skill misses · ${mc.recentCount} in last 30 misses</small></div><button class="copy-error-json" type="button" onclick="copyErrorPrompt(this,${index})">COPY ERROR JSON</button>`;
  return `<article class="error-coach-card" style="${style}"><div class="error-coach-head"><div><small>ERROR KEY ${String(index+1).padStart(2,"0")}</small><h3>${escapeHtml(title)}</h3></div><span>${records.length} ${records.length===1?"MISS":"MISSES"}</span></div>${examples}${finger}<div class="error-formula">${escapeHtml(formula)}</div><div class="error-quick"><b>QUICK RULE</b><span>${escapeHtml(quick)}</span></div><details class="error-detail"><summary>WHY? · ENTIÉNDELO</summary><div class="error-detail-body"><p><b>ES ·</b> ${escapeHtml(whyEs)}</p><p><b>EN ·</b> ${escapeHtml(whyEn)}</p></div></details><details class="error-detail secret-detail"><summary>🗝 SECRET KEY · MEMORY ECHO</summary><div class="error-detail-body"><div class="secret-key-copy">${escapeHtml(secret)}</div><p class="secret-trap">${escapeHtml(trap)}</p>${music}</div></details></article>`;
}
function renderErrorLab(records,targetId){
  const host=$(targetId),groups=levelErrorGroups(records);if(!host)return groups;
  host.innerHTML=groups.map(errorCoachCardHtml).join("");return groups;
}

function selectLevelLesson(records){
  const wrong=records.filter(r=>!r.correct);
  if(wrong.length){
    const groups={};
    for(const r of wrong){const g=groups[r.cat]||(groups[r.cat]={cat:r.cat,count:0,totalMs:0,maxMs:0,record:r});g.count++;g.totalMs+=r.ms||0;if((r.ms||0)>=g.maxMs){g.maxMs=r.ms||0;g.record=r;}}
    const g=Object.values(groups).sort((a,b)=>b.count-a.count||b.totalMs-a.totalMs||b.maxMs-a.maxMs)[0];
    return {kind:"error",count:g.count,record:g.record};
  }
  const record=[...records].sort((a,b)=>(b.ms||0)-(a.ms||0))[0];
  return record?{kind:"reinforce",count:0,record}:null;
}
function renderLevelLesson(records){
  const box=$("levelLesson"),wrong=(records||[]).filter(r=>!r.correct);if(!box)return;
  if(wrong.length){box.classList.add("hidden");box.innerHTML="";return;}
  const pick=selectLevelLesson(records||[]);
  if(!pick){box.classList.add("hidden");box.innerHTML="";return;}
  const r=pick.record,lesson=(window.AE_LESSONS||{})[r.cat]||{es:`La regla clave de este patr\u00f3n es: ${r.rule||"f\u00edjate en la estructura de la respuesta correcta."}`,en:r.rule||"Focus on the structure of the correct answer.",formula:r.correctAnswer||"",example:String(r.question||"").replace("___",r.correctAnswer||"___"),translation:"",cue:"Identifica primero el patr\u00f3n y despu\u00e9s completa la forma verbal."};
  const skill=CAMPAIGN.skills.find(s=>s.id===r.cat),title=skill?.name||r.skill||r.cat;
  const kicker=pick.kind==="error"?(pick.count>1?`ERROR DOMINANTE \u00b7 ${pick.count} FALLOS EN ESTE NIVEL`:"ERROR CLAVE DEL NIVEL"):"NIVEL PERFECTO \u00b7 TIP DE REFUERZO";
  const source=pick.kind==="error"?`<div class="lesson-choice"><div><b>Tu respuesta</b><br>${escapeHtml(r.userAnswer)}</div><div class="correct"><b>Respuesta correcta</b><br>${escapeHtml(r.correctAnswer)}</div></div>`:`<div class="lesson-choice"><div class="correct"><b>Respuesta que conviene automatizar</b><br>${escapeHtml(r.correctAnswer)}</div></div>`;
  box.innerHTML=`<div class="lesson-kicker">${kicker}</div><h2>${escapeHtml(title)}</h2><div class="lesson-source"><b>${pick.kind==="error"?"La pregunta en la que m\u00e1s conviene fijarse":"La pregunta m\u00e1s lenta del nivel"}:</b><br>${escapeHtml(r.question)}${source}</div><div class="lesson-languages"><div class="lesson-lang"><h3>ESPA\u00d1OL \u00b7 ENTI\u00c9NDELO</h3><p>${escapeHtml(lesson.es)}</p></div></div><div class="lesson-formula">${escapeHtml(lesson.formula)}</div><div class="lesson-example"><strong>${escapeHtml(lesson.example)}</strong>${lesson.translation?escapeHtml(lesson.translation):""}</div><div class="lesson-cue">\u{1F4A1} Para la pr\u00f3xima: ${escapeHtml(lesson.cue)}</div>`;
  box.classList.remove("hidden");
}

function practiceEstimateMiniHtml(estimate=campaignPracticeEstimate()){
  if(estimate.completed)return `<b>CAMPAIGN CLEARED</b>`;
  if(estimate.eligible)return `<b>FINAL CHALLENGE READY</b>`;
  const h=estimate.hours<10?estimate.hours.toFixed(1):Math.round(estimate.hours),hl=estimate.hoursLow<10?estimate.hoursLow.toFixed(1):Math.round(estimate.hoursLow),hh=estimate.hoursHigh<10?estimate.hoursHigh.toFixed(1):Math.round(estimate.hoursHigh);
  return `<strong>~${h} h</strong><span>estimated focused practice left</span><b>${Math.round(estimate.dailyPlan.recommended.minutes)} min/day → ~${estimate.dailyPlan.recommended.days} days</b><small>minimum ${Math.round(estimate.dailyPlan.minimum.minutes)}m → ${estimate.dailyPlan.minimum.days}d · stretch ${Math.round(estimate.dailyPlan.stretch.minutes)}m → ${estimate.dailyPlan.stretch.days}d${estimate.dailyPlan.today?` · today ${Math.round(estimate.dailyPlan.today.minutes)}m → ${estimate.dailyPlan.today.days}d`:""}<br>learning progress ${Math.round(estimate.learningProgress*100)}% · range ${hl}–${hh} h · hour driver ${escapeHtml(estimate.hourDriver)}${estimate.calendarFloor?` · calendar floor ${estimate.calendarFloor}d`:""}</small>`;
}
function renderPracticeEstimateMini(id,estimate=campaignPracticeEstimate()){
  const el=$(id);if(el)el.innerHTML=practiceEstimateMiniHtml(estimate);
}
function renderCampaign2Readiness(){
  const r=campaign2Readiness(),estimate=campaignPracticeEstimate(),score=pct(r.score),fill=$("campaign2Fill"),box=$("campaign2Box");
  if(box){
    $("campaign2Score").textContent=`${score}%`;paintText("campaign2Score",r.score);fill.style.width=`${score}%`;paintFill("campaign2Fill",r.score);$("campaign2Stage").textContent=r.stage;
    $("campaign2Status").textContent=r.ready?"Graduation gate achieved. The final challenge still decides Campaign 1 completion.":`${r.blockers.slice(0,2).join(" · ") || "Keep training to build stronger evidence."}`;
    renderPracticeEstimateMini("campaign2PracticeEstimate",estimate);
    $("campaign2Copy").classList.toggle("hidden",!r.ready);box.classList.toggle("ready",r.ready);
  }
  const end=$("campaign2End");if(end){const show=r.ready||r.score>=.60;end.classList.toggle("hidden",!show);if(show)end.textContent=r.ready?`GRADUATION GATE ACHIEVED · Readiness ${score}% · Final challenge remains.`:`CAMPAIGN 2 IS GETTING CLOSE · Readiness ${score}% · Keep consolidating Campaign 1.`;}
}
async function copyCampaign2Brief(){
  const text=campaign2Brief();
  try{await navigator.clipboard.writeText(text);alert("Campaign 2 handoff copied. Export your progress too and send both to ChatGPT.");}
  catch(e){const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();alert("Campaign 2 handoff copied. Export your progress too and send both to ChatGPT.");}
}
function localDateKey(ts=Date.now()){const d=new Date(ts),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
function calendarDayNumber(dateKey){const [y,m,d]=String(dateKey).split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
function addCalendarDays(dateKey,days){const [y,m,d]=String(dateKey).split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d)+days*86400000),p=n=>String(n).padStart(2,"0");return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth()+1)}-${p(dt.getUTCDate())}`;}
function ensureDailyKey(){
  const today=localDateKey(),keys=window.AE_KEYS||{};let changed=false;
  const unique=[],used=new Set();for(const x of (Array.isArray(state.keyring)?state.keyring:[])){if(keys[x?.cat]&&!used.has(x.cat)){used.add(x.cat);unique.push(x);}}
  state.keyring=unique.slice(0,25);state.keyring.forEach((x,i)=>{if(x.number!==i+1){x.number=i+1;changed=true;}});
  if(!state.keyJourneyStart){state.keyJourneyStart=state.keyring.map(x=>x.firstDate).filter(Boolean).sort()[0]||state.dailyKey?.date||today;changed=true;}
  const elapsed=Math.max(0,calendarDayNumber(today)-calendarDayNumber(state.keyJourneyStart)),target=Math.min(25,Math.max(state.keyring.length,elapsed+1));
  while(state.keyring.length<target){
    const taken=new Set(state.keyring.map(x=>x.cat)),ranked=coachSkillStats().filter(x=>keys[x.id]&&!taken.has(x.id)),evidenced=ranked.filter(x=>(x.m.attempts||0)>=3),pick=(evidenced.length?evidenced:ranked)[0]||CAMPAIGN.skills.find(x=>keys[x.id]&&!taken.has(x.id));
    if(!pick)break;const n=state.keyring.length+1,unlockDate=addCalendarDays(state.keyJourneyStart,n-1);state.keyring.push({cat:pick.id,number:n,firstDate:unlockDate,lastDate:unlockDate,exposures:1});changed=true;
  }
  const active=state.keyring[Math.min(state.keyring.length,target)-1]||state.keyring[state.keyring.length-1];if(!active)return null;
  if(state.dailyKey?.date!==today||state.dailyKey?.cat!==active.cat){state.dailyKey={date:today,cat:active.cat};changed=true;}
  if(changed)save();return {...state.dailyKey,number:active.number||state.keyring.indexOf(active)+1,unlocked:state.keyring.length,start:state.keyJourneyStart};
}
function keySlideHtml(x){
  const key=(window.AE_KEYS||{})[x.cat],skill=CAMPAIGN.skills.find(s=>s.id===x.cat),m=state.metrics[x.cat],mastery=m?metricMastery(m):0,n=x.number||1,echo=memoryEchoFor(x.cat,x.cat==="so_such"?"such":x.cat==="too_enough"?"enough":"");
  return `<article class="key-slide" data-key-number="${n}"><div class="key-slide-meta"><span>BASE KEY ${n} / 25</span><small>${pct(mastery)}% MASTERY</small></div><button class="daily-key-card" type="button" aria-expanded="false"><div class="daily-key-face daily-key-front"><small>ESPAÑOL → INGLÉS</small><strong>${escapeHtml(key.front)}</strong><span>TOCA PARA REVELAR</span></div><div class="daily-key-face daily-key-back"><small>KEY ${n} UNLOCKED</small><strong>${escapeHtml(key.back)}</strong><b>${escapeHtml(key.formula)}</b><span>${escapeHtml(key.cue)}</span>${keyMemoryEchoHtml(x.cat)}</div></button>${spotifyOpenHtml(echo,"key-spotify-open")}</article>`;
}
function discoverySlideHtml(x){const echo=memoryEchoFor(x.echoCat||"","");return `<article class="key-slide discovery-slide" data-key-number="${x.number}"><div class="key-slide-meta"><span>DISCOVERY ${String(x.number).padStart(3,"0")}</span><small>DIARY KEY</small></div><button class="daily-key-card discovery-card" type="button" aria-expanded="false"><div class="daily-key-face daily-key-front"><small>${escapeHtml(x.title)}</small><strong>${escapeHtml(x.front)}</strong><span>TOCA PARA REVELAR</span></div><div class="daily-key-face daily-key-back"><small>KEY ${String(x.number).padStart(3,"0")} · DISCOVERED</small><strong>${escapeHtml(x.back)}</strong><b>${escapeHtml(x.formula)}</b><span>${escapeHtml(x.cue)}</span>${echo?`<em class="key-memory-echo"><small>MUSIC ECHO</small><span>${escapeHtml(echo.artist)} · ${escapeHtml(echo.title)}</span><b>${escapeHtml(echo.cue)}</b></em>`:""}</div></button>${spotifyOpenHtml(echo,"key-spotify-open")}</article>`;}
function renderDailyKey(){
  const host=$("dailyKeyHost"),journey=ensureDailyKey();if(!host||!journey)return;
  const unlocked=[...state.keyring].sort((a,b)=>(a.number||0)-(b.number||0)),discoveries=unlockedDiscoveryCards(),lockedN=Math.min(25,unlocked.length+1);
  const marks=Array.from({length:25},(_,i)=>`<i class="${i<unlocked.length?"on":""}"></i>`).join("");
  const locked=unlocked.length<25?`<article class="key-slide key-slide-locked" data-key-number="${lockedN}"><div class="key-slide-meta"><span>BASE KEY ${lockedN} / 25</span><small>LOCKED</small></div><div class="daily-key-card locked-card"><div class="daily-key-face"><small>NEXT BASE KEY</small><strong>?</strong><b>KEY ${lockedN}</b><span>SE DESBLOQUEA CON EL PRÓXIMO DÍA</span></div></div></article>`:"";
  host.innerHTML=`<div class="daily-key-head"><div><span>KEY DIARY</span><b>${unlocked.length} / 25 BASE · ${discoveries.length} DISCOVERED</b></div><em>${unlocked.length+discoveries.length}</em></div><div class="key-marks" aria-label="${unlocked.length} of 25 base Keys unlocked">${marks}</div><div id="keyCarousel" class="key-carousel">${unlocked.map(keySlideHtml).join("")}${discoveries.map(discoverySlideHtml).join("")}${locked}</div><div class="key-carousel-hint">1 TOQUE: GIRAR · 2º TOQUE: SIGUIENTE</div>`;
  const carousel=$("keyCarousel"),slides=[...carousel.querySelectorAll(".key-slide")],cards=[...carousel.querySelectorAll("button.daily-key-card")];
  const centerSlide=(slide,behavior="smooth")=>{if(!slide)return;const left=Math.max(0,slide.offsetLeft-(carousel.clientWidth-slide.clientWidth)/2);carousel.scrollTo({left,behavior});};
  cards.forEach(card=>card.addEventListener("click",async()=>{clearTimeout(card._autoTurnTimer);const slide=card.closest(".key-slide");if(!card.classList.contains("revealed")){card.classList.add("revealed");card.setAttribute("aria-expanded","true");try{await ensureAudio();playKeyFlip(true);}catch(e){console.error("Key flip audio failed",e);}card._autoTurnTimer=setTimeout(()=>{if(!card.classList.contains("revealed"))return;card.classList.remove("revealed");card.setAttribute("aria-expanded","false");try{playKeyFlip(false,true);}catch(e){}},10000);return;}
    card.classList.remove("revealed");card.setAttribute("aria-expanded","false");try{await ensureAudio();playKeyFlip(false,true);}catch(e){}const i=slides.indexOf(slide),next=slides[i+1]||slides[0];centerSlide(next);
  }));
  requestAnimationFrame(()=>{const discovery=discoveries[discoveries.length-1],current=discovery?slides.find(x=>Number(x.dataset.keyNumber)===discovery.number):slides.find(x=>Number(x.dataset.keyNumber)===journey.number);centerSlide(current,"auto");});
}
function treeRand(seed=129){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=t;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296;};}
let TREE_PARTS_CACHE=null;
function growthTreeParts(){
  if(TREE_PARTS_CACHE)return TREE_PARTS_CACHE;
  const rnd=treeRand(20260912),branches=[],leaves=[];
  const grow=(x,y,len,ang,width,depth,dist)=>{
    const sway=(rnd()-.5)*.18,angle=ang+sway,x2=x+Math.cos(angle)*len,y2=y+Math.sin(angle)*len;
    const bend=(rnd()-.5)*10,mx=(x+x2)/2+Math.cos(angle+Math.PI/2)*bend,my=(y+y2)/2+Math.sin(angle+Math.PI/2)*bend;
    const score=dist+len*.58+depth*2+rnd()*2;
    branches.push({score,html:`<path d="M ${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="${Math.max(1.25,width).toFixed(2)}"/>`});
    if(depth>=4){const rot=Math.round((rnd()-.5)*90),rx=(5+rnd()*5).toFixed(1),ry=(2.8+rnd()*3).toFixed(1),green=["#607d3b","#769447","#8ca85a","#526f36"][Math.floor(rnd()*4)];leaves.push({score:score+8+rnd()*15,html:`<ellipse cx="${(x2+(rnd()-.5)*7).toFixed(1)}" cy="${(y2+(rnd()-.5)*6).toFixed(1)}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x2.toFixed(1)} ${y2.toFixed(1)})" fill="${green}"/>`});}
    if(depth>=6)return;
    const next=len*(.72+rnd()*.09),w=width*.72,spread=.35+rnd()*.20;
    grow(x2,y2,next,angle-spread,w,depth+1,dist+len);
    grow(x2,y2,next*(.92+rnd()*.12),angle+spread*(.88+rnd()*.22),w*.96,depth+1,dist+len);
  };
  grow(210,274,56,-Math.PI/2,12,0,0);
  const parts=[...branches.map(x=>({...x,kind:"branch"})),...leaves.map(x=>({...x,kind:"leaf"}))].sort((a,b)=>a.score-b.score||a.kind.localeCompare(b.kind)).slice(0,200);
  TREE_PARTS_CACHE=parts.map((x,i)=>({...x,stage:i+1}));return TREE_PARTS_CACHE;
}
function renderGrowthTree(){
  const host=$("growthTreeHost");if(!host)return;
  const level=syncGlobalLevel(state.level),stage=Math.min(200,Math.floor(level/50)),parts=growthTreeParts().slice(0,stage);
  const branch=parts.filter(x=>x.kind==="branch").map(x=>x.html).join(""),leaf=parts.filter(x=>x.kind==="leaf").map(x=>x.html).join("");
  host.innerHTML=`<div class="growth-tree-canvas" data-tree-stage="${stage}"><svg viewBox="0 0 420 300" role="img" aria-label="Practice tree, growth stage ${stage} of 200"><defs><linearGradient id="treeTrunk" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5d3827"/><stop offset=".55" stop-color="#76503a"/><stop offset="1" stop-color="#957258"/></linearGradient></defs><ellipse class="tree-ground" cx="210" cy="282" rx="78" ry="7"/> <g class="tree-branches" fill="none" stroke="url(#treeTrunk)" stroke-linecap="round" stroke-linejoin="round">${branch}</g><g class="tree-leaves">${leaf}</g></svg></div><div class="growth-tree-count"><b>${level.toLocaleString()}</b><span>LEVEL</span></div>`;
}

const RELEASE_NOTES=["v1.2.0 locks the 3,000-question B2 Part 1/2 bank around greater sentence variety","Every skill now uses 10 real templates × 12 contexts instead of 5 templates × 24 cosmetic variants","The bank keeps roughly half of the previous questions and replaces the other half with new B2 First-style lexical and function-word patterns informed by the existing adaptive-exam corpus","New-question selection prefers unseen templates before recycling a pattern, while due spaced reviews can still return an exact question","Questions remain short for the fixed 15-second clock; names and contexts are more varied","Per-question feedback now shows question repetitions, pattern repetitions, correct and wrong counts","Coverage counts only questions that still belong to the active 3,000-question bank","The timer display now initializes from the real 15-second TIME_LIMIT instead of the inherited 10.0 label"];
function renderReleaseInfo(){const host=$("releaseInfo"),online=location.protocol.startsWith("http"),build=`${online?"ONLINE":"LOCAL"} BUILD · v${APP_VERSION} · BANK ${CAMPAIGN?.version||"—"}`;if(host)host.innerHTML=`<details class="release-info"><summary><b>Adaptive B2 Cloze v${APP_VERSION}</b><span>WHAT’S NEW</span></summary><ul>${RELEASE_NOTES.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></details>`;if($("buildVersion"))$("buildVersion").textContent=build;if($("endBuildVersion"))$("endBuildVersion").textContent=build;const meta=document.querySelector('meta[name="ae-version"]');if(meta)meta.setAttribute("content",APP_VERSION);document.title=`Adaptive B2 Cloze - Campaign 1 - v${APP_VERSION}`;}
function renderStart(){
  ensureDailyKey();
  const st=overallStats(),sg=stageInfo(st.coverage),rb=ratingBand(st.rating),ai=aiValorationStats();
  applyRatingTheme(st.rating);applyAiTheme(ai);applyCoverRankTheme(ai);
  $("startAiLevel").textContent=`${ai.level} / 15`;paintText("startAiLevel",ai.score/100);
  $("startAiConfidence").textContent=`AI Valoration · evidencia ${Math.round(ai.confidence*100)}%`;paintText("startAiConfidence",ai.confidence);
  $("startKicker").textContent=`CAMPAIGN 1 · ${currentStageText()}`;
  $("startLevel").textContent=`LEVEL ${state.level}`;
  $("startBtn").textContent=state.sessions?`CONTINUE · LEVEL ${state.level}`:`START · LEVEL ${state.level}`;
  $("coverageText").textContent=`${activeSeenCount().toLocaleString()} / ${BANK.length.toLocaleString()}`;
  $("coverageFill").style.width=pct(st.coverage)+"%";paintFill("coverageFill",st.coverage);paintText("coverageText",st.coverage);
  $("masteryText").textContent=pct(st.mastery)+"%";$("masteryFill").style.width=pct(st.mastery)+"%";paintFill("masteryFill",st.mastery);paintText("masteryText",st.mastery);
  $("startFluency").textContent=st.rating?pct(st.rating):"—";paintText("startFluency",st.rating);
  $("startAccuracy").textContent=st.accuracy?pct(st.accuracy)+"%":"—";paintText("startAccuracy",st.accuracy);
  $("startAvg").textContent=st.avgMs?fmtSec(st.avgMs):"—";
  {const life=lifetimeLevelScoreStats();$("startAllAccuracy").textContent=life.avgHits==null?"-":`${life.avgHits.toFixed(1)} /15`;if(life.avgHits!=null)paintScore("startAllAccuracy",life.avgHits);}
  $("startAuto").textContent=st.auto?pct(st.auto)+"%":"—";paintText("startAuto",st.auto);
  $("startMastered").textContent=`${st.mastered}/${CAMPAIGN.skills.length}`;paintText("startMastered",st.mastered/CAMPAIGN.skills.length);
  $("startTotal").textContent=(state.totalAttempts||0).toLocaleString();$("startStudyTime").textContent=formatStudyTime(state.activeTrainingMs||0);const phraseStats=phraseExposureStats();$("startPhrasesDone").textContent=phraseStats.unique.toLocaleString();$("startRepeatedPhrases").textContent=phraseStats.repeatedUnique.toLocaleString();
  const peer=typicalLearnerStats(),spd=$("startPeerDelta");spd.textContent=peer.delta==null?"—":`${peer.delta>=0?"+":""}${peer.delta.toFixed(1)}`;spd.className=`peer-delta ${peer.delta==null||Math.abs(peer.delta)<2?"neutral":peer.delta>0?"good":"bad"}`;$("startPeerStatus").textContent=`${peer.label} · typical ${peer.typical.toFixed(1)} · range ${peer.healthyMin.toFixed(1)}–${peer.strongPace.toFixed(1)}`;
  let status=`AE RATING ${pct(st.rating)} · ${rb.name} · ${sg.name} · ${Math.max(0,sg.to-sg.seen)} new exercises until the next stage.`;
  if(st.coverage>=.999&&!st.eligible){const gate=campaign2Readiness();status=`All 3,000 exercises explored. GRADUATION GATE pending · ${gate.blockers[0]||"keep consolidating longitudinal evidence"}.`;}
  if(st.eligible&&!state.completed)status="FINAL CHALLENGE READY · Campaign requirements achieved.";
  if(state.completed)status="CAMPAIGN 1 COMPLETE · Free practice remains available, or load the next campaign later.";
  $("campaignStatus").textContent=status;
  renderCampaign2Readiness();
  renderDailyKey();
  renderGrowthTree();
  renderReleaseInfo();
  renderFocusWidgets();
}
function showScreen(id){["startScreen","statsScreen","leagueScreen","coachScreen","gameScreen","endScreen","errorsScreen"].forEach(x=>$(x).classList.toggle("hidden",x!==id));window.scrollTo(0,0);}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function missionOverlay(show=true){const el=$("missionOverlay");if(!el)return null;el.classList.toggle("hidden",!show);el.setAttribute("aria-hidden",show?"false":"true");return el;}
async function showLevelIntro(finalMode,target){
  const el=missionOverlay(true),last=state.sessionHistory.filter(x=>x.mode==="training").slice(-1)[0];if(!el)return;
  el.className="mission-overlay intro";const rank=finalMode?14:valueLevel((target||0)/15);el.style.setProperty("--mission-accent",valueColor(rank/15));
  const lastDelta=last&&Number.isFinite(last.target)?last.correct-last.target:null,lastLine=last?`LAST ${last.correct}/15${lastDelta==null?"":` · ${lastDelta>=0?"+":""}${lastDelta.toFixed(1)} VS TARGET`}`:"FIRST LEVEL";
  $("missionBody").innerHTML=`<div class="mission-eyebrow">${finalMode?"FINAL CHALLENGE":`LEVEL ${state.level}`}</div><div class="mission-title">${finalMode?"FINAL RUN":"TARGET"}</div><div class="mission-score" style="color:${finalMode?valueTextColor(13/15):valueTextColor((target||0)/15)}">${finalMode?"READY":`${target.toFixed(1)}<small>/15</small>`}</div><div class="mission-meta">${lastLine}</div><div class="mission-rules">15 QUESTIONS · 10s</div>`;
  for(const n of [3,2,1]){$("missionCount").textContent=String(n);$("missionCount").classList.remove("pop");void $("missionCount").offsetWidth;$("missionCount").classList.add("pop");playCountdownStep(n);await wait(820);}
  $("missionCount").textContent="GO";tone(1318.5,.09,.022,"sine");await wait(320);missionOverlay(false);
}
function leagueFlashHtml(s){
  const moves=Object.entries(s.rankMoves||{}).map(([id,delta])=>({id,delta,name:skillLabel(id)})).filter(x=>x.delta).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  if(!moves.length)return `<div class="league-flash"><div class="league-flash-title">SKILL LEAGUE · MATCHDAY</div><div class="league-steady">— NO POSITION CHANGES</div></div>`;
  const up=moves.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,3),down=moves.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,3),best=up[0],worst=down[0],row=(x,good)=>`<div class="league-flash-row ${good?"up":"down"}"><strong>${good?"▲":"▼"}${Math.abs(x.delta)}</strong><span>${escapeHtml(x.name)}</span></div>`,star=(x,good)=>x?`<div class="league-star ${good?"up":"down"}"><small>${good?"TOP RISER":"TOP FALLER"}</small><b>${good?"▲":"▼"}${Math.abs(x.delta)}</b><span>${escapeHtml(x.name)}</span></div>`:"";
  return `<div class="league-flash"><div class="league-flash-title">SKILL LEAGUE · MATCHDAY</div><div class="league-stars">${star(best,true)}${star(worst,false)}</div><div class="league-flash-grid"><div>${up.map(x=>row(x,true)).join("")||'<div class="league-none">NO RISERS</div>'}</div><div>${down.map(x=>row(x,false)).join("")||'<div class="league-none">NO FALLERS</div>'}</div></div></div>`;
}

async function showLevelResolution(s,before){
  const el=missionOverlay(true);if(!el)return;const finalClear=s.mode==="final"&&s.accuracy>=.85&&s.avgMs<=6000,hit=s.mode==="final"?finalClear:s.target!=null&&s.correct>=s.target;
  el.className=`mission-overlay resolution ${hit?"hit":"miss"}`;el.style.setProperty("--mission-accent",hit?COLOR_BANDS_15[14]:COLOR_BANDS_15[3]);
  const d=s.target==null?null:s.correct-s.target,aiChange=before&&Number.isFinite(before.aiLevel)&&before.aiLevel!==s.aiLevel?`<div class="mission-change" style="color:${valueTextColor(s.aiLevel/15)}">AI RANK ${before.aiLevel} → ${s.aiLevel}</div>`:"",leagueChange=leagueFlashHtml(s);
  $("missionBody").innerHTML=`<div class="mission-eyebrow">${s.mode==="final"?(hit?"FINAL CLEARED":"FINAL NOT CLEARED"):(hit?"TARGET CLEARED":"TARGET MISSED")}</div><div class="mission-score">${s.correct}<small>/${s.total}</small></div>${s.target==null?"":`<div class="mission-targetline">TARGET ${s.target.toFixed(1)} · <b>${d>=0?"+":""}${d.toFixed(1)}</b></div>`}<div class="mission-meta">${s.mode==="training"?`LEVEL ${s.level} → ${state.level}`:`${Math.round(s.accuracy*100)}% · ${fmtSec(s.avgMs)}`}</div>${aiChange}${leagueChange}`;
  $("missionCount").textContent=hit?"CLEAR":"REVIEW";playLevelScore(s.correct,s.total);await wait(3450);missionOverlay(false);
}
function adaptiveLevelTarget(plan){
  if(!Array.isArray(plan)||!plan.length)return null;
  const training=state.sessionHistory.filter(x=>x.mode==="training"&&Number.isFinite(x.correct)&&Number.isFinite(x.total)).slice(-8),recentExpected=training.length?mean(training.map(x=>15*x.correct/x.total)):15*(state.history.length?overallStats().accuracy:.50),globalAcc=state.history.length?overallStats().accuracy:.50;
  const expected=plan.reduce((sum,q)=>{const m=state.metrics[q.cat],rows=state.history.filter(r=>r.cat===q.cat).slice(-20),recent=rows.length?rows.filter(r=>r.correct).length/rows.length:null;let p=recent!=null&&rows.length>=5?.55*recent+.45*metricMastery(m):.68*metricMastery(m)+.32*globalAcc;const info=seenInfo(q);if(!info)p-=.045;else if(info.lastCorrect===false)p-=.055;else if(info.lastCorrect===true)p+=.02;return sum+clamp(p,.12,.92);},0);
  const planExpected=15*expected/plan.length,baseline=.58*planExpected+.42*recentExpected,stretch=training.length>=4?.55:.35;
  return clamp(Math.round((baseline+stretch)*2)/2,3.5,14.5);
}
async function startSession(finalMode=false){
  applyRatingTheme(overallStats().rating);
  const raw=finalMode?buildFinalPlan():buildTrainingPlan();
  const target=finalMode?null:adaptiveLevelTarget(raw),abortSnapshot=JSON.stringify(state);
  session={mode:finalMode?"final":"training",level:state.level,index:0,correct:0,automatic:0,times:[],records:[],usedDisplayNames:new Set(),target,plan:raw.map(shuffleOptions),abortSnapshot,rankBefore:skillRankPositions()};
  $("sessionLevel").innerHTML=finalMode?"FINAL":`L${state.level}<small class="level-target">TARGET ${target.toFixed(1)}</small>`;
  await showLevelIntro(finalMode,target);showScreen("gameScreen");nextQuestion();
}
function abortSession(){
  if(!session)return;
  clearInterval(timerHandle);deadline=0;locked=true;missionOverlay(false);
  const focusKeep={times:{...(state.focusTimeByDate||{})},targets:{...(state.focusTargetsByDate||{})},started:state.focusTrackingStartedAt};
  const snapshot=session.abortSnapshot;session=null;current=null;
  const f=$("feedback");if(f)f.classList.remove("show");hideCorrectReveal();document.body.classList.remove("feedback-correct","feedback-wrong");
  if(snapshot){try{const restored=JSON.parse(snapshot);state=validProgressState(restored)?normaliseProgressState(restored):restored;state.focusTimeByDate=focusKeep.times;state.focusTargetsByDate=focusKeep.targets;state.focusTrackingStartedAt=focusKeep.started;save();}catch(e){console.error("Emergency exit rollback failed",e);}}
  locked=false;renderStart();showScreen("startScreen");
}
function renderSegments(left){
  const n=Math.ceil(left);
  [...$("segments").children].forEach((e,i)=>e.classList.toggle("on",i<n));
}
function startTimer(){
  clearInterval(timerHandle);deadline=performance.now()+TIME_LIMIT*1000;lastTickShown=TIME_LIMIT+1;lastUrgentBeat=-1;
  timerHandle=setInterval(()=>{
    const left=Math.max(0,(deadline-performance.now())/1000),shown=Math.ceil(left);
    $("timerText").textContent=left.toFixed(1);
    $("timer").style.setProperty("--timer-cut",`${100-left/TIME_LIMIT*100}%`);$("timer").classList.toggle("urgent",left<=3);
    renderSegments(left);
    if(left>3&&shown<lastTickShown&&shown>0&&shown<TIME_LIMIT){playTick(false,shown);lastTickShown=shown;}
    if(left<=3&&left>0){const beat=left>2?Math.floor((3-left)*2):100+Math.floor((2-left)*4);if(beat!==lastUrgentBeat){lastUrgentBeat=beat;playUrgentTimerPulse(left,beat);}}
    if(left<=0){clearInterval(timerHandle);answer(-1,true);}
  },50);
}
function nextQuestion(){
  locked=false;hideCorrectReveal();
  if(session.index>=session.plan.length){finishSession();return;}
  current=session.plan[session.index];
  if(!current||!Array.isArray(current.display)||current.display.length!==4||!Number.isInteger(current.correctPos)||current.correctPos<0||current.correctPos>3){console.error("Skipping invalid question",current);session.index++;setTimeout(nextQuestion,0);return;}
  $("qIndex").textContent=session.index+1;$("qTotal").textContent="/ "+session.plan.length;
  const view=visibleCard(current);current.visibleQuestion=view.question;current.visibleOptions=view.options;current.visibleFocus=view.focus;current.visibleNames=view.names;
  $("questionText").classList.remove("focus-active");$("questionText").textContent=view.question;
  const wrap=$("answers");wrap.innerHTML="";
  current.display.forEach((txt,i)=>{const b=document.createElement("button");b.className="answer";b.textContent=view.options[i];b.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"){e.preventDefault();answer(i,false);}});b.addEventListener("click",()=>answer(i,false));wrap.appendChild(b);});
  $("timerText").textContent=TIME_LIMIT.toFixed(1);$("timer").classList.remove("urgent");renderSegments(TIME_LIMIT);startTimer();
}
function feedback(ok,type,sec,correct,appearance,patternAppearance,phraseCorrect=0,phraseWrong=0,cat="",trigger=""){
  const f=$("feedback"),skill=skillLabel(cat);f.className="feedback "+(ok?"ok":"no");
  f.innerHTML=`<div class="feedback-record" aria-label="${phraseCorrect} correctas y ${phraseWrong} incorrectas"><span class="record-good"><i>✓</i><b>${phraseCorrect}</b></span><span class="record-bad"><i>×</i><b>${phraseWrong}</b></span><small>PREGUNTA ×${appearance} · PATRÓN ×${patternAppearance} · ${sec.toFixed(2)}s</small></div>${trigger?`<div class="feedback-skill-tag"><b>${escapeHtml(trigger)}</b><span> · ✓${phraseCorrect} · ×${phraseWrong}</span></div>`:skill?`<div class="feedback-skill-tag">${escapeHtml(skill)}</div>`:""}`;
  requestAnimationFrame(()=>f.classList.add("show"));
  const hold=ok?510:(type==="fast-wrong"?1165:type==="timeout"?1060:1020);setTimeout(()=>f.classList.remove("show"),hold);
}
function answer(pos,timeout=false){
  if(locked)return;locked=true;clearInterval(timerHandle);
  const sec=timeout?TIME_LIMIT:Math.max(.05,(TIME_LIMIT*1000-(deadline-performance.now()))/1000);
  const ok=pos===current.correctPos&&!timeout,type=outcomeType(ok,sec,current.targetTime||3.6,timeout);
  const buttons=[...$("answers").children];
  buttons.forEach((b,i)=>{b.disabled=true;b.classList.remove("good","bad","dim");if(i===current.correctPos)b.classList.add("good");else b.classList.add("dim");});
  if(!ok&&pos>=0){buttons[pos].classList.remove("dim");buttons[pos].classList.add("bad");}
  const previousSeen=state.seen[current.fingerprint]||null,previousTemplate=state.templateSeen[current.templateId]||null,speedScore=updateMetric(current,ok,sec,type),info=previousSeen||{count:0,lastLevel:-99,lapses:0};
  const appearance=info.count+1,patternAppearance=(previousTemplate?.count||0)+1,lapses=(info.lapses||0)+(ok?0:1),priorPhraseRows=state.history.filter(x=>x.qid===current.id),phraseCorrect=priorPhraseRows.filter(x=>x.correct).length+(ok?1:0),phraseWrong=priorPhraseRows.filter(x=>!x.correct).length+(ok?0:1);
  const now=Date.now(),intervalDays=reviewIntervalDays(previousSeen,type);
  state.seen[current.fingerprint]={count:appearance,lastLevel:state.level,lastTs:now,lastCorrect:ok,lapses,intervalDays,nextDueTs:now+intervalDays*86400000};state.templateLast[current.templateId]=state.level;state.templateSeen[current.templateId]={count:patternAppearance,lastLevel:state.level,lastTs:now};
  const shownQuestion=current.visibleQuestion||current.q,shownOptions=current.visibleOptions||current.display,load=promptLoadMeta(shownQuestion);
  const rec={level:state.level,qid:current.id,cat:current.cat,skill:current.skill,templateId:current.templateId,domain:current.domain,correct:ok,ms:Math.round(sec*1000),type,speedScore,occurrence:appearance,patternOccurrence:patternAppearance,review:!!previousSeen,gap:previousSeen?state.level-previousSeen.lastLevel:null,ts:Date.now(),question:shownQuestion,originalQuestion:current.q,userAnswer:pos>=0?shownOptions[pos]:"No answer",correctAnswer:shownOptions[current.correctPos],rule:current.rule,promptWords:load.words,promptChars:load.chars,readingLoad:load.band,targetTimeSec:current.targetTime||3.6,timeLimitSec:TIME_LIMIT,sessionMode:session.mode};
  if(!ok){hideCorrectReveal();showMemoryEcho(current.cat,rec.correctAnswer);}else hideCorrectReveal();
  try{flashGrammarFocus(shownQuestion,rec.correctAnswer,current.visibleFocus||current.focus||[]);}catch(e){console.error("Grammar focus flash failed",e);}
  state.history.push(rec);state.history=state.history.slice(-12000);state.activeTrainingMs=(state.activeTrainingMs||0)+rec.ms;state.totalAttempts++;if(ok)state.totalCorrect=(state.totalCorrect||0)+1;session.records.push(rec);session.times.push(sec);if(ok)session.correct++;if(type==="automatic")session.automatic++;
  const answeredIndex=session.index,delay=ok?555:(type==="fast-wrong"?1200:type==="timeout"?1095:1060);setTimeout(()=>{if(!session||session.index!==answeredIndex)return;session.index++;try{nextQuestion();}catch(e){console.error("Question advance recovered",e);locked=false;setTimeout(nextQuestion,120);}},delay);
  try{save();}catch(e){console.error("Progress save failed",e);}try{applyRatingTheme(overallStats().rating);}catch(e){console.error(e);}try{if(ok)playCorrect();else playWrong();}catch(e){console.error("Audio failed",e);}try{haptic(ok);pulseFeedback(ok);if(ok&&pos>=0)burstParticles(buttons[pos]);}catch(e){console.error("Tactile feedback failed",e);}try{feedback(ok,type,sec,rec.correctAnswer,appearance,patternAppearance,phraseCorrect,phraseWrong,current.cat,current.trigger);}catch(e){console.error("Feedback failed",e);}
}
async function finishSession(){
  clearInterval(timerHandle);
  const completedLevel=state.level,n=session.records.length,accuracy=session.correct/n,avgMs=Math.round(mean(session.records.map(r=>r.ms))),auto=session.automatic/n;
  const before=state.sessionHistory.length?state.sessionHistory[state.sessionHistory.length-1]:null;
  state.sessions++;if(session.mode==="training"){state.level++;syncGlobalLevel(state.level);}
  let st=overallStats();
  const rankAfter=skillRankPositions(),rankMoves={};for(const s of CAMPAIGN.skills){const beforeRank=session.rankBefore?.[s.id]||rankAfter[s.id],afterRank=rankAfter[s.id],delta=beforeRank-afterRank;if(delta)rankMoves[s.id]=delta;}
  const snap={level:completedLevel,ts:Date.now(),mode:session.mode,correct:session.correct,total:n,accuracy,avgMs,automatic:auto,mastery:st.mastery,coverage:st.coverage,fluency:st.fluency,rating:st.rating,target:session.target,targetDelta:session.target==null?null:session.correct-session.target,targetHit:session.target==null?null:session.correct>=session.target,rankMoves,leagueEvents:leagueEvents(session.rankBefore,rankAfter)};
  state.sessionHistory.push(snap);
  const aiNow=aiValorationStats();snap.aiScore=aiNow.score;snap.aiLevel=aiNow.level;snap.aiConfidence=aiNow.confidence;
  state.personalBestFluency=Math.max(state.personalBestFluency||0,st.rating);
  if(session.mode==="final"){
    state.finalAttempts=(state.finalAttempts||0)+1;
    if(accuracy>=.85&&avgMs<=6000)state.completed=true;
  }
  save();lastSessionHandoffText=sessionHandoffJsonText(snap,session?.records||[]);renderEnd(snap,before);setEndHandoffStatus(false,false);await showLevelResolution(snap,before);showScreen("endScreen");
}
function renderEnd(s,before){
  const st=overallStats(),sg=stageInfo(st.coverage),rb=ratingBand(st.rating),ai=aiValorationStats();
  setEndHandoffStatus(false,false);
  applyRatingTheme(st.rating);applyAiTheme(ai);
  $("endAiLevel").textContent=`${ai.level} / 15`;paintText("endAiLevel",ai.score/100);
  $("endAiConfidence").textContent=`AI Valoration · evidencia ${Math.round(ai.confidence*100)}%`;paintText("endAiConfidence",ai.confidence);
  $("aiLegend").innerHTML=aiLegendHtml(ai.level);
  renderCampaign2Readiness();
  renderPracticeEstimateMini("endCampaignPracticeEstimate");
  $("endKicker").textContent=s.mode==="final"?"FINAL CHALLENGE":`LEVEL ${s.level} COMPLETE`;
  const targetHit=s.target==null?null:s.correct>=s.target,targetDelta=s.target==null?null:s.correct-s.target;
  $("endScore").textContent=`${s.correct}/${s.total} · ${pct(s.accuracy)}%`;$("endScore").style.color=valueTextColor(s.accuracy);
  const targetEl=$("endTarget");if(targetEl){targetEl.className=`target-result ${targetHit==null?"hidden":targetHit?"hit":"miss"}`;targetEl.innerHTML=targetHit==null?"":`<span>TARGET ${s.target.toFixed(1)}</span><b>${targetDelta>=0?"+":""}${targetDelta.toFixed(1)}</b><small>${targetHit?"TARGET BEATEN":"TARGET MISSED"}</small>`;}
  $("endSub").textContent=`AE RATING ${pct(st.rating)} · ${rb.name} · ${sg.name} · ${activeSeenCount().toLocaleString()}/${BANK.length.toLocaleString()} explored`;
  $("eAvg").textContent=fmtSec(s.avgMs);$("eAuto").textContent=pct(s.automatic)+"%";paintText("eAuto",s.automatic);$("eFluency").textContent=pct(st.rating);paintText("eFluency",st.rating);
  $("eCoverage").textContent=pct(st.coverage)+"%";paintText("eCoverage",st.coverage);$("eMastery").textContent=pct(st.mastery)+"%";paintText("eMastery",st.mastery);$("eMastered").textContent=`${st.mastered}/${CAMPAIGN.skills.length}`;paintText("eMastered",st.mastered/CAMPAIGN.skills.length);
  $("dAcc").innerHTML=before?deltaText((s.accuracy-before.accuracy)*100,true," pts"):'<span class="delta neutral">First level</span>';
  $("dTime").innerHTML=before?deltaText((s.avgMs-before.avgMs)/1000,false,"s"):'<span class="delta neutral">First level</span>';
  $("dFlu").innerHTML=before?deltaText((st.rating-(before.rating??before.fluency))*100,true," pts"):'<span class="delta neutral">First level</span>';
  const learning=learningScoreStats();
  $("learningScore").textContent=learning.current==null?"—":learning.current.toFixed(1);if(learning.current!=null){$("learningScore").style.color=valueTextColor(learning.current/100);$("learningScore").closest(".learning-score-box").style.borderColor=valueColor(learning.current/100);}
  const ld=$("learningScoreDelta");
  if(learning.delta==null){ld.className="learning-direction neutral";ld.textContent="→ Primera media";ld.style.color="#b7c9bf";}
  else {const up=learning.delta>.05,down=learning.delta<-.05;ld.className=`learning-direction ${up?"good":down?"bad":"neutral"}`;ld.textContent=`${up?"↑":down?"↓":"→"} ${learning.delta>=0?"+":""}${learning.delta.toFixed(1)}`;ld.style.color=semanticDeltaColor(learning.delta,true);}
  $("learningScoreWindow").textContent=`Curva longitudinal · ${learning.windowSize} vs ${learning.windowSize} niveles`;
  renderLevelLesson(session.records);
  const trend=state.sessionHistory.filter(x=>x.mode==="training");
  $("accuracyChart").innerHTML=sessionScoreChart(trend,false);
  $("learningTrendChart").innerHTML=sparkline(learningCurveSeries(),v=>`${v.toFixed(1)}`,false,learning.start,"Start");
  const phraseStats=phraseExposureStats();
  $("ePhrasesDone").textContent=phraseStats.unique.toLocaleString();paintText("ePhrasesDone",st.coverage);
  $("eRepeats").textContent=phraseStats.repeatedUnique.toLocaleString();
  $("eBankTotal").textContent=BANK.length.toLocaleString();
  $("weakSkills").innerHTML=skillLeagueHtml(rankedSkills(),true);
  const wrong=session.records.filter(r=>!r.correct),errorGroups=levelErrorGroups(wrong),labToggle=$("endErrorLabToggle");
  if(labToggle){labToggle.classList.toggle("hidden",wrong.length===0);const m=$("endErrorLabToggleMeta");if(m)m.textContent=wrong.length?`${wrong.length} ${wrong.length===1?"error":"errors"} · ${errorGroups.length} ${errorGroups.length===1?"skill":"skills"}`:"No errors";}
  const errorsLabel=`ERROR LAB · ${wrong.length}`;$("errorsBtn").textContent=errorsLabel;$("topErrorsBtn").textContent=errorsLabel;
  $("errorsBtn").classList.toggle("hidden",wrong.length===0);$("topErrorsBtn").classList.toggle("hidden",wrong.length===0);
  $("errorsCount").textContent=wrong.length?`${wrong.length} ${wrong.length===1?"error":"errors"} in Level ${s.level} · ${errorGroups.length} ${errorGroups.length===1?"skill":"skills"}`:`No errors in Level ${s.level}`;
  if(wrong.length)renderErrorLab(wrong,"errorsFull");else $("errorsFull").innerHTML='<p class="meta">No errors in this level.</p>';
  const nextLabel=state.completed?"KEEP TRAINING":`NEXT LEVEL · ${state.level}`;$("continueBtn").textContent=nextLabel;$("topContinueBtn").textContent=nextLabel;
  const finalHidden=!(st.eligible&&!state.completed);$("finalBtn").classList.toggle("hidden",finalHidden);$("topFinalBtn").classList.toggle("hidden",finalHidden);
  if(s.mode==="final"&&!state.completed)$("endSub").textContent=`Final challenge not passed yet · ${pct(s.accuracy)}% · ${fmtSec(s.avgMs)}`;
  if(state.completed)$("endSub").textContent="CAMPAIGN 1 COMPLETE";
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function exportProgress(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`adaptive-english-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
}
function importProgress(file){
  const r=new FileReader();r.onload=()=>{try{const s=JSON.parse(r.result);if(!validProgressState(s))throw Error("Invalid progress schema");state=normaliseProgressState(s);save();renderStart();alert("Progress imported.");}catch(e){console.error("Progress import rejected",e);alert("This progress file is not valid for Campaign 1.");}};r.readAsText(file);
}
function resetProgress(){
  if(confirm("Reset all Campaign 1 progress? Export a backup first if you want to keep it.")){localStorage.removeItem(STORAGE_KEY);state=newState();save();renderStart();}
}

function validQuestion(q){
  const opts=q?.a;
  if(!Array.isArray(opts)||opts.length!==4||!Number.isInteger(q.c)||q.c<0||q.c>=opts.length)return false;
  const norm=opts.map(x=>String(x).trim().toLocaleLowerCase("en"));
  return new Set(norm).size===norm.length;
}

async function boot(){
  applyVisualSystemTokens();
  CAMPAIGN=await loadCampaign();
  const before=CAMPAIGN.questions.length;
  CAMPAIGN.questions=CAMPAIGN.questions.filter(validQuestion);
  for(const skill of CAMPAIGN.skills)skill.name=learningTerminology(skill.name);
  for(const q of CAMPAIGN.questions){q.skill=learningTerminology(q.skill);q.rule=learningTerminology(q.rule);q.trigger=learningTerminology(q.trigger);}
  if(CAMPAIGN.questions.length!==before)console.warn(`Adaptive B2 Cloze skipped ${before-CAMPAIGN.questions.length} invalid question(s) with duplicate/broken options.`);
  BANK=CAMPAIGN.questions;state=loadState();startFocusTracking();save();
  const seg=$("segments");for(let i=0;i<10;i++){const d=document.createElement("div");d.className="seg";seg.appendChild(d);}
  $("startBtn").onclick=async()=>{await ensureAudio();await startSession(false);};
  $("statsBtn").onclick=()=>{renderStatsScreen();showScreen("statsScreen");};
  $("scoreExpandBtn").onclick=()=>{const rows=state.sessionHistory.filter(x=>x.mode==="training");$("scoreExpandedChart").innerHTML=sessionScoreChart(rows,true);$("scoreModal").classList.remove("hidden");};
  $("scoreCloseBtn").onclick=()=>$("scoreModal").classList.add("hidden");
  $("scoreModal").onclick=e=>{if(e.target===$("scoreModal"))$("scoreModal").classList.add("hidden");};
  $("coachBtn").onclick=()=>{renderCoachScreen();showScreen("coachScreen");};
  $("statsBackBtn").onclick=()=>{renderStart();showScreen("startScreen");};
  $("leagueBackBtn").onclick=()=>{renderStatsScreen();showScreen("statsScreen");};
  $("coachGenerateBtn").onclick=()=>copyGlobalCoachJson($("coachGenerateBtn"));if($("coachPromptCopy"))$("coachPromptCopy").onclick=copyCoachPrompt;$("coachBackBtn").onclick=()=>{renderStart();showScreen("startScreen");};
  if($("endCopyHandoffBtn"))$("endCopyHandoffBtn").onclick=copyEndSessionHandoff;if($("errorsSessionCopyBtn"))$("errorsSessionCopyBtn").onclick=()=>copySessionErrorsJson($("errorsSessionCopyBtn"));
  for(const id of ["statsTopDashboardBtn","leagueTopDashboardBtn","coachTopDashboardBtn","errorsTopDashboardBtn"]){const b=$(id);if(b)b.onclick=()=>{renderStart();showScreen("startScreen");};}
  const continueFromEnd=async()=>{await ensureAudio();if(state.completed){renderStart();showScreen("startScreen");}else await startSession(false);};$("continueBtn").onclick=continueFromEnd;$("topContinueBtn").onclick=continueFromEnd;
  const finalFromEnd=async()=>{await ensureAudio();await startSession(true);};$("finalBtn").onclick=finalFromEnd;$("topFinalBtn").onclick=finalFromEnd;
  $("soundBtn").onclick=async()=>{soundOn=!soundOn;if(soundOn){await ensureAudio();tone(760,.06,.025,'sine');}refreshSoundButton();};
  $("abortSessionBtn").onclick=abortSession;
  refreshSoundButton();
  $("exportBtn").onclick=exportProgress;$("importBtn").onclick=()=>$("importFile").click();
  $("importFile").onchange=e=>e.target.files[0]&&importProgress(e.target.files[0]);
  const goDashboard=()=>{renderStart();showScreen("startScreen");};
  const openErrorLab=()=>showScreen("errorsScreen");
  $("resetBtn").onclick=resetProgress;$("campaign2Copy").onclick=copyCampaign2Brief;$("homeBtn").onclick=goDashboard;$("topHomeBtn").onclick=goDashboard;
  $("errorsBtn").onclick=openErrorLab;$("topErrorsBtn").onclick=openErrorLab;$("endErrorLabToggle").onclick=openErrorLab;
  $("errorsBackBtn").onclick=()=>showScreen("endScreen");
  renderStart();showScreen("startScreen");
}
boot().catch(err=>{console.error(err);document.body.innerHTML='<div style="padding:30px;color:white;font-family:system-ui"><h1>Adaptive B2 Cloze</h1><p>Could not load Campaign 1.</p></div>';});
