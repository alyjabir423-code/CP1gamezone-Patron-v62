// Historique prive Patron / partage Gerant — version 27
const CACHE='gamezone-bah-v65-20261016-tuya11-patron-serveur-push';
const ASSETS=['./','./index.html','./manifest.webmanifest','./management.js?v=tuya11','./custom-time.js?v=tuya11'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(r=>{
      const copy=r.clone(); caches.open(CACHE).then(c=>c.put('./index.html',copy)); return r;
    }).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{
    const copy=r.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return r;
  })));
});

// Notifications push: nécessite un abonnement Push enregistré côté serveur et un envoi authentifié.
self.addEventListener('push', event => {
  let payload={};
  try { payload=event.data ? event.data.json() : {}; } catch (_) { payload={body:event.data ? event.data.text() : ''}; }
  const title=String(payload.title||'GameZone Bah');
  const options={body:String(payload.body||'Nouvel événement GameZone'),tag:String(payload.eventId||payload.tag||'gamezone-event'),renotify:true,vibrate:[200,100,250],requireInteraction:!!payload.important,data:{url:payload.url||'./'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    for(const client of windows){if(client.url.startsWith(self.registration.scope)){await client.focus();return;}}
    return self.clients.openWindow(target);
  }));
});
