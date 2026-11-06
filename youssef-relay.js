/* GameZone CP1: commandes confirmées par pilotage_v1, sans Worker. */
(function(w){'use strict';
const URL_DB='https://gamezone-bah-nouveau-default-rtdb.europe-west1.firebasedatabase.app',OWNER='Jt6csGJGWiZGRB4yExIFHmVrXzf1',ROOM='gz_GZ-07732';
const fetchNative=w.fetch.bind(w),pending=new Map();let cfg={},offset=0,confirmedRoot=null,cachedPosts=[];
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x)),snap=x=>({val:()=>clone(x)}),sleep=t=>new Promise(r=>setTimeout(r,t));
function uid(){return cfg.uid();}function now(){return Date.now()+offset;}function id(){return crypto.randomUUID();}
async function request(path,method='GET',data,headers={},retried=false){if(path===ROOM&&method==='GET'&&uid()!==OWNER)return {data:syncPhysicalRoot(applyAuto(await managerSnapshot())),etag:null,date:null};const token=await cfg.token(retried);if(!token)throw Error('Connexion Firebase requise');const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),6000);let r;try{const encoded=path.split('/').map(encodeURIComponent).join('/');r=await fetchNative(URL_DB+'/'+encoded+'.json?auth='+encodeURIComponent(token),{method,signal:timeout.signal,cache:'no-store',headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(data)})});}catch(e){throw Error(e.name==='AbortError'?'Réseau trop lent : vérifier la connexion.':e.message);}finally{clearTimeout(timer);}if(r.status===401&&!retried)return request(path,method,data,headers,true);if(!r.ok)throw Error('Firebase '+r.status+' : accès refusé à cette opération.');let result=await r.json();if(method==='GET'&&/^pilotage_v1\/states\/[1-6]$/.test(path)&&result&&typeof result==='object'){physicalRows[path.split('/').pop()]=result;physicalAt=Date.now();renderPhysical();notifyPhysical();}if(path===ROOM+'/postes'&&Array.isArray(result))cachedPosts=result;if(path===ROOM&&method==='GET'&&Array.isArray(result?.postes))cachedPosts=result.postes;if(path===ROOM&&method==='GET')result=acceptSnapshot(syncPhysicalRoot(applyAuto(result)));return {data:result,etag:r.headers.get('ETag'),date:r.headers.get('Date')};}
async function states(){const rows=(await request('pilotage_v1/states')).data||{};physicalRows=rows;physicalAt=Date.now();renderPhysical();notifyPhysical();return rows;}
const CP1_POST_MAP={"Poste 1 ps4": 1, "Poste 2 ps4": 2, "Poste 3 ps4": 3, "Poste 4 ps2": 4, "Poste 5 ps3": 5, "Poste 6 ps3": 6};
function poste(p){const label=String(p?.num||p||''),n=CP1_POST_MAP[label];if(!Number.isInteger(n)||n<1||n>7)throw Error('Correspondance de la prise CP1 à configurer');return String(n);}

// Preserve Firebase indices and historical rows; show only the six mapped controls.
function entries(posts){const seen=new Set();return (posts||[]).map((p,i)=>({p,i})).filter(({p})=>{const n=CP1_POST_MAP[p?.num];if(!n||seen.has(n))return false;seen.add(n);return true;}).sort((a,b)=>CP1_POST_MAP[a.p.num]-CP1_POST_MAP[b.p.num]);}
function displayName(p){const n=CP1_POST_MAP[p?.num];return n?'Poste '+n:String(p?.displayName||p?.num||'Poste');}
let physicalRows={},physicalAt=0,physicalPoll=null;
function physicalSummary(){const on=[],unknown=[];for(let n=1;n<=6;n++){const row=physicalRows[n];if(!row?.online||now()-row.seenAt>30000){unknown.push(n);continue;}if(row.power===true)on.push(n);else if(row.power!==false)unknown.push(n);}return {on,unknown,count:unknown.length?'—':on.length,text:unknown.length?'État à vérifier : poste(s) '+unknown.join(', '):(on.length?'Prises allumées : '+on.map(n=>'Poste '+n).join(', '):'Les six prises sont éteintes')};}
function renderPhysical(){const s=physicalSummary();for(const key of ['od-prises','or-plugs','s-prises','r-prises']){const el=document.getElementById(key);if(el)el.textContent=s.count;}for(const key of ['od-prises-list','s-prises-list']){const el=document.getElementById(key);if(el)el.textContent=s.text;}}
function notifyPhysical(){if(typeof w.dispatchEvent==='function'&&typeof CustomEvent==='function')w.dispatchEvent(new CustomEvent('cp1-physical-update'));}
async function refreshPhysical(){if(activeTransactions)return;try{await states();}catch(_){renderPhysical();}}

