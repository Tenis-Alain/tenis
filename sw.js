const C='gd-4';self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.indexOf('/datos/')>=0)return;
const net=fetch(u.href,{cache:'no-cache'}).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c)).catch(()=>{});}return r;});
e.respondWith(new Promise(res=>{let ya=false;const da=r=>{if(!ya){ya=true;res(r);}};const m=()=>caches.match(e.request,{ignoreSearch:true});
const t=setTimeout(()=>m().then(c=>{if(c)da(c);}),4000);net.then(r=>{clearTimeout(t);da(r);}).catch(()=>m().then(c=>{clearTimeout(t);da(c||Response.error());}));}));});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(x){d={b:e.data?e.data.text():''};}e.waitUntil(self.registration.showNotification(d.t||'Tenis',{body:d.b||'',icon:'icono-192.png',badge:'icono-192.png',data:{u:d.u||'./'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.u)||'./';e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c){try{c.postMessage({ir:u});}catch(x){}return c.focus();}}return clients.openWindow(u);}));});
