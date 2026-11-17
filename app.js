'use strict';
const VERSION='2.0.0', Core=globalThis.CadenceCore;
const ids=['offline','network','lockStatus','panel','pulse','round','count','denominator','phase','rateLabel','breathTime','action','stop','message','bpm','minus','plus','mode','theme','sound','visual','volume','gainValue','testSound','install','fullscreen','update','refreshOffline'];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let state='idle',round=1,count=0,mode='cycles',sound=false,visual=true;
let ctx=null,master=null,tone=null,epoch=0,period=60/110,nextBeat=0,raf=0,lastFrame=0,lastClock=0;
let generation=0,releaseLock=null,wake=null,installPrompt=null,registration=null,testNode=null;
const sources=new Set();
function message(s){el.message.textContent=s;}
function save(){try{localStorage.setItem('cadence-prefs',JSON.stringify({theme:el.theme.value,volume:Number(el.volume.value)}));}catch{}}
try{const p=JSON.parse(localStorage.getItem('cadence-prefs')||'{}');if(['teal','blue','sage','lavender','amber'].includes(p.theme))el.theme.value=p.theme;if(Number.isFinite(p.volume)&&p.volume>=.05&&p.volume<=.7)el.volume.value=p.volume;}catch{}
document.body.dataset.theme=el.theme.value;
function active(){return ['starting','compressions','breaths'].includes(state);}
function render(){
 const busy=active();
 for(const id of ['bpm','minus','plus','mode'])el[id].disabled=busy;
 el.action.disabled=state==='starting'||state==='compressions';
 el.action.textContent=state==='starting'?'Starting…':state==='compressions'?'Compressions running':state==='breaths'?'Resume compressions': 'Start · Round 1';
 el.action.classList.toggle('resume',state==='breaths');el.stop.disabled=!busy;
 el.round.textContent=mode==='cycles'?'Round '+round:'Continuous cadence';
 el.denominator.hidden=mode!=='cycles';
 el.count.textContent=count||'—';
 el.phase.textContent=state==='breaths'?'2 breaths — awaiting dispatcher':state==='compressions'?'Compressions':state==='starting'?'Starting':state==='fault'?'Interrupted — stopped':state==='stopped'?'Stopped':'Ready';
 el.panel.classList.toggle('breath',state==='breaths');
 el.breathTime.hidden=state!=='breaths';
 for(const [id,on] of [['sound',sound],['visual',visual]]){el[id].setAttribute('aria-pressed',String(on));el[id].querySelector('span').textContent=on?'On':'Off';}
 el.volume.disabled=!sound;el.gainValue.textContent=Math.round(Number(el.volume.value)*100)+'%';
 el.testSound.disabled=busy;el.update.disabled=busy;el.refreshOffline.disabled=busy;
}
function cancelAudio(){
 for(const node of sources){try{node.stop();}catch{}node.disconnect();}sources.clear();
 if(testNode){try{testNode.stop();}catch{}testNode=null;}
}
function stop(reason='Stopped. A new Start resets the round and cue count.',fault=false){
 generation++;state=fault?'fault':'stopped';cancelAnimationFrame(raf);cancelAudio();el.pulse.style.opacity=0;
 if(releaseLock){releaseLock();releaseLock=null;}
 if(wake){const old=wake;wake=null;old.release().catch(()=>{});}
 render();message(reason);
}
async function prepareAudio(){
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)throw Error('Web Audio is unavailable.');
 if(!ctx||ctx.state==='closed'){
  ctx=new Audio({latencyHint:'interactive'});master=ctx.createGain();master.connect(ctx.destination);
  ctx.addEventListener('statechange',()=>{if(active()&&state!=='starting'&&ctx.state!=='running')stop('Audio clock interrupted. Explicit restart required.',true);});
  const len=Math.ceil(ctx.sampleRate*.035);tone=ctx.createBuffer(1,len,ctx.sampleRate);const data=tone.getChannelData(0);
  for(let i=0;i<len;i++){const t=i/ctx.sampleRate;data[i]=Math.sin(2*Math.PI*880*t)*Math.min(1,t/.002)*Math.pow(1-i/len,3);}
 }
 await ctx.resume();if(ctx.state!=='running')throw Error('Audio clock did not start.');
 master.gain.setValueAtTime(sound?Number(el.volume.value):0,ctx.currentTime);
}
async function acquireLock(token){
 if(!navigator.locks){el.lockStatus.textContent='Duplicate-instance lock unavailable';return;}
 await new Promise((resolve,reject)=>{
  navigator.locks.request('cpr-cadence-session',{ifAvailable:true},lock=>{
   if(!lock){reject(Error('Another window in this browser profile is running.'));return;}
   if(token!==generation){resolve();return;}
   return new Promise(release=>{releaseLock=release;resolve();});
  }).catch(reject);
 });
}
async function requestWake(token){
 if(!navigator.wakeLock)return;
 try{const lock=await navigator.wakeLock.request('screen');if(token!==generation||!active()){await lock.release();return;}wake=lock;lock.addEventListener('release',()=>{if(wake===lock){wake=null;if(active())message('Display wake lock released. Keep the screen awake.');}});}catch{if(active())message('Wake lock unavailable. Keep the screen awake and this window visible.');}
}
function validate(){const n=Number(el.bpm.value),ok=Core.validBpm(n);el.bpm.setCustomValidity(ok?'':'Enter a whole number from 100 to 120.');if(ok)el.rateLabel.textContent=n+' compressions / min';return ok;}
function beginRound(){
 cancelAudio();epoch=ctx.currentTime+.10;nextBeat=0;lastFrame=0;lastClock=ctx.currentTime;count=0;state='compressions';render();raf=requestAnimationFrame(tick);
}
async function start(){
 if(active())return;
 if(!validate()){el.bpm.reportValidity();return;}
 if(!visual&&!sound){message('Enable sound or visual pulse before starting.');return;}
 if(document.hidden){message('Make this window visible before starting.');return;}
 const token=++generation;state='starting';render();
 try{
  // Resume audio within the user interaction before waiting for the instance lock.
  await prepareAudio();if(token!==generation)return;
  await acquireLock(token);if(token!==generation)return;
  if(document.hidden)throw Error('Window became hidden.');
  mode=el.mode.value;period=60/Number(el.bpm.value);round=1;beginRound();
  message('Running. Count follows scheduled cues; verify the caller’s actions.');requestWake(token);
 }catch(e){if(token===generation)stop('Unable to start: '+e.message,true);}
}
function queueBeat(time){
 const node=ctx.createBufferSource();node.buffer=tone;node.connect(master);sources.add(node);
 node.onended=()=>{sources.delete(node);node.disconnect();};node.start(time);
}
function tick(now){
 if(state!=='compressions'&&state!=='breaths')return;
 if(document.hidden||ctx.state!=='running'){stop('Window hidden or audio clock interrupted. Explicit restart required.',true);return;}
 const clock=ctx.currentTime;
 if(lastFrame&&(now-lastFrame>250||Math.abs((clock-lastClock)*1000-(now-lastFrame))>150)){stop('Timing interruption detected. Check the workstation, then restart.',true);return;}
 lastFrame=now;lastClock=clock;
 if(state==='compressions'){
  const snapshot=Core.snapshot(clock-epoch,period,mode);
  // A missed deadline is a fault; never rush out overdue tones.
  const limit=mode==='cycles'?30:Infinity;
  if(nextBeat<limit&&epoch+nextBeat*period<clock-.025){stop('A cue scheduling deadline was missed. Explicit restart required.',true);return;}
  while(nextBeat<limit&&epoch+nextBeat*period<clock+.18){queueBeat(epoch+nextBeat*period);nextBeat++;}
  if(snapshot.phase==='breaths'){
   state='breaths';count=30;el.pulse.style.opacity=0;render();message('Awaiting dispatcher. Click Resume compressions when the caller returns to compressions.');
  }else{
   if(snapshot.count!==count){count=snapshot.count;el.count.textContent=count||'—';}
   el.pulse.style.opacity=visual&&snapshot.pulse?'1':'0';
  }
 }
 if(state==='breaths')el.breathTime.textContent='Time since last compression cue: '+Math.max(0,clock-(epoch+29*period)).toFixed(1)+' s';
 raf=requestAnimationFrame(tick);
}
el.action.addEventListener('click',event=>{
 if(event.detail>1)return;
 if(state==='breaths'){
  if(document.hidden||ctx.state!=='running'){stop('Cannot resume: output clock unavailable.',true);return;}
  cancelAnimationFrame(raf);round++;beginRound();message('Round '+round+' started.');
 }else if(!active())start();
});
// Suppress repeat activation while a key is held, without document-wide shortcuts.
for(const button of document.querySelectorAll('button'))button.addEventListener('keydown',e=>{if(e.repeat&&(e.key===' '||e.key==='Enter'))e.preventDefault();});
el.stop.addEventListener('click',()=>stop());
el.bpm.addEventListener('input',validate);
for(const [id,delta]of [['minus',-1],['plus',1]])el[id].addEventListener('click',()=>{const n=Number(el.bpm.value);el.bpm.value=Math.max(100,Math.min(120,(Number.isFinite(n)?Math.round(n):110)+delta));validate();});
el.mode.addEventListener('change',()=>{mode=el.mode.value;count=0;round=1;render();});
el.sound.addEventListener('click',()=>{
 if(sound&&active()&&!visual){message('Enable visual pulse before disabling the only active cue.');return;}
 sound=!sound;if(master)master.gain.setTargetAtTime(sound?Number(el.volume.value):0,ctx.currentTime,.005);render();
 if(sound)message('Sound enabled. Use Test sound while stopped to check the physical output.');
});
el.visual.addEventListener('click',()=>{if(visual&&active()&&!sound){message('Enable sound before disabling the only active cue.');return;}visual=!visual;if(!visual)el.pulse.style.opacity=0;render();});
el.theme.addEventListener('change',()=>{document.body.dataset.theme=el.theme.value;save();});
el.volume.addEventListener('input',()=>{if(master&&sound)master.gain.setTargetAtTime(Number(el.volume.value),ctx.currentTime,.005);save();render();});
el.testSound.addEventListener('click',async()=>{
 if(active())return;if(!sound){message('Enable Sound first, then test the selected output device.');return;}
 const token=generation;
 try{await prepareAudio();if(active()||token!==generation)return;cancelAudio();testNode=ctx.createBufferSource();testNode.buffer=tone;testNode.connect(master);testNode.start(ctx.currentTime+.03);message('Test tone requested. Confirm that you heard it on the intended device.');}catch(e){message('Sound test failed: '+e.message);}
});
el.fullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('Full screen unavailable. Maximize this window instead.');}});
document.addEventListener('fullscreenchange',()=>{el.fullscreen.textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())stop('Window hidden. Session stopped; explicit restart required.',true);});
window.addEventListener('pagehide',()=>stop());
window.addEventListener('beforeunload',event=>{if(active()){event.preventDefault();event.returnValue='';}});
window.addEventListener('pageshow',event=>{if(event.persisted)stop('Page restored. Explicit restart required.',true);});
window.addEventListener('error',()=>{if(active())stop('Application error. Session stopped.',true);});
window.addEventListener('unhandledrejection',()=>{if(active())stop('Unexpected asynchronous error. Session stopped.',true);});
function network(){el.network.textContent=navigator.onLine?'Network reported online':'Network reported offline';}
window.addEventListener('online',network);window.addEventListener('offline',network);network();
el.lockStatus.textContent=navigator.locks?'Same-profile session lock available':'Duplicate-instance lock unavailable';
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;el.install.hidden=false;});
el.install.addEventListener('click',async()=>{if(active()){message('Stop the session before installing.');return;}if(installPrompt){await installPrompt.prompt();installPrompt=null;el.install.hidden=true;}});
window.addEventListener('appinstalled',()=>{el.install.hidden=true;});
async function checkOffline(){
 if(!navigator.serviceWorker?.controller){el.offline.textContent='Offline readiness not verified';return;}
 el.offline.textContent='Checking cached files…';
 const channel=new MessageChannel();
 const result=await new Promise(resolve=>{const timeout=setTimeout(()=>resolve(null),4000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data);};navigator.serviceWorker.controller.postMessage({type:'VERIFY'},[channel.port2]);});
 channel.port1.close();
 el.offline.textContent=result?.ready&&result.version===VERSION?'Offline files verified · v'+VERSION:'Offline files not verified';
}
el.refreshOffline.addEventListener('click',checkOffline);
async function setupWorker(){
 if(!('serviceWorker'in navigator)||!window.isSecureContext){el.offline.textContent='Offline unavailable · use HTTPS or localhost';return;}
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  function waiting(){el.update.hidden=!registration.waiting;}
  waiting();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();});});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{checkOffline().catch(()=>{el.offline.textContent='Offline check failed';});});
  await navigator.serviceWorker.ready;await checkOffline();
 }catch{el.offline.textContent='Offline registration or check failed';}
}
el.update.addEventListener('click',()=>{
 if(active()){message('Stop before updating.');return;}
 if(!registration?.waiting)return;
 // This page reloads only following this explicit stopped-state action.
 const listener=()=>{if(!active())location.reload();};
 navigator.serviceWorker.addEventListener('controllerchange',listener,{once:true});
 registration.waiting.postMessage({type:'ACTIVATE'});
});
validate();render();setupWorker();
