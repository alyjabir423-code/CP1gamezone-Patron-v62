const vm=require('vm'),fs=require('fs'),assert=require('assert'),crypto=require('crypto').webcrypto;
function fixture(dir,manager=false){
 let time=Date.parse('2026-11-05T07:50:00Z');class FakeDate extends Date{constructor(v){super(v===undefined?time:v)}static now(){return time}}
 const start=Math.floor((time-28800000)/86400000)*86400000+28800000;
 const posts=['Poste 1 ps4','Poste 2 ps4','Poste 3 ps4','Poste 4 ps2','Poste 5 ps3','Poste 6 ps3'].map((num,i)=>({num,devid:'test-'+i,type:'PS4'}));
 const key=encodeURIComponent(posts[0].num),rows=Object.fromEntries(posts.map((_,i)=>[i+1,{online:true,power:false,seenAt:time,nativeSeconds:0,mode:'libre',remaining:0}]));
 const active={actif:true,sessionId:'original-session-001',client:'Client A',finTs:time+700000,tempsTotal:780,montantSession:100,montantJourSession:100,nativeCommandId:'initial-native-command'};
 rows[1]={online:true,power:true,seenAt:time,nativeSeconds:700,mode:'actif',remaining:700,deadline:time+700000,result:{id:'initial-native-command',ok:true}};
 const root={postes:posts,active_by_poste:{[key]:active},active_postes:[structuredClone(active)],sessions:{date:new FakeDate(start).toDateString(),dayStart:start,recettes:100,count:0,parPoste:{[posts[0].num]:100}},daily:{'2026-11-03':{recettes:9999},'2026-11-04':{recettes:100,dayStart:start}},activity_daily:{'2026-11-04':{}},current_day:{key:'2026-11-04',start,until:start+86400000},config:{businessName:'CP1'},businessRevision:1};
 const db={pilotage_v1:{heartbeat:{at:time,capabilities:['command-receipts-v2','saved-time-v1']},states:rows,commands:{}},gz_GZ07732:root};let calls=[],authCalls=[],fail401=true;
 function read(path){const parts=path.split('/');let cur=parts[0]==='gz_GZ-07732'?root:db[parts[0]];for(const part of parts.slice(1))cur=cur?.[part];return cur??null;}
 function write(path,value){const parts=path.split('/');let cur=parts[0]==='gz_GZ-07732'?root:db[parts[0]];for(const part of parts.slice(1,-1))cur=cur[part]||(cur[part]={});cur[parts.at(-1)]=structuredClone(value);}
 const window={fetch:async(url,options={})=>{const u=new URL(url),path=u.pathname.replace(/^\//,'').replace(/\.json$/,'').split('/').map(decodeURIComponent).join('/'),method=options.method||'GET';calls.push({path,method});
 if(fail401){fail401=false;return {ok:false,status:401,json:async()=>null,headers:{get:()=>null}};}
 if(method==='PUT'){const value=JSON.parse(options.body);write(path,value);if(path.startsWith('pilotage_v1/commands/')){const n=path.split('/').at(-1),row=rows[n],c=value;let saved;
 if(c.action==='save'){saved=row.remaining;Object.assign(row,{power:false,nativeSeconds:0,remaining:0,mode:'libre',deadline:0});}
 if(c.action==='start'){Object.assign(row,{power:true,nativeSeconds:c.seconds,remaining:c.seconds,mode:'actif',deadline:time+c.seconds*1000});}
 if(c.action==='pause'){const left=row.remaining;Object.assign(row,{power:false,nativeSeconds:0,remaining:left,mode:'pause',deadline:0});}
 if(c.action==='off'){Object.assign(row,{power:false,nativeSeconds:0,remaining:0,mode:'libre',deadline:0});}
 row.result={id:c.id,ok:true,...(saved===undefined?{}:{savedSeconds:saved})};row.seenAt=time;
 }}else if(method==='PATCH'){for(const [k,v]of Object.entries(JSON.parse(options.body)))write(path+'/'+k,v);}else if(method==='DELETE')write(path,null);
 const value=read(path);return {ok:true,status:200,json:async()=>structuredClone(value),headers:{get:k=>k==='ETag'?'v1':new FakeDate().toUTCString()}};
 }};
 const context={window,document:{getElementById:()=>null},Date:FakeDate,Map,Set,JSON,Number,String,Object,Math,Error,AbortController,Response,crypto,console,setTimeout,clearTimeout,setInterval:()=>1};vm.runInNewContext(fs.readFileSync(dir+'/youssef-relay.js','utf8'),context);const r=window.CP1Relay;r.install({uid:()=>manager?'gerant123':r.owner,token:async force=>{authCalls.push(!!force);return 'test-only'}});
 return {r,root,posts,rows,calls,authCalls,key,setTime:stamp=>{time=stamp;db.pilotage_v1.heartbeat.at=time;Object.values(rows).forEach(s=>s.seenAt=time)}};
}
(async()=>{for(const dir of [__dirname]){
 const f=fixture(dir);await f.r.saveTime(f.posts[0]);const [id,b]=Object.entries(f.root.saved_time)[0];assert.equal(b.remainingSeconds,700);assert.equal(f.root.active_by_poste[f.key].actif,false);assert.equal(f.root.sessions.recettes,100);assert.equal(b.expiresAt,Date.parse('2026-11-05T08:00:00Z'));
 assert(f.authCalls.includes(true),'401 must refresh authentication');
 f.root.active_by_poste[f.key]={actif:true,sessionId:'client-b',client:'Client B',finTs:Date.parse('2026-11-05T07:55:00Z')};
 await assert.rejects(f.r.restoreTime(id,f.posts[0]),/occupé/);assert.equal(b.status,'saved');assert.equal(f.root.active_by_poste[f.key].client,'Client B');
 f.root.active_by_poste[f.key]={actif:false};await f.r.restoreTime(id,f.posts[0]);assert.equal(f.root.active_by_poste[f.key].client,'Client A');assert.equal(f.root.active_by_poste[f.key].tempsTotal,700);assert.equal(f.root.sessions.recettes,100);assert.equal(f.root.saved_time[id].status,'used');
 const starts=f.calls.filter(c=>c.path==='pilotage_v1/commands/1'&&c.method==='PUT').length;
 await assert.rejects(f.r.restoreTime(id,f.posts[0]),/déjà utilisé/);assert.equal(f.calls.filter(c=>c.path==='pilotage_v1/commands/1'&&c.method==='PUT').length,starts);
 const exp=fixture(dir);await exp.r.saveTime(exp.posts[0]);const bank=Object.keys(exp.root.saved_time)[0];exp.setTime(Date.parse('2026-11-05T08:00:00Z'));assert.equal(exp.r.validBanks(exp.root).length,0);await assert.rejects(exp.r.restoreTime(bank,exp.posts[0]),/expiré/);
 const manager=fixture(dir,true);const view=await manager.r.managerSnapshot();assert(!view.daily['2026-11-03']);assert.equal(view.daily['2026-11-04'].recettes,100);assert(!manager.calls.some(c=>c.path==='gz_GZ-07732'),'manager must not request entire room');assert(!manager.calls.some(c=>c.path==='gz_GZ-07732/daily'),'manager must not request all daily revenue');
 manager.setTime(Date.parse('2026-11-05T08:00:00Z'));const next=await manager.r.managerSnapshot();assert.equal(next.sessions.recettes,0);assert(!next.daily['2026-11-04']);
 new vm.Script(fs.readFileSync(dir+'/youssef-relay.js','utf8'));
 console.log(dir+': save -> other client -> restore, occupied protection, single use, 08:00 expiry, unchanged revenue, manager privacy, 401 refresh: OK');
}})().catch(e=>{console.error(e);process.exit(1)});

