/* CP1: clôture logique des séances expirées, sans nouvel ordre électrique. */
(function(w){'use strict';
let running=false;
const clone=x=>JSON.parse(JSON.stringify(x));
function expired(a,stamp){return a?.actif===true&&!a.starting&&!a.cleanup&&!!a.sessionId&&(a.paused?Number(a.pauseRemainingSec)===0:Number.isFinite(Number(a.finTs))&&Number(a.finTs)>0&&Number(a.finTs)<=stamp);}
function closeExpired(root,stamp=Date.now()){
 if(!root||!Array.isArray(root.postes))return;
 const key=CP1Relay.dayKey(new Date(stamp)),ss=root.sessions;
 if(!ss||ss.dayStart!==CP1Relay.dayStart(stamp))return;
 let changed=false;
 for(const {p,i}of CP1Relay.entries(root.postes)){
  const k=encodeURIComponent(p.num),a=root.active_by_poste?.[k]||root.active_postes?.[i];
  if(!expired(a,stamp))continue;
  const sid=a.sessionId,closed=root.closed_sessions?.[sid];
  const cleared={...a,actif:false,starting:false,startingUntil:0,cleanup:false,cleanupUntil:0,client:'',finTs:0,tempsTotal:0,dureeMin:0,paused:false,pauseRemainingSec:0,montantSession:0,montantJourSession:0,paiementsSession:{},sessionId:'',startedAt:0,bonus:false,bonusOnly:false,bonusSource:'',bonusDurationMin:0,bonusMinutesAdded:0,bonusGrantedAt:0,gzAutoBonusGrantedMin:0,gzAutoBonusConsole:'',expiredSessionId:sid,powerUnverified:true,updatedAt:stamp};
  root.active_by_poste=root.active_by_poste||{};root.active_by_poste[k]=cleared;
  root.active_postes=Array.isArray(root.active_postes)?root.active_postes:[];root.active_postes[i]=clone(cleared);
  root.closed_sessions=root.closed_sessions||{};
  if(!closed){root.closed_sessions[sid]={status:a.bonusOnly?'bonus_termine':'terminee_auto',ts:stamp,dateKey:key,poste:p.num,bonus:!!a.bonus};if(!a.bonusOnly)ss.count=Math.max(0,Number(ss.count)||0)+1;}
  changed=true;
 }
 if(!changed)return;
 root.daily=root.daily||{};root.daily[key]=clone(ss);return root;
}
async function check(){
 if(running||typeof DB==='undefined'||!DB._cache||!CP1Relay.currentUid())return;
 const cache=DB._cache,stamp=Date.now();
 if(!CP1Relay.entries(cache.postes||[]).some(({p,i})=>expired(cache.active_by_poste?.[encodeURIComponent(p.num)]||cache.active_postes?.[i],stamp)))return;
 running=true;
 try{const tx=await CP1Relay.transaction(root=>closeExpired(root,Date.now()));if(tx.committed){DB._cache=tx.snapshot.val();if(typeof ownerFinishExpired==='function'){renderControl();renderHome();ownerRenderReport();}else{refreshFromRemote();renderPostes();updateStats();}}}
 catch(e){console.warn('Clôture automatique CP1 à réessayer :',e.message);}
 finally{running=false;}
}
w.CP1Expiry={expired,closeExpired,check};
w.addEventListener('cp1-physical-update',check);
w.addEventListener('online',check);
w.addEventListener('pageshow',check);
setInterval(check,3000);
})(window);
