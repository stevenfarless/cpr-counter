'use strict';
(function(){
 const Core=globalThis.CadenceCore;
 const $=id=>document.getElementById(id);
 const els={pulse:$('pulse'),round:$('simRound'),count:$('simCount'),denominator:$('simDenominator'),phase:$('simPhase'),rate:$('simRate'),elapsed:$('simElapsed'),output:$('simOutput'),json:$('simJson'),bpm:$('simBpm'),mode:$('simMode'),preview:$('simPreview')};
 let raf=0,previewStart=0,previewOffset=0,previewRunning=false;
 function period(){return 60/Math.max(100,Math.min(120,Number(els.bpm.value)||110));}
 function show(elapsedSeconds,label){
  const mode=els.mode.value,snap=Core.snapshot(elapsedSeconds,period(),mode);
  els.rate.textContent=(Number(els.bpm.value)||110)+' compressions / min';
  // Elapsed 0 is the pre-cue state: no cue has been shown yet.
  els.count.textContent=elapsedSeconds<=0?'—':(snap.count||'—');
  els.denominator.style.visibility=mode==='cycles'?'visible':'hidden';
  els.phase.textContent=elapsedSeconds<=0?'Ready':snap.phase==='breaths'?'2 breaths — awaiting dispatcher':snap.phase==='lead'?'Ready':'Compressions';
  els.pulse.style.opacity=snap.pulse?'1':'0';
  els.elapsed.textContent='Elapsed: '+elapsedSeconds.toFixed(1)+' s';
  els.json.textContent=JSON.stringify({scenario:label,mode,elapsedSeconds:+elapsedSeconds.toFixed(3),snapshot:snap},null,2);
  els.output.textContent='Scenario: '+label+'. Count '+snap.count+', phase '+snap.phase+'.';
 }
 function stopPreview(){
  cancelAnimationFrame(raf);previewRunning=false;
  els.preview.setAttribute('aria-pressed','false');els.preview.textContent='Run live preview';
 }
 function scenario(offsetSeconds,label){
  stopPreview();previewOffset=offsetSeconds;show(offsetSeconds,label);
 }
 function previewTick(now){
  if(!previewRunning)return;
  if(!previewStart)previewStart=now;
  show(previewOffset+(now-previewStart)/1000,'live preview from '+previewOffset.toFixed(1)+' s');
  raf=requestAnimationFrame(previewTick);
 }
 $('simCue28').addEventListener('click',()=>scenario(27*period(),'near boundary — cue 28'));
 $('simBoundary').addEventListener('click',()=>scenario(30*period(),'cue 30 boundary'));
 $('simBreath').addEventListener('click',()=>scenario(30*period()+2,'breath phase, 2 s after cue 30'));
 $('simContinuous45').addEventListener('click',()=>{
  els.mode.value='continuous';scenario(44*period(),'continuous cue 45');
 });
 $('simPreview').addEventListener('click',()=>{
  if(previewRunning){stopPreview();return;}
  previewRunning=true;previewStart=0;
  els.preview.setAttribute('aria-pressed','true');els.preview.textContent='Stop live preview';
  raf=requestAnimationFrame(previewTick);
 });
 $('simReset').addEventListener('click',()=>{
  stopPreview();previewOffset=0;els.mode.value='cycles';els.bpm.value='110';
  els.round.textContent='Round 1';show(0,'reset — cue 0');
 });
 show(0,'ready');
})();
