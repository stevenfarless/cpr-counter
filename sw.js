/* CPR Counter release worker. Deploy all files atomically. */
'use strict';
const VERSION='2.4.0',PROTOCOL=1,CACHE='cpr-counter-'+VERSION;
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
/* Bounded retention (#16): keep this release and the previous one, and
   delete older version caches. Activation only happens after every open
   window confirmed it is idle, and claim() puts those windows under this
   worker, so nothing still needs the older caches — their fetches are
   served from the current cache or the network. A pruning failure must
   not break activation, so it is swallowed; the caches stay until the
   next activation retries. */
function parseVersion(name){
 const m=/^cpr-counter-(\d+)\.(\d+)\.(\d+)$/.exec(name);
 return m?m.slice(1).map(Number):null;
}
async function pruneOldCaches(){
 const versioned=(await caches.keys())
  .map(n=>[n,parseVersion(n)]).filter(([,v])=>v);
 versioned.sort((a,b)=>{
  for(let i=0;i<3;i++)if(a[1][i]!==b[1][i])return b[1][i]-a[1][i];
  return 0;
 });
 const keep=new Set(versioned.slice(0,2).map(([n])=>n));
 await Promise.all(versioned.filter(([n])=>!keep.has(n)).map(([n])=>caches.delete(n)));
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 try{await pruneOldCaches();}catch{}
})()));
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
  // Storage can be unavailable or corrupted; preserve online loading when cache access fails.
  try{
   const cache=await caches.open(CACHE),key=request.mode==='navigate'?absolute('./index.html'):request;
   return await cache.match(key)||fetch(request);
  }catch{return fetch(request);}
 })());
});
// Old version caches are pruned on activation (see pruneOldCaches):
// only the current and previous releases are retained.
