/* CPR Counter update UI. Loaded after app.js; relies on the original app globals. */
'use strict';
(() => {
 const RELEASE='2.1.0', PROTOCOL=1;
 let reg=null, checking=false, applying=false, pending=null;
 const details=document.getElementById('appDetails')||document.querySelector('main details');
 const main=document.querySelector('main');
 if(!details||!main)return;
 const style=document.createElement('style');
 style.textContent=`#releaseBanner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid #7baeb0;background:#1b3338;border-radius:12px;padding:10px 14px;margin:16px 0;font-size:.9rem}#releaseBanner[hidden]{display:none!important}#releaseBanner button{min-height:40px;padding:8px 14px}.release-controls{margin:14px 0}.release-status{font-size:.82rem;line-height:1.5;color:#b4c6d0;min-height:1.5em}`;
 document.head.append(style);
 const banner=document.createElement('div');banner.id='releaseBanner';banner.hidden=true;
 const label=document.createElement('span');label.setAttribute('role','status');label.setAttribute('aria-live','polite');
 // Keep the existing element and ID used by render().
 const apply=document.getElementById('update');
 if(!apply)return;
 apply.textContent='Update now';banner.append(label,apply);
 const header=main.querySelector('header');if(header)header.after(banner);else main.prepend(banner);
 const controls=document.createElement('div');controls.className='release-controls';
 const check=document.createElement('button');check.type='button';check.textContent='Check for updates';
 const status=document.createElement('p');status.className='release-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Installed release '+RELEASE;
 controls.append(check,status);details.append(controls);
 const offline=document.getElementById('offline');
 const offlineButton=document.getElementById('refreshOffline');
 function busy(){return active();}
 function rpc(worker,data,timeout=5000){
  return new Promise((resolve,reject)=>{
   if(!worker){reject(Error('No service worker is available.'));return;}
   const ch=new MessageChannel();const timer=setTimeout(()=>{ch.port1.close();reject(Error('Update check timed out.'));},timeout);
   ch.port1.onmessage=e=>{clearTimeout(timer);ch.port1.close();resolve(e.data);};
   try{worker.postMessage(data,[ch.port2]);}catch(e){clearTimeout(timer);ch.port1.close();reject(e);}
  });
 }
 function newer(a,b){
  if(!/^\d+\.\d+\.\d+$/.test(a)||!/^\d+\.\d+\.\d+$/.test(b))return false;
  const aa=a.split('.').map(Number),bb=b.split('.').map(Number);
  for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i];}return false;
 }
 function draw(){
  banner.hidden=!pending;apply.hidden=!pending;
  if(!pending)return;
  apply.disabled=busy()||applying;
  apply.textContent=applying?'Updating…':'Update now';
  label.textContent=busy()?'Update ready · Available after stopping':'Update ready · v'+pending.version;
 }
 async function inspectWaiting(){
  const worker=reg?.waiting;
  if(!worker){pending=null;draw();return false;}
  const info=await rpc(worker,{type:'RELEASE_INFO'});
  if(info.protocol!==PROTOCOL||!info.ready)throw Error('Downloaded update could not be verified.');
  if(!newer(info.version,RELEASE)){pending=null;draw();return false;}
  pending={worker,version:info.version};draw();return true;
 }
 async function verifyOffline(){
  if(!offline)return;
  offline.textContent='Checking cached files…';if(offlineButton)offlineButton.disabled=true;
  try{
   const info=await rpc(navigator.serviceWorker.controller,{type:'RELEASE_INFO'});
   offline.textContent=info.ready&&info.version===RELEASE?'Offline files verified · v'+RELEASE:'Offline files not verified for this release';
  }catch{offline.textContent='Offline setup incomplete or check failed';}
  finally{if(offlineButton)offlineButton.disabled=busy();}
 }
 async function checkUpdates(manual=false){
  if(checking||applying)return;checking=true;check.disabled=true;
  if(manual){check.textContent='Checking…';status.textContent='Checking for updates…';}
  try{
   if(!reg)throw Error('Offline/update setup is not ready.');
   await reg.update();
   const installing=reg.installing;
   if(installing)await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{installing.removeEventListener('statechange',changed);reject(Error('Download is taking longer than expected.'));},30000);
    function changed(){if(['installed','redundant'].includes(installing.state)){clearTimeout(timer);installing.removeEventListener('statechange',changed);installing.state==='installed'?resolve():reject(Error('Update download failed.'));}}
    installing.addEventListener('statechange',changed);changed();
   });
   const found=await inspectWaiting();
   status.textContent=found?'Update downloaded and ready.':"You’re up to date · v"+RELEASE;
  }catch(e){status.textContent='Couldn’t check for updates. '+e.message;}
  finally{checking=false;check.disabled=false;check.textContent='Check for updates';}
 }
 navigator.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type==='CAN_ACTIVATE_RELEASE'){
   event.ports[0]?.postMessage({protocol:PROTOCOL,idle:!busy(),version:RELEASE});
  }
 });
 apply.addEventListener('click',async()=>{
  if(!pending||busy()||applying)return;
  if(!navigator.locks){status.textContent='Safe in-app updating is unavailable in this browser. Stop all sessions, close all CPR Counter windows, then reopen while online.';return;}
  applying=true;draw();
  try{
   await navigator.locks.request('cpr-cadence-session',{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another CPR Counter session is active. Stop it before updating.');
    if(busy())throw Error('Stop this session before updating.');
    // Keep this instance idle even if a control event occurs during activation.
    document.getElementById('action').disabled=true;
    const target=pending;
    const result=await rpc(target.worker,{type:'ACTIVATE_RELEASE',version:target.version},8000);
    if(!result.ok)throw Error(result.reason||'Close other app windows and try again.');
    status.textContent='Activating downloaded release…';
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('Activation not confirmed. Close all app windows and reopen.'));},10000);
     function changed(){if(navigator.serviceWorker.controller===target.worker){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}}
     navigator.serviceWorker.addEventListener('controllerchange',changed);changed();
    });
    location.reload();
   });
  }catch(e){status.textContent=e.message;}
  finally{applying=false;render();draw();}
 });
 check.addEventListener('click',()=>checkUpdates(true));
 offlineButton?.addEventListener('click',verifyOffline);
 // Observe the app's Stop state changes without replacing its control handlers.
 new MutationObserver(draw).observe(document.getElementById('stop'),{attributes:true,attributeFilter:['disabled']});
 async function init(){
  if(!('serviceWorker'in navigator)||!isSecureContext){status.textContent='Updates require HTTPS or localhost.';check.disabled=true;if(offline)offline.textContent='Offline unavailable · use HTTPS or localhost';return;}
  try{
   reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
   reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;worker?.addEventListener('statechange',()=>{
     if(worker.state==='installed')inspectWaiting().then(found=>{if(found)status.textContent='Update downloaded and ready.';}).catch(e=>{status.textContent=e.message;});
    });
   });
   navigator.serviceWorker.addEventListener('controllerchange',()=>{verifyOffline();inspectWaiting().catch(()=>{});});
   await navigator.serviceWorker.ready;await verifyOffline();await checkUpdates(false);
   setInterval(()=>{if(!document.hidden)checkUpdates(false);},60000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdates(false);});
   window.addEventListener('online',()=>checkUpdates(false));
  }catch(e){status.textContent='Update setup failed. '+e.message;if(offline)offline.textContent='Offline registration or check failed';}
 }
 init();
})();
