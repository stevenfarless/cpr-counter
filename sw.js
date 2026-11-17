'use strict';
const VERSION='2.0.0', CACHE='cpr-cadence-'+VERSION;
const ASSETS=['./','./index.html','./styles.css','./core.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const url=p=>new URL(p,self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(p=>new Request(url(p),{cache:'reload'})));})());});
// First installation activates normally. Updates wait for an explicit user action.
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='VERIFY')event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);const entries=await Promise.all(ASSETS.map(p=>cache.match(url(p))));event.ports[0]?.postMessage({ready:entries.every(r=>r&&r.ok),version:VERSION});}
  catch{event.ports[0]?.postMessage({ready:false,version:VERSION});}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const u=new URL(request.url);if(u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const key=request.mode==='navigate'?url('./index.html'):request;
  const hit=await cache.match(key);if(hit)return hit;
  return fetch(request);
 })());
});
// Old version caches are intentionally retained so open old clients keep their files.
// Release procedure: change VERSION in both app.js and sw.js, deploy assets atomically,
// and close all other app windows before applying the downloaded update.