function applyPause(state,marker){if(marker?.reason==='prise_injoignable')return state;if(!state?.actif||state.paused||!marker||marker.sessionId!==state.sessionId)return state;if(state.nativeCommandId&&marker.nativeId!==state.nativeCommandId)return state;if(Number(marker.at)<Number(state.startedAt||0))return state;const remaining=Number(marker.remaining);if(!Number.isInteger(remaining)||remaining<0||remaining>86400)return state;return {...state,paused:true,pauseRemainingSec:remaining,finTs:0,pausePowerOffConfirmed:marker.powerConfirmed===true,pauseReason:marker.reason,autoPausedAt:marker.at};}
function applyAuto(root){if(!root||typeof root!=='object')return root;const next=clone(root);for(const [key,state]of Object.entries(next.active_by_poste||{})){next.active_by_poste[key]=applyPause(state,next.auto_pauses?.[key]);const st=next.active_by_poste[key],receipt=next.pause_results?.[key];if(st.pendingPauseId){st.pausePowerOffConfirmed=receipt?.id===st.pendingPauseId&&receipt?.sessionId===st.sessionId&&receipt?.powerConfirmed===true;st.pausePending=!st.pausePowerOffConfirmed;}}return next;}
function remaining(s){return !s?.actif?0:s.paused?Math.max(0,Math.floor(s.pauseRemainingSec||0)):Math.max(0,Math.ceil(((s.finTs||0)-Date.now())/1000));}
function transientReadError(e){return !/Firebase (401|403)|Connexion Firebase requise/.test(String(e?.message||e));}
async function ready(p){
 const n=poste(p),h=await request('pilotage_v1/heartbeat');
 if(h.date)offset=new Date(h.date).getTime()-Date.now();
 if(!h.data?.capabilities?.includes('command-receipts-v2'))throw Error('Mise à jour du relais CP1 requise.');
 if(!h.data?.at||now()-h.data.at>45000)throw Error('Relais OPPO non disponible');
 // Wait for a fresh confirmed reading. This preflight sends no plug command.
 const until=Date.now()+8000;
 do{
  try{const st=(await request('pilotage_v1/states/'+n)).data||{};
   const age=now()-Number(st.seenAt||0);
   if(st.online===true&&age>=-5000&&age<=30000)return st;
  }catch(e){if(!transientReadError(e))throw e;}
  if(Date.now()>=until)break;await sleep(400);
 }while(Date.now()<until);
 throw Error('Prise du poste '+n+' non joignable après vérification. Vérifie son Wi-Fi et son adresse IP dans le relais.');
}
async function command(p,action,seconds=0,operationId){
 const n=poste(p);if(pending.has(n))throw Error('Une commande est déjà en cours pour ce poste.');
 pending.set(n,{reserving:true});
 try{
  const [before,waiting]=await Promise.all([ready(p),request('pilotage_v1/commands/'+n)]);
  const c={id:operationId||id(),by:uid(),action,seconds,createdAt:Math.round(now()),expiresAt:Math.round(now()+20000)};
  const previousCredit=before.mode==='actif'?Math.max(0,Math.ceil((before.deadline-now())/1000)):Number(before.remaining)||0;
  pending.set(n,c);
  if(before.result?.id===c.id){if(!before.result.ok)throw Error(before.result.message||'Commande refusée');return before;}
  const old=waiting.data;if(old?.expiresAt>now()&&before?.result?.id!==old.id)throw Error('Une autre commande attend confirmation.');
  w.GZActionAudio?.play(action);
  await request('pilotage_v1/commands/'+n,'PUT',c);
  for(let i=0;i<100;i++){
   let s;
   try{s=(await request('pilotage_v1/states/'+n)).data;}
   catch(e){if(!transientReadError(e))throw e;if(now()>c.expiresAt+1500)break;await sleep(300);continue;}
   if(s?.result?.id===c.id){
    if(!s.result.ok)throw Error(s.result.message||'Commande refusée par le relais');
    if(!s.online||now()-s.seenAt>30000){
     if(now()>c.expiresAt+1500)break;
     await sleep(300);continue;
    }
    if(action==='subtract'){
     const ceiling=Math.max(0,previousCredit-seconds)+2;
     if(previousCredit<=seconds&&s.power!==false)throw Error('Extinction après réduction à zéro non confirmée.');
     if(Number(s.remaining)>ceiling||(s.mode==='actif'&&Number(s.nativeSeconds)>ceiling))throw Error('Réduction non confirmée par la prise : vérifier son minuteur.');
    }
    w.GZActionAudio?.play('confirmed');return s;
   }
   if(now()>c.expiresAt+1500)break;await sleep(200);
  }
  throw Error('Délai dépassé : vérifier la prise avant une nouvelle tentative.');
 }catch(e){w.GZActionAudio?.play('error');throw e;}finally{pending.delete(n);}
}
function plan(old,next){const ops=[];for(let i=0;i<(next.postes||[]).length;i++){const p=next.postes[i];if(!p)continue;const k=encodeURIComponent(p.num),a=old.active_by_poste?.[k]||old.active_postes?.[i]||{},b=next.active_by_poste?.[k]||next.active_postes?.[i]||{};if(JSON.stringify(a)===JSON.stringify(b))continue;let action='',seconds=0;if(b.actif&&!a.actif){action='start';seconds=remaining(b);}else if(a.actif&&!b.actif)action='off';else if(a.actif&&b.actif){if(!a.paused&&b.paused)action='pause';else if(a.paused&&!b.paused)action='resume';else{const delta=b.paused?Number(b.pauseRemainingSec||0)-Number(a.pauseRemainingSec||0):Math.round((Number(b.finTs||0)-Number(a.finTs||0))/1000);if(delta>0){action='add';seconds=delta;}else if(delta<0){action='subtract';seconds=-delta;}}}if(action)ops.push({p,k,b,action,seconds});}return ops;}
async function acquire(){const key=id(),path=ROOM+'/operation_lock';for(let i=0;i<8;i++){const got=await request(path,'GET',null,{'X-Firebase-ETag':'true'});if(!got.data||got.data.until<now()){try{await request(path,'PUT',{id:key,by:uid(),until:now()+90000},{'if-match':got.etag});return key;}catch(e){if(i===7)throw e;}}await sleep(300);}throw Error('Une opération est en cours sur un autre appareil. Réessaie.');}
async function release(key){try{const g=await request(ROOM+'/operation_lock','GET',null,{'X-Firebase-ETag':'true'});if(g.data?.id===key)await request(ROOM+'/operation_lock','DELETE',null,{'if-match':g.etag});}catch(e){console.warn('Libération verrou :',e.message);}}

