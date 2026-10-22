/* Scoped English Cloze navigation: reuse the Hub's original live controls. */
(()=>{
  'use strict';
  function mount(){
    const bar=document.querySelector('.adrian-tools');
    if(!bar || bar.classList.contains('cloze-nav-compact')) return !!bar;
    bar.classList.add('cloze-nav-compact');
    if(!bar.id)bar.id='cloze-shared-toolbar';
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='cloze-nav-toggle';
    toggle.setAttribute('aria-label','Mostrar navegación y opciones del Hub');
    toggle.setAttribute('aria-controls',bar.id);
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent='☰ Menú';
    bar.prepend(toggle);
    function setOpen(open){
      bar.classList.toggle('cloze-nav-open',!!open);
      toggle.setAttribute('aria-expanded',String(!!open));
      toggle.setAttribute('aria-label',open?'Ocultar navegación y opciones del Hub':'Mostrar navegación y opciones del Hub');
      toggle.textContent=open?'✕ Cerrar':'☰ Menú';
    }
    toggle.addEventListener('click',()=>setOpen(!bar.classList.contains('cloze-nav-open')));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bar.classList.contains('cloze-nav-open')){setOpen(false);toggle.focus();}});
    document.addEventListener('pointerdown',e=>{if(bar.classList.contains('cloze-nav-open')&&!bar.contains(e.target))setOpen(false);});
    // The shared controls retain all their original onclick/href behavior.
    const game=document.getElementById('gameScreen');
    if(game)new MutationObserver(()=>{if(!game.classList.contains('hidden'))setOpen(false);}).observe(game,{attributes:true,attributeFilter:['class']});
    // Key Diary renders before its collapsible panel is visible. Recalculate
    // the active slide after opening, when the carousel has a measurable width.
    const extras=document.getElementById('homeLearningExtras');
    // Preserve the always-visible diary/tree on desktop; collapse on phones.
    if(extras && window.matchMedia('(max-width:760px)').matches)extras.open=false;
    extras?.addEventListener('toggle',()=>{
      if(extras.open)requestAnimationFrame(()=>{
        if(typeof window.renderDailyKey==='function')window.renderDailyKey();
      });
    });
    setOpen(false);
    return true;
  }
  function boot(){
    if(mount())return;
    const obs=new MutationObserver(()=>{if(mount())obs.disconnect();});
    obs.observe(document.body,{childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
