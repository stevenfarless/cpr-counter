/* CPR Counter release worker. Deploy all files atomically. */
'use strict';
const VERSION='2.1.0',PROTOCOL=1,CACHE='cpr-counter-'+VERSION;
const ASSETS=['./','./index.html','./styles.css','./core.js','./app.js','./update-manager.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const absolute=p=>new URL(p,self.registration.scope).href;
async function info(){
 const cache=await caches.open(CACHE);
 const entries=await Promise.all(ASSETS.map(p=>cache.match(absolute(p))));
 return {version:VERSION,protocol:PROTOCOL,ready:entries.every(r=>r&&r.ok)};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(ASSETS.map(p=>new Request(absolute(p),{cache:'reload'})));
 // No skipWaiting: an existing release remains in control until approved.
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function ask(client){return new Promise(resolve=>{
 const channel=new MessageChannel();
 const timer=setTimeout(()=>{channel.port1.close();resolve(false);},2000);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.protocol===PROTOCOL&&event.data?.idle===true);};
 try{client.postMessage({type:'CAN_ACTIVATE_RELEASE'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(false);}
});}
self.addEventListener('message',event=>{
 const reply=data=>event.ports[0]?.postMessage(data);
 if(event.data?.type==='RELEASE_INFO'||event.data?.type==='VERIFY')event.waitUntil(info().then(reply).catch(()=>reply({ready:false,version:VERSION,protocol:PROTOCOL})));
 if(event.data?.type==='ACTIVATE_RELEASE')event.waitUntil((async()=>{
  try{
   if(event.data.version!==VERSION||!(await info()).ready){reply({ok:false,reason:'Release verification failed.'});return;}
   const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(self.registration.scope));
   if(!clients.length||!(await Promise.all(clients.map(ask))).every(Boolean)){
    reply({ok:false,reason:'Another app window is active or cannot confirm it is idle. Stop sessions and close other windows, then retry.'});return;
   }
   reply({ok:true});await self.skipWaiting();
  }catch{reply({ok:false,reason:'Update activation failed. Close all app windows and reopen while online.'});}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=request.mode==='navigate'?absolute('./index.html'):request;
  return await cache.match(key)||fetch(request);
 })());
});
// Retain previous caches while old clients may still use them.