function isExpiredClosure(old,next,op){
 if(op.action!=='off')return false;
 const i=(old.postes||[]).findIndex(p=>p?.num===op.p.num),a=old.active_by_poste?.[op.k]||old.active_postes?.[i]||{},sid=a.sessionId;
 const record=next.closed_sessions?.[sid];
 const elapsed=a.paused?Number(a.pauseRemainingSec)===0:Number.isFinite(Number(a.finTs))&&Number(a.finTs)>0&&Number(a.finTs)<=now();
 return !!sid&&a.actif===true&&elapsed&&['terminee_auto','bonus_termine'].includes(record?.status)&&record.poste===op.p.num&&op.b.actif===false;
}

let activeTransactions=0;
async function transaction(fn,options={}){activeTransactions++;try{return await transactionLocked(fn,options);}finally{activeTransactions--;}}
async function transactionLocked(fn,options={}){const key=await acquire();let ops=[],confirmed=[];try{const old=(await request(ROOM)).data||{},next=fn(clone(old));if(next===undefined)return {committed:false,snapshot:snap(old)};ops=options.deferPause?[]:plan(old,next).filter(op=>!isExpiredClosure(old,next,op));for(const op of ops){const previous=old.active_by_poste?.[op.k];if(previous?.pendingPauseId){const ack=old.pause_results?.[op.k];if(ack?.id!==previous.pendingPauseId||ack?.powerConfirmed!==true)throw Error('Pause en attente : extinction à confirmer avant toute autre commande.');}}if(ops.length>1)throw Error('Commande les postes un par un pour confirmer chaque prise.');for(const op of ops){if(op.action==='off'&&options?.reduceSeconds){op.action='subtract';op.seconds=options.reduceSeconds;}if(options.saveTime){op.action='save';op.commandId=next.saved_time_intents[options.saveTime.id].commandId;}if(options.restoreTime)op.commandId=next.saved_time[options.restoreTime.id].restoreCommandId;let s;if(op.action==='off'&&uid()!==OWNER){const st=(await states())[poste(op.p)];if(!st?.online||st.power!==false||st.nativeSeconds!==0||now()-st.seenAt>30000)throw Error('OFF TV et annulation réservés au Patron.');s=st;}else s=await command(op.p,op.action,op.seconds,op.commandId);if(options.saveTime){const credit=s.result?.savedSeconds;if(!Number.isInteger(credit)||credit<=0)throw Error('Crédit sauvegardé non confirmé par la prise');next.saved_time[options.saveTime.id].remainingSeconds=credit;}confirmed.push(op);const b=op.b;b.nativeCommandId=s.result?.id||'';delete b.pendingPauseId;delete b.pausePending;if(b.actif){if(['pause','coupure'].includes(s.mode)){b.paused=true;b.pauseRemainingSec=s.remaining;b.finTs=0;b.pausePowerOffConfirmed=s.power===false;}else if(s.mode==='actif'){b.paused=false;b.pauseRemainingSec=0;b.finTs=s.deadline;}else{b.actif=false;b.paused=false;b.finTs=0;b.pauseRemainingSec=0;}}b.updatedAt=Date.now();}
for(const [id,r]of Object.entries(next.operation_results||{})){if(!old.operation_results?.[id]){r.state=clone(next.active_by_poste?.[r.poste]);r.dayStart=dayStart();}}stampDay(next);const changed=leafPatch(old,next);if(!Object.keys(changed).length)return {committed:false,snapshot:snap(old)};next.businessRevision=(Number(old.businessRevision)||0)+1;changed.businessRevision=next.businessRevision;await request(ROOM,'PATCH',changed);confirmedRoot=clone(next);return {committed:true,snapshot:snap(next)};
}catch(e){if(ops.length){try{await request(ROOM+'/operation_incidents/'+key,'PUT',{at:now(),by:uid(),postes:ops.map(x=>poste(x.p)),message:confirmed.length?'Commande prise confirmée, enregistrement de gestion non confirmé : contrôler le rapport.':'Commande non confirmée : contrôler prise et rapport avant de répéter une vente.'});}catch(_){}e.message+=' — Contrôler le poste et le rapport avant de refaire une vente.';}throw e;}finally{await release(key);}}
function child(path){return {child:k=>child(path+'/'+k),set:async v=>request(path,'PUT',v),update:async v=>request(path,'PATCH',v),once:async()=>snap((await request(path)).data)};}
function roomRef(raw){return {child:k=>raw.child(k),once:async(...a)=>snap(acceptSnapshot(applyAuto((await raw.once(...a)).val()))),on:(event,cb,cancel)=>raw.on(event,s=>cb(snap(acceptSnapshot(applyAuto(s.val())))),cancel),off:(...a)=>raw.off(...a),update:v=>raw.update(v),transaction};}
function install(c){cfg=c;if(!physicalPoll){physicalPoll=setInterval(refreshPhysical,2000);refreshPhysical();}w.fetch=async function(input,options={}){const url=typeof input==='string'?input:input.url;if(!url.includes('/__youssef_relay__'))return fetchNative(input,options);let body={};try{body=JSON.parse(options.body||'{}');const r=await route(body);return new Response(JSON.stringify(r),{status:200,headers:{'Content-Type':'application/json'}});}catch(e){return new Response(JSON.stringify({success:false,error:e.message}),{status:409,headers:{'Content-Type':'application/json'}});}};}
async function route(q){if(q.action==='pauseConfirmed')return queuePause(q);if(['status','roomStatus','diagnosticTuya'].includes(q.action)){const s=await states(),posts=cachedPosts.length?cachedPosts:(await request(ROOM+'/postes')).data||[];const devices=entries(posts).map(({p})=>{const r=s[poste(p)]||{};return {devid:p.devid,poste:p.num,online:r.online===true&&now()-r.seenAt<15000,switchOn:r.power,countdown:r.nativeSeconds||0,readable:true,switchCode:'DP1'};});return q.action==='status'?{success:true,device:devices.find(d=>d.devid===q.devid)||{online:false}}:{success:true,devices};}const posts=cachedPosts.length?cachedPosts:(await request(ROOM+'/postes')).data||[];const p=posts.find(p=>p&&(q.posteNum===p.num||q.poste===p.num||q.devid===p.devid));if(!p)throw Error('Poste CP1 introuvable.');const number=poste(p),targetKey=encodeURIComponent(p.num);const [physical,active]=await Promise.all([request('pilotage_v1/states/'+number),request(ROOM+'/active_by_poste/'+targetKey)]);const s={[number]:physical.data||{}},raw={postes:posts,active_by_poste:{[targetKey]:active.data||{}}};const devices=posts.filter(p=>p && Object.prototype.hasOwnProperty.call(CP1_POST_MAP,p.num)).map(p=>{const r=s[poste(p)]||{};return {devid:p.devid,poste:p.num,online:r.online===true&&now()-r.seenAt<30000,switchOn:r.power,countdown:r.nativeSeconds||0,readable:true,switchCode:'DP1'};});
if(['status','roomStatus','diagnosticTuya'].includes(q.action)){if(q.action==='status')return {success:true,device:devices.find(d=>d.devid===q.devid)||{online:false}};return {success:true,devices};}
if(['syncTimer','syncAllTimers'].includes(q.action))throw Error('Les minuteurs sont gérés par le relais natif.');
if(['pushConfig','subscribePush','vapidPublicKey'].includes(q.action))throw Error('Notifications push serveur non configurées pour CP1.');
if(!p)throw Error('Poste CP1 introuvable.');
if(!q.action&&typeof q.turnOn==='boolean'){if(q.turnOn){await ready(p);const st=s[poste(p)];return {success:true,device:{online:true,switchOn:st.power===true},ready:true};}await safeOff(p);return {success:true,device:{online:true,switchOn:false}};}
const index=posts.indexOf(p),k=encodeURIComponent(p.num),a=raw.active_by_poste?.[k]||{};if(!a.actif||q.sessionId&&a.sessionId!==q.sessionId)throw Error('La séance a changé. Actualise avant de continuer.');if(q.expectedUpdatedAt!=null&&Number(q.expectedUpdatedAt)!==Number(a.updatedAt||0))throw Error('Séance modifiée : rouvre le bouton − Temps.');let removed=0;
if(q.action==='finishConfirmed'){const st=s[poste(p)];if(st?.online&&st.power===false&&st.nativeSeconds===0&&now()-st.seenAt<30000)return {success:true,powerOffConfirmed:true};await command(p,'off');return {success:true,powerOffConfirmed:true};}
if(!['pauseConfirmed','resumeConfirmed','reduceTime'].includes(q.action))throw Error('Action non prise en charge : '+String(q.action));
const opid=q.operationId||id();let prior=raw.operation_results?.[opid];if(!prior&&q.operationId)try{prior=(await request(ROOM+'/operation_results/'+opid)).data;}catch(_){}if(prior)return {...prior,success:true,duplicate:true,schedulerConfirmed:true};const tx=await transaction(room=>{if(room.operation_results?.[opid])return room;const b=room.active_by_poste?.[k];if(!b?.actif||b.sessionId!==a.sessionId)throw Error('Séance modifiée ailleurs');if(q.expectedUpdatedAt!=null&&Number(q.expectedUpdatedAt)!==Number(b.updatedAt||0))throw Error('Séance modifiée : rouvre le bouton − Temps.');if(q.action==='pauseConfirmed'){if(b.paused){const st=s[poste(p)];if(!st?.online||now()-st.seenAt>30000||st.power!==false)throw Error('Pause déjà enregistrée, extinction non confirmée.');return room;}b.paused=true;b.pauseRemainingSec=remaining(a);b.finTs=0;b.pausePowerOffConfirmed=true;}else if(q.action==='resumeConfirmed'){if(!b.paused)throw Error('Aucune pause à reprendre');b.finTs=Date.now()+b.pauseRemainingSec*1000;b.paused=false;b.pauseRemainingSec=0;}else{if(!Number.isInteger(q.minutes)||q.minutes<1||q.minutes>1440)throw Error('Durée invalide');removed=Math.min(remaining(a),q.minutes*60);if(b.paused)b.pauseRemainingSec=Math.max(0,b.pauseRemainingSec-removed);else b.finTs=Math.max(Date.now(),b.finTs-removed*1000);if(remaining(b)<=0){b.actif=false;b.paused=false;b.finTs=0;b.pauseRemainingSec=0;}}b.updatedAt=Date.now();room.operation_results=room.operation_results||{};room.operation_results[opid]={poste:k,action:q.action,removedSeconds:removed,powerOffConfirmed:q.action==='pauseConfirmed',powerOnConfirmed:q.action==='resumeConfirmed'};const ids=Object.keys(room.operation_results);for(const oldid of ids.slice(0,Math.max(0,ids.length-100)))delete room.operation_results[oldid];return room;},{reduceSeconds:q.action==='reduceTime'?q.minutes*60:0});return {success:true,state:tx.snapshot.val().active_by_poste[k],powerOffConfirmed:q.action==='pauseConfirmed',powerOnConfirmed:q.action==='resumeConfirmed',removedSeconds:removed,schedulerConfirmed:true};}
async function queuePause(q){let key;const tx=await transaction(root=>{const p=(root.postes||[]).find(p=>p?.num===q.posteNum);if(!p)throw Error('Poste introuvable');key=encodeURIComponent(p.num);const a=activeRow(root,p);if(!a.actif||a.sessionId!==q.sessionId)throw Error('La séance a changé');if(a.paused&&a.pausePowerOffConfirmed)return root;const credit=remaining(a);a.paused=true;a.pauseRemainingSec=credit;if(!a.pauseRemainingSec)a.pauseRemainingSec=Math.max(0,Math.ceil((a.finTs-now())/1000));a.finTs=0;a.pausePowerOffConfirmed=true;delete a.pendingPauseId;delete a.pausePending;setActive(root,p,a);return root;});const state=tx.snapshot.val().active_by_poste[key];return {success:true,state,pending:false,powerOffConfirmed:true,schedulerConfirmed:true};}
async function safeOff(p){const room=(await request(ROOM)).data||{},a=room.active_by_poste?.[encodeURIComponent(p.num)]||{};if((a.actif&&!a.paused)||a.starting)throw Error('Séance en cours : utiliser Pause ou OFF TV.');const st=(await states())[poste(p)];if(st?.online&&st.power===false&&st.nativeSeconds===0&&now()-st.seenAt<30000)return true;await command(p,'off');return true;}
const CP1_TARIFFS=[{"console": "PS5", "min": 50, "lbl": "50 minutes", "prix": 500}, {"console": "PS5", "min": 110, "lbl": "110 minutes", "prix": 1000}, {"console": "PS4", "min": 13, "lbl": "13 minutes", "prix": 100}, {"console": "PS4", "min": 34, "lbl": "34 minutes", "prix": 200}, {"console": "PS4", "min": 50, "lbl": "50 minutes", "prix": 300}, {"console": "PS4", "min": 100, "lbl": "100 minutes", "prix": 500}, {"console": "PS4", "min": 200, "lbl": "200 minutes", "prix": 1000}, {"console": "PS3", "min": 14, "lbl": "14 minutes", "prix": 100}, {"console": "PS3", "min": 37, "lbl": "37 minutes", "prix": 200}, {"console": "PS3", "min": 55, "lbl": "55 minutes", "prix": 300}, {"console": "PS3", "min": 110, "lbl": "110 minutes", "prix": 500}, {"console": "PS3", "min": 225, "lbl": "225 minutes", "prix": 1000}, {"console": "PS2", "min": 20, "lbl": "20 minutes", "prix": 100}, {"console": "PS2", "min": 50, "lbl": "50 minutes", "prix": 200}, {"console": "PS2", "min": 70, "lbl": "70 minutes", "prix": 300}, {"console": "PS2", "min": 140, "lbl": "140 minutes", "prix": 500}];
async function importTariffs(){for(let n=0;n<3;n++){const got=await request(ROOM+'/tarifs','GET',null,{'X-Firebase-ETag':'true'}),existing=Array.isArray(got.data)?got.data:[];const oldSeeds={30:500,60:900,90:1300,120:1700,180:2400};const merged=existing.filter(t=>t&&!(String(t.console).toUpperCase()==='PS5'&&oldSeeds[t.min]===Number(t.prix)));for(const t of CP1_TARIFFS){const i=merged.findIndex(x=>String(x.console).toUpperCase()===t.console&&Number(x.min)===t.min);if(i<0)merged.push(clone(t));else merged[i]={...merged[i],...t};}if(JSON.stringify(existing)===JSON.stringify(merged))return;try{await request(ROOM+'/tarifs','PUT',merged,{'if-match':got.etag});return;}catch(e){if(n===2)throw e;}}}
async function importPostLabels(){const got=await request(ROOM+'/postes','GET',null,{'X-Firebase-ETag':'true'});if(!Array.isArray(got.data))return;const posts=got.data.map(p=>{if(!p)return p;const n=Number(poste(p));if(n>4)return p;return {...p,type:n===4?'PS5':'PS4',displayName:'POSTE ➜ '+n};});if(JSON.stringify(posts)!==JSON.stringify(got.data))await request(ROOM+'/postes','PUT',posts,{'if-match':got.etag});}
async function initialize(){if(uid()!==OWNER)throw Error('Compte Patron CP1 requis');if(OWNER.includes('A_CONFIGURER')||!Object.keys(CP1_POST_MAP).length)throw Error('Exécuter configurer_cp1.py avant installation');await request('pilotage_v1/access/'+OWNER+'/rooms/'+ROOM,'PUT','patron');const existing=(await request(ROOM)).data;if(!existing?.postes?.length)throw Error('Salle CP1 existante introuvable. Aucune donnée créée.');}
function dayStart(t=now()){return Math.floor((t-28800000)/86400000)*86400000+28800000;}
function nextEight(t=now()){return dayStart(t)+86400000;}
const managerFields=['postes','tarifs','tarif_console_types','active_by_poste','active_postes','gym','businessRevision','saved_time','saved_time_intents','auto_pauses','pause_results','current_day'];
async function managerSnapshot(){
 const key=dayKey(new Date(now())),paths=[...managerFields,'config/businessName','sessions','daily/'+key,'activity_daily/'+key];
 const values=await Promise.all(paths.map(async path=>{try{return [path,(await request(ROOM+'/'+path)).data];}catch(e){if(/Firebase (401|403)/.test(e.message)&&['sessions','daily/'+key,'activity_daily/'+key].includes(path))return [path,null];throw e;}}));
 const root={daily:{},activity_daily:{},config:{}};for(const [path,value]of values){const parts=path.split('/');let target=root;for(const part of parts.slice(0,-1))target=target[part]||(target[part]={});target[parts.at(-1)]=value;}
 const ss=root.sessions;if(!ss||ss.dayStart!==dayStart())root.sessions={recettes:0,count:0,date:new Date(dayStart()).toDateString(),parPoste:{},sessionsParPoste:{},payStats:{},dayStart:dayStart()};
 return root;
}
function leafPatch(old,next,prefix='',out={}){for(const key of new Set([...Object.keys(old||{}),...Object.keys(next||{})])){if(!prefix&&key==='operation_lock')continue;const path=prefix?prefix+'/'+key:key,a=old?.[key],b=next?.[key];if(JSON.stringify(a)===JSON.stringify(b))continue;if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))leafPatch(a,b,path,out);else out[path]=b===undefined?null:b;}return out;}
function stampDay(root){const current=dayKey(new Date(now()));if(root.sessions&&root.sessions.date===new Date(dayStart()).toDateString())root.sessions.dayStart=dayStart();if(root.daily?.[current])root.daily[current].dayStart=dayStart();return root;}
function restRoom(){let timer=null,closed=false,busy=false;const api={child:k=>child(ROOM+'/'+k),once:async()=>snap((await request(ROOM)).data||{}),update:async value=>request(ROOM,'PATCH',value),transaction,off:()=>{closed=true;clearInterval(timer);},on:(event,callback,cancel)=>{closed=false;async function poll(){if(closed||busy||activeTransactions)return;busy=true;try{callback(snap((await request(ROOM)).data||{}));}catch(e){cancel?.(e);}finally{busy=false;}}poll();timer=setInterval(poll,2500);},_rootPath:ROOM};return api;}
function activeRow(root,p){return root.active_by_poste?.[encodeURIComponent(p.num)]||{};}
function setActive(root,p,state){const key=encodeURIComponent(p.num);root.active_by_poste=root.active_by_poste||{};root.active_by_poste[key]=state;const i=(root.postes||[]).findIndex(x=>x?.num===p.num);if(i>=0){root.active_postes=Array.isArray(root.active_postes)?root.active_postes:[];root.active_postes[i]=clone(state);}}
function cleared(a){return {...a,actif:false,starting:false,cleanup:false,startingUntil:0,cleanupUntil:0,client:'',sessionId:'',finTs:0,paused:false,pauseRemainingSec:0,tempsTotal:0,montantSession:0,montantJourSession:0,paiementsSession:{},updatedAt:now(),pendingPauseId:null,pausePending:false};}
function validBanks(root,t=now()){return Object.entries(root.saved_time||{}).filter(([,b])=>b&&b.status==='saved'&&b.expiresAt>t&&Number.isInteger(b.remainingSeconds)&&b.remainingSeconds>0);}
async function requireBankRelay(){const h=(await request('pilotage_v1/heartbeat')).data;if(!h?.capabilities?.includes('saved-time-v1'))throw Error('Installer le relais CP1 1.2 pour sauvegarder/restaurer le temps');}
async function saveTime(p){
 await requireBankRelay();const observed=(await request('pilotage_v1/states/'+poste(p))).data||{};
 let chosen;
 await transaction(root=>{const a=activeRow(root,p);if(!a.actif||!a.sessionId)throw Error('Aucune séance à sauvegarder');
  const previous=Object.entries(root.saved_time_intents||{}).find(([,x])=>x.kind==='save'&&x.originalSessionId===a.sessionId&&x.expiresAt>now());
  chosen=previous?.[0]||id();root.saved_time_intents=root.saved_time_intents||{};if(previous&&observed.result?.id===previous[1].commandId&&observed.result.ok===false&&observed.online&&observed.power===false){previous[1].commandId=id();}if(!previous)root.saved_time_intents[chosen]={kind:'save',id:chosen,commandId:id(),by:uid(),poste:p.num,originalSessionId:a.sessionId,originalSaleId:a.restoredOriginalSaleId||a.sessionId,client:a.client||'Client',savedAt:now(),expiresAt:nextEight()};return root;});
 const result=await transaction(root=>{const intent=root.saved_time_intents?.[chosen],a=activeRow(root,p);if(root.saved_time?.[chosen]?.status==='saved')return root;if(!intent||intent.expiresAt<=now()||a.sessionId!==intent.originalSessionId||!a.actif)throw Error('La séance a changé ou la sauvegarde a expiré');
  root.saved_time=root.saved_time||{};root.saved_time[chosen]={...intent,remainingSeconds:remaining(a),status:'saved'};setActive(root,p,cleared(a));return root;},{saveTime:{id:chosen}});
 return result;
}
async function restoreTime(bankId,p){
 await requireBankRelay();const observed=(await request('pilotage_v1/states/'+poste(p))).data||{};
 await transaction(root=>{const bank=root.saved_time?.[bankId],a=activeRow(root,p);if(!bank)throw Error('Sauvegarde introuvable');if(bank.status==='restoring'){if(bank.restorePoste!==p.num)throw Error('Restauration déjà en cours sur un autre poste');if(observed.result?.id===bank.restoreCommandId&&observed.result.ok===false&&observed.online&&observed.power===false&&observed.nativeSeconds===0)bank.restoreCommandId=id();return root;}if(bank.status!=='saved'||bank.expiresAt<=now())throw Error('Temps sauvegardé expiré à 8 h ou déjà utilisé');if(a.actif||a.starting)throw Error('Ce poste est occupé. Choisis un poste libre.');
  bank.status='restoring';bank.restorePoste=p.num;bank.restoreCommandId=id();bank.restoreSessionId='restore-'+id();bank.restoreStartedAt=now();setActive(root,p,{...cleared(a),starting:true,startingUntil:now()+45000,sessionId:bank.restoreSessionId,client:bank.client});return root;});
 return transaction(root=>{const bank=root.saved_time?.[bankId],a=activeRow(root,p);if(bank?.status==='used')return root;if(!bank||bank.status!=='restoring'||bank.restorePoste!==p.num||a.sessionId!==bank.restoreSessionId||!a.starting)throw Error('Le poste a changé. Restauration non envoyée.');
  const credit=bank.remainingSeconds;bank.status='used';bank.restoredAt=now();setActive(root,p,{...cleared(a),actif:true,starting:false,sessionId:bank.restoreSessionId,client:bank.client,finTs:now()+credit*1000,tempsTotal:credit,dureeMin:credit/60,startedAt:now(),restoredOriginalSaleId:bank.originalSaleId,restoredFrom:bankId});return root;},{restoreTime:{id:bankId}});
}
function syncPhysicalRoot(root){if(!root)return root;const result=clone(root);for(const p of result.postes||[]){if(!p||!CP1_POST_MAP[p.num])continue;const key=encodeURIComponent(p.num),a=result.active_by_poste?.[key],s=physicalRows[CP1_POST_MAP[p.num]];
 if(!a?.actif||!s?.online||now()-s.seenAt>15000||s.seenAt>now()+5000||Number(s.seenAt)<Number(a.startedAt||0)||a.pendingPauseId||a.nativeCommandId&&s.result?.id!==a.nativeCommandId)continue;
 if(s.power===true&&s.mode==='actif'&&s.nativeSeconds>0&&!a.paused){a.finTs=s.deadline;a.syncAt=s.seenAt;}
 if(s.power===false&&['pause','coupure'].includes(s.mode)&&Number.isInteger(s.remaining)&&s.remaining>0){a.paused=true;a.pauseReason='prise_eteinte';a.pausePowerOffConfirmed=true;a.pauseRemainingSec=s.remaining;a.finTs=0;a.syncAt=s.seenAt;}
 if(s.power===false&&s.mode==='termine'&&s.nativeSeconds===0&&s.remaining===0){a.paused=false;a.pauseRemainingSec=0;a.finTs=Math.min(Date.now(),Number(s.seenAt));a.syncAt=s.seenAt;}
 }return result;}

function acceptSnapshot(root){return confirmedRoot&&(Number(root?.businessRevision)||0)<(Number(confirmedRoot.businessRevision)||0)?clone(confirmedRoot):root;}
function isPatronEvent(e){return !!e&&(String(e.actorRole||'').toLowerCase()==='patron'||String(e.gerant||'').toLowerCase()==='patron'||e.visibilite==='patron'||e.uid===OWNER||e.actorUid===OWNER||/par le patron/i.test(String(e.main||'')));}
function dayKey(d=new Date()){return new Date(d.getTime()-8*60*60*1000).toISOString().slice(0,10);}
function todayRevenue(room,d=new Date()){return Math.max(0,Number(room.daily?.[dayKey(d)]?.recettes)||0);}
w.CP1Relay={dayStart,nextEight,managerSnapshot,restRoom,saveTime,restoreTime,validBanks,syncPhysicalRoot,leafPatch,entries,displayName,physicalSummary,renderPhysical,refreshPhysical,install,request,acceptSnapshot,isPatronEvent,dayKey,todayRevenue,currentUid:uid,applyPause,applyAuto,importTariffs,ready,command,plan,transaction,roomRef,child,initialize,safeOff,poste,remaining,owner:OWNER,room:ROOM};
})(window);






