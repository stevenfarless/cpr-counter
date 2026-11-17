/* CPR Counter — replacement app.js based on the originally generated app.
   Counter-only operation is allowed. Compatible with the optional update-manager.js.
   Unvalidated prototype: requires browser and workstation validation. */
'use strict';
const VERSION='2.1.0', Core=globalThis.CadenceCore;
const ids=['offline','network','lockStatus','panel','pulse','round','count','denominator','phase','rateLabel','breathTime','action','stop','message','bpm','minus','plus','mode','theme','sound','visual','volume','gainValue','testSound','install','fullscreen','update','refreshOffline'];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let state='idle',round=1,count=0,mode='cycles',sound=false,visual=true;
let ctx=null,master=null,tone=null,epoch=0,period=60/110,nextBeat=0,raf=0,lastFrame=0,lastClock=0;
let generation=0,releaseLock=null,wake=null,installPrompt=null,registration=null,testNode=null;
const sources=new Set();
const externalUpdater=Array.from(document.scripts).some(script=>{
 try{return new URL(script.src,location.href).pathname.endsWith('/update-manager.js');}catch{return false;}
});
function message(text){el.message.textContent=text;}
function active(){return ['starting','compressions','breaths'].includes(state);}
function save(){
 try{localStorage.setItem('cadence-prefs',JSON.stringify({theme:el.theme.value,volume:Number(el.volume.value)}));}catch{}
}
try{
 const prefs=JSON.parse(localStorage.getItem('cadence-prefs')||'{}');
 if(prefs&&['teal','blue','sage','lavender','amber'].includes(prefs.theme))el.theme.value=prefs.theme;
 if(prefs&&Number.isFinite(prefs.volume)&&prefs.volume>=.05&&prefs.volume<=.7)el.volume.value=prefs.volume;
}catch{}
document.body.dataset.theme=el.theme.value;
function render(){
 const busy=active();
 for(const id of ['bpm','minus','plus','mode'])el[id].disabled=busy;
 el.action.disabled=state==='starting'||state==='compressions';
 el.action.textContent=state==='starting'?'Starting…':state==='compressions'?'Compressions running':state==='breaths'?'Resume compressions':'Start · Round 1';
 el.action.classList.toggle('resume',state==='breaths');
 el.stop.disabled=!busy;
 el.round.textContent=mode==='cycles'?'Round '+round:'Continuous cadence';
 el.denominator.hidden=mode!=='cycles';
 el.count.textContent=count||'—';
 el.phase.textContent=state==='breaths'?'2 breaths — awaiting dispatcher':state==='compressions'?'Compressions':state==='starting'?'Starting':state==='fault'?'Interrupted — stopped':state==='stopped'?'Stopped':'Ready';
 el.panel.classList.toggle('breath',state==='breaths');
 el.breathTime.hidden=state!=='breaths';
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
function stop(reason='Stopped. A new Start resets the round and cue count.',fault=false){
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
   if(!lock){reject(Error('CPR Counter is running in another window.'));return;}
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
 return valid;
}
function beginRound(){
 cancelAudio();epoch=ctx.currentTime+.10;nextBeat=0;lastFrame=0;lastClock=ctx.currentTime;
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
  beginRound();message('Running.');requestWake(token);
 }catch(error){if(token===generation)stop('Unable to start: '+error.message,true);}
}
function queueBeat(time){
 const node=ctx.createBufferSource();node.buffer=tone;node.connect(master);sources.add(node);
 node.onended=()=>{sources.delete(node);node.disconnect();};node.start(time);
}
function tick(now){
 if(state!=='compressions'&&state!=='breaths')return;
 if(document.hidden||ctx.state!=='running'){
  stop('Window hidden or clock interrupted. Press Start to restart.',true);return;
 }
 const clock=ctx.currentTime;
 if(lastFrame&&(now-lastFrame>250||Math.abs((clock-lastClock)*1000-(now-lastFrame))>150)){
  stop('Timing interrupted. Press Start to restart.',true);return;
 }
 lastFrame=now;lastClock=clock;
 if(state==='compressions'){
  const snapshot=Core.snapshot(clock-epoch,period,mode);
  const limit=mode==='cycles'?30:Infinity;
  if(nextBeat<limit&&epoch+nextBeat*period<clock-.025){
   stop('Cue timing interrupted. Press Start to restart.',true);return;
  }
  while(nextBeat<limit&&epoch+nextBeat*period<clock+.18){
   // Keep the timing path unchanged in muted/counter-only operation.
   queueBeat(epoch+nextBeat*period);nextBeat++;
  }
  if(snapshot.phase==='breaths'){
   state='breaths';count=30;el.pulse.style.opacity='0';render();
   message('Click Resume compressions when the caller returns to compressions.');
  }else{
   if(snapshot.count!==count){count=snapshot.count;el.count.textContent=count||'—';}
   el.pulse.style.opacity=visual&&snapshot.pulse?'1':'0';
  }
 }
 if(state==='breaths'){
  el.breathTime.textContent='Time since last compression cue: '+Math.max(0,clock-(epoch+29*period)).toFixed(1)+' s';
 }
 raf=requestAnimationFrame(tick);
}
el.action.addEventListener('click',event=>{
 if(event.detail>1)return;
 if(state==='breaths'){
  if(document.hidden||ctx.state!=='running'){stop('Cannot resume: clock unavailable.',true);return;}
  cancelAnimationFrame(raf);round++;beginRound();message('Round '+round+' started.');
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
 if(document.hidden&&active())stop('Window hidden. Press Start to restart.',true);
});
window.addEventListener('pagehide',()=>stop());
window.addEventListener('beforeunload',event=>{
 if(active()){event.preventDefault();event.returnValue='';}
});
window.addEventListener('pageshow',event=>{
 if(event.persisted)stop('Page restored. Press Start to restart.',true);
});
window.addEventListener('error',()=>{if(active())stop('Application error. Session stopped.',true);});
window.addEventListener('unhandledrejection',()=>{if(active())stop('Unexpected error. Session stopped.',true);});
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

// Legacy worker controls run only when update-manager.js is not included.
async function checkOffline(){
 if(!navigator.serviceWorker?.controller){el.offline.textContent='Offline readiness not verified';return;}
 el.offline.textContent='Checking cached files…';
 const channel=new MessageChannel();
 const result=await new Promise(resolve=>{
  const timeout=setTimeout(()=>resolve(null),4000);
  channel.port1.onmessage=event=>{clearTimeout(timeout);resolve(event.data);};
  navigator.serviceWorker.controller.postMessage({type:'VERIFY'},[channel.port2]);
 });
 channel.port1.close();
 el.offline.textContent=result?.ready&&result.version===VERSION?'Offline files verified · v'+VERSION:'Offline files not verified';
}
async function setupWorker(){
 el.refreshOffline.addEventListener('click',()=>checkOffline().catch(()=>{el.offline.textContent='Offline check failed';}));
 if(!('serviceWorker'in navigator)||!window.isSecureContext){
  el.offline.textContent='Offline unavailable · use HTTPS or localhost';return;
 }
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  function waiting(){el.update.hidden=!registration.waiting;}
  waiting();registration.addEventListener('updatefound',()=>{
   const worker=registration.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   checkOffline().catch(()=>{el.offline.textContent='Offline check failed';});
  });
  await navigator.serviceWorker.ready;await checkOffline();
 }catch{el.offline.textContent='Offline registration or check failed';}
 el.update.addEventListener('click',()=>{
  if(active()){message('Stop before updating.');return;}
  if(!registration?.waiting)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!active())location.reload();},{once:true});
  registration.waiting.postMessage({type:'ACTIVATE'});
 });
}
validate();render();
if(!externalUpdater)setupWorker();
