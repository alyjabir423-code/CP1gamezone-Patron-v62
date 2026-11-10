const AUDIO_CACHE='cp1-audio-v2';const AUDIO_FILES=["./cp1-audio-start.mp3", "./cp1-audio-pause.mp3", "./cp1-audio-resume.mp3", "./cp1-audio-add.mp3", "./cp1-audio-subtract.mp3", "./cp1-audio-save.mp3", "./cp1-audio-restore.mp3", "./cp1-audio-off.mp3", "./cp1-audio-confirmed.mp3", "./cp1-audio-error.mp3", "./cp1-audio-five.mp3", "./cp1-audio-finish.mp3", "./cp1-audio-test.mp3"];
// Audio caching is optional: one missing MP3 must not block notifications.
self.addEventListener('install',e=>e.waitUntil(
  caches.open(AUDIO_CACHE).then(c=>Promise.allSettled(AUDIO_FILES.map(file=>c.add(file))))
    .catch(()=>{}).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(/\/cp1-audio-[a-z]+\.mp3$/.test(u.pathname)){e.respondWith(caches.open(AUDIO_CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));}else e.respondWith(fetch(e.request,{cache:'no-store'}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(async rows=>{const row=rows.find(x=>x.url.startsWith(self.registration.scope));if(row)return row.focus();return self.clients.openWindow(self.registration.scope);}));});


