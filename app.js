/* CPR Counter — replacement app.js based on the originally generated app.
   Counter-only operation is allowed. Compatible with the optional update-manager.js.
   Unvalidated prototype: requires browser and workstation validation. */
'use strict';
const VERSION='2.3.0', Core=globalThis.CadenceCore;
const ids=['offline','network','lockStatus','panel','pulse','round','count','denominator','phase','rateLabel','breathTime','action','stop','message','configSummary','settingsDetails','bpm','minus','plus','mode','theme','sound','visual','volume','gainValue','showBreathTime','testSound','install','fullscreen','update','refreshOffline'];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let state='idle',round=1,count=0,mode='cycles',sound=false,visual=true;
let ctx=null,master=null,tone=null,epoch=0,period=60/110,nextBeat=0,raf=0,lastFrame=0,lastPulse=null,lastBreathSecond=-1;
let generation=0,releaseLock=null,wake=null,installPrompt=null,testNode=null;
let lastLongFrame=0; // rAF timestamp of the last long gap (0 = none yet)
const sources=new Set();
function message(text){el.message.textContent=text;}
function active(){return ['starting','compressions','breaths'].includes(state);}
function save(){
 try{localStorage.setItem('cadence-prefs',JSON.stringify({theme:el.theme.value,volume:Number(el.volume.value),showBreathTimer:el.showBreathTime.checked}));}catch{}
}
try{
 const prefs=JSON.parse(localStorage.getItem('cadence-prefs')||'{}');
 if(prefs&&['teal','blue','sage','lavender','amber'].includes(prefs.theme))el.theme.value=prefs.theme;
 if(prefs&&Number.isFinite(prefs.volume)&&prefs.volume>=.05&&prefs.volume<=.7)el.volume.value=prefs.volume;
 if(prefs&&prefs.showBreathTimer===false)el.showBreathTime.checked=false;
}catch{}
document.body.dataset.theme=el.theme.value;
// Compact configuration summary: BPM, mode, and outputs. Shows "Counter only"
// exactly when both sound and visual pulse are off.
function summaryText(){
 const bpm=el.bpm.value||'110';
 const modeText=el.mode.value==='cycles'?'30:2':'Continuous';
 const outputs=!sound&&!visual?'Counter only':(sound?'Sound on':'Sound off')+' · '+(visual?'Visual pulse on':'Visual pulse off');
 return bpm+' BPM · '+modeText+' · '+outputs;
}
function render(){
 const busy=active();
 for(const id of ['bpm','minus','plus','mode'])el[id].disabled=busy;
 el.action.disabled=state==='starting'||state==='compressions';
 // Labels name the next action: fresh start, new session after a stop,
 // restart after a fault. Counting and breath labels are unchanged.
 el.action.textContent=state==='starting'?'Starting…':state==='compressions'?'Compressions running':state==='breaths'?'Resume compressions':state==='fault'?'Restart session':state==='stopped'?'Start new session':'Start round 1';
 el.action.classList.toggle('resume',state==='breaths');
 el.stop.disabled=!busy;
 el.round.textContent=mode==='cycles'?'Round '+round:'Continuous cadence';
 // Visibility (not display) keeps the count width and panel layout fixed
 // when the denominator or breath timer is not shown.
 el.denominator.classList.toggle('vis-hidden',mode!=='cycles');
 el.count.textContent=count||'—';
 el.count.dataset.digits=String(count||'—').length;
 el.phase.textContent=state==='breaths'?'2 breaths — awaiting dispatcher':state==='compressions'?'Compressions':state==='starting'?'Starting':state==='fault'?'Interrupted — stopped':state==='stopped'?'Stopped':'Ready';
 el.panel.classList.toggle('breath',state==='breaths');
 el.breathTime.classList.toggle('vis-hidden',!(state==='breaths'&&el.showBreathTime.checked));
 el.configSummary.textContent=summaryText();
 for(const [id,on] of [['sound',sound],['visual',visual]]){
  el[id].setAttribute('aria-pressed',String(on));
  el[id].querySelector('span').textContent=on?'On':'Off';
 }
 el.volume.disabled=!sound;
 el.gainValue.textContent=Math.round(Number(el.volume.value)*100)+'%';
 el.testSound.disabled=busy;
 el.update.disabled=busy;
 el.refreshOffline.disabled=busy;
}
function cancelAudio(){
 for(const node of sources){try{node.stop();}catch{}node.disconnect();}
 sources.clear();
 if(testNode){try{testNode.stop();}catch{}testNode.disconnect();testNode=null;}
}
function stop(reason='Stopped. The round and count are preserved until you press Start new session.',fault=false){
 generation++;
 state=fault?'fault':'stopped';
 cancelAnimationFrame(raf);
 cancelAudio();
 el.pulse.style.opacity='0';
 if(releaseLock){releaseLock();releaseLock=null;}
 if(wake){const old=wake;wake=null;old.release().catch(()=>{});}
 render();message(reason);
}
async function prepareAudio(){
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)throw Error('Web Audio is unavailable.');
 if(!ctx||ctx.state==='closed'){
  ctx=new Audio({latencyHint:'interactive'});
  master=ctx.createGain();master.connect(ctx.destination);
  ctx.addEventListener('statechange',()=>{
   if(active()&&state!=='starting'&&ctx.state!=='running')stop('Audio clock interrupted. Explicit restart required.',true);
  });
  const length=Math.ceil(ctx.sampleRate*.035);
  tone=ctx.createBuffer(1,length,ctx.sampleRate);
  const data=tone.getChannelData(0);
  for(let i=0;i<length;i++){
   const t=i/ctx.sampleRate;
   data[i]=Math.sin(2*Math.PI*880*t)*Math.min(1,t/.002)*Math.pow(1-i/length,3);
  }
 }
 await ctx.resume();
 if(ctx.state!=='running')throw Error('Audio clock did not start.');
 master.gain.setValueAtTime(sound?Number(el.volume.value):0,ctx.currentTime);
}
async function acquireLock(token){
 if(!navigator.locks){el.lockStatus.textContent='Duplicate-instance lock unavailable';return;}
 await new Promise((resolve,reject)=>{
  navigator.locks.request('cpr-cadence-session',{ifAvailable:true},lock=>{
   if(!lock){reject(Error('Another CPR Counter window is already running a session on this browser profile. Use that window, or close it and try again.'));return;}
   if(token!==generation){resolve();return;}
   return new Promise(release=>{releaseLock=release;resolve();});
  }).catch(reject);
 });
}
async function requestWake(token){
 if(!navigator.wakeLock)return;
 try{
  const lock=await navigator.wakeLock.request('screen');
  if(token!==generation||!active()){await lock.release();return;}
  wake=lock;
  lock.addEventListener('release',()=>{
   if(wake===lock){wake=null;if(active())message('Keep the screen awake. Display wake lock released.');}
  });
 }catch{if(active())message('Keep the screen awake. Display wake lock unavailable.');}
}
function validate(){
 const n=Number(el.bpm.value),valid=Core.validBpm(n);
 el.bpm.setCustomValidity(valid?'':'Enter a whole number from 100 to 120.');
 if(valid)el.rateLabel.textContent=n+' compressions / min';
 el.configSummary.textContent=summaryText();
 return valid;
}
function beginRound(){
 cancelAudio();epoch=ctx.currentTime+.10;nextBeat=0;lastFrame=0;lastPulse=null;lastBreathSecond=-1;lastLongFrame=0;
 // Settings collapse when a session (re)starts; they stay inspectable.
 el.settingsDetails.open=false;
 count=0;state='compressions';render();raf=requestAnimationFrame(tick);
}
async function start(){
 if(active())return;
 if(!validate()){el.bpm.reportValidity();return;}
 // Sound and visual pulse may both be off; the numeric counter remains active.
 if(document.hidden){message('Make this window visible before starting.');return;}
 const token=++generation;state='starting';render();
 try{
  await prepareAudio();if(token!==generation)return;
  await acquireLock(token);if(token!==generation)return;
  if(document.hidden)throw Error('Window became hidden.');
  mode=el.mode.value;period=60/Number(el.bpm.value);round=1;
  beginRound();message('');requestWake(token);
 }catch(error){if(token===generation)stop('Session did not start: '+error.message+' Press Restart session to try again.',true);}
}
function queueBeat(time){
 const node=ctx.createBufferSource();node.buffer=tone;node.connect(master);sources.add(node);
 node.onended=()=>{sources.delete(node);node.disconnect();};node.start(time);
}
function tick(now){
 if(state!=='compressions'&&state!=='breaths')return;
 if(document.hidden||ctx.state!=='running'){
  stop('Session stopped — the window was hidden or the audio clock was interrupted. Press Restart session to begin again.',true);return;
 }
 const clock=ctx.currentTime;
 if(lastFrame){
  // One long frame is a workstation stall, not a failure: cues are
  // scheduled ahead on the audio clock and still play. Fault only when
  // the interruption repeats — a second long frame within 5 s — or on a
  // freeze over a second. A cue that actually goes undelivered still
  // faults immediately via the missed-cue check below.
  // There is deliberately no audio/frame clock-drift check here:
  // measured drift samples up to ~282 ms occur on normal 17 ms frames
  // (the audio clock advances in bursts), so instantaneous drift is
  // noise, not a timing failure. Audio-clock interruption is already
  // caught by the statechange listener above.
  const gap=now-lastFrame;
  if(gap>250){
   if(lastLongFrame&&now-lastLongFrame<5000){stop('Session stopped — cue timing was interrupted. Press Restart session to begin again.',true);return;}
   lastLongFrame=now;
  }
  if(gap>1000){stop('Session stopped — cue timing was interrupted. Press Restart session to begin again.',true);return;}
 }
 lastFrame=now;
 if(state==='compressions'){
  const snapshot=Core.snapshot(clock-epoch,period,mode);
  const limit=mode==='cycles'?30:Infinity;
  if(nextBeat<limit&&epoch+nextBeat*period<clock-.025){
   stop('Session stopped — a scheduled cue was missed. Press Restart session to begin again.',true);return;
  }
  // Schedule 400 ms ahead, so a stall up to ~375 ms cannot leave a cue
  // unqueued: the cue was already scheduled and plays on time. Longer
  // stalls still fault via the missed-cue check above. Stop cancels
  // queued tones, so the longer window does not delay stopping.
  while(nextBeat<limit&&epoch+nextBeat*period<clock+.40){
   // Keep the timing path unchanged in muted/counter-only operation.
   queueBeat(epoch+nextBeat*period);nextBeat++;
  }
  if(snapshot.phase==='breaths'){
   state='breaths';count=30;el.pulse.style.opacity='0';lastPulse='0';render();
   message('Give 2 breaths, then press Resume compressions when the caller returns to compressions.');
  }else{
   if(snapshot.count!==count){count=snapshot.count;el.count.textContent=count||'—';el.count.dataset.digits=String(count).length;}
   // Only touch the pulse style when its state actually changes.
   const opacity=visual&&snapshot.pulse?'1':'0';
   if(opacity!==lastPulse){el.pulse.style.opacity=opacity;lastPulse=opacity;}
  }
 }
 if(state==='breaths'){
  // Whole seconds only, updated when the second changes, measured from
  // the last scheduled compression cue (cue 30 at epoch + 29 periods).
  const since=Math.floor(Math.max(0,clock-(epoch+29*period)));
  if(since!==lastBreathSecond){lastBreathSecond=since;el.breathTime.textContent='Since last cue: '+since+' s';}
 }
 raf=requestAnimationFrame(tick);
}
el.action.addEventListener('click',event=>{
 if(event.detail>1)return;
 if(state==='breaths'){
  if(document.hidden||ctx.state!=='running'){stop('Session stopped — the audio clock is unavailable, so the session cannot resume. Press Restart session to begin again.',true);return;}
  cancelAnimationFrame(raf);round++;beginRound();message('');
 }else if(!active())start();
});
for(const button of document.querySelectorAll('button')){
 button.addEventListener('keydown',event=>{
  if(event.repeat&&(event.key===' '||event.key==='Enter'))event.preventDefault();
 });
}
el.stop.addEventListener('click',()=>stop());
el.bpm.addEventListener('input',validate);
for(const [id,delta] of [['minus',-1],['plus',1]]){
 el[id].addEventListener('click',()=>{
  const n=Number(el.bpm.value);
  el.bpm.value=Math.max(100,Math.min(120,(Number.isFinite(n)?Math.round(n):110)+delta));validate();
 });
}
el.mode.addEventListener('change',()=>{mode=el.mode.value;count=0;round=1;render();});
el.showBreathTime.addEventListener('change',()=>{save();render();});
el.sound.addEventListener('click',()=>{
 sound=!sound;
 if(master)master.gain.setTargetAtTime(sound?Number(el.volume.value):0,ctx.currentTime,.005);
 render();
});
el.visual.addEventListener('click',()=>{
 visual=!visual;if(!visual)el.pulse.style.opacity='0';render();
});
el.theme.addEventListener('change',()=>{document.body.dataset.theme=el.theme.value;save();});
el.volume.addEventListener('input',()=>{
 if(master&&sound)master.gain.setTargetAtTime(Number(el.volume.value),ctx.currentTime,.005);
 save();render();
});
el.testSound.addEventListener('click',async()=>{
 if(active())return;
 if(!sound){message('Enable Sound first, then test the selected output device.');return;}
 const token=generation;
 try{
  await prepareAudio();if(active()||token!==generation)return;
  cancelAudio();const node=ctx.createBufferSource();testNode=node;
  node.buffer=tone;node.connect(master);
  node.onended=()=>{node.disconnect();if(testNode===node)testNode=null;};
  node.start(ctx.currentTime+.03);
  message('Test tone requested. Confirm that you heard it on the intended device.');
 }catch(error){message('Sound test failed: '+error.message);}
});
el.fullscreen.addEventListener('click',async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
 }catch{message('Full screen unavailable. Maximize this window instead.');}
});
document.addEventListener('fullscreenchange',()=>{
 el.fullscreen.textContent=document.fullscreenElement?'Exit full screen':'Full screen';
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&active())stop('Session stopped — the window was hidden. Press Restart session to begin again.',true);
});
// Only stop a live session on pagehide/restore; an idle page must keep its
// Ready state and message instead of flipping to Stopped.
window.addEventListener('pagehide',()=>{if(active())stop();});
window.addEventListener('beforeunload',event=>{
 if(active()){event.preventDefault();event.returnValue='';}
});
window.addEventListener('pageshow',event=>{
 if(event.persisted&&active())stop('Session stopped — the page was restored. Press Restart session to begin again.',true);
});
window.addEventListener('error',()=>{if(active())stop('Session stopped — an application error occurred. Press Restart session to begin again.',true);});
window.addEventListener('unhandledrejection',()=>{if(active())stop('Session stopped — an unexpected error occurred. Press Restart session to begin again.',true);});
function network(){el.network.textContent=navigator.onLine?'Network reported online':'Network reported offline';}
window.addEventListener('online',network);window.addEventListener('offline',network);network();
el.lockStatus.textContent=navigator.locks?'Same-profile session lock available':'Duplicate-instance lock unavailable';
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();installPrompt=event;el.install.hidden=false;
});
el.install.addEventListener('click',async()=>{
 if(active()){message('Stop the session before installing.');return;}
 if(installPrompt){await installPrompt.prompt();installPrompt=null;el.install.hidden=true;}
});
window.addEventListener('appinstalled',()=>{el.install.hidden=true;});

validate();render();
// In short landscape the panel and primary controls come first; keep
// Settings collapsed there so Start/Stop stay reachable without scrolling.
if(window.matchMedia('(max-height: 520px) and (orientation: landscape)').matches)el.settingsDetails.open=false;
