const vm=require('vm'),fs=require('fs'),assert=require('assert'),crypto=require('crypto').webcrypto;
async function scenario(file,{sdk=true,ok=true,putFails=false,listenFails=false,expire=false}={}){
 const stamp=Date.now(),owner='Jt6csGJGWiZGRB4yExIFHmVrXzf1',events=[],calls=[],timers=new Map();let clock=stamp,sequence=0,handler,detach=0,writes=0,sounds=0;
 class Clock extends Date{static now(){return clock;}}
 const row={online:true,power:false,mode:'libre',remaining:0,nativeSeconds:0,seenAt:stamp};
 const ref={on:(event,cb,cancel)=>{handler=cb;cb({val:()=>({...row,result:{id:'old-command',ok:true}})});if(listenFails)cancel(Error('permission'));},off:()=>{detach++;handler=null;}};
 const response=data=>({ok:true,status:200,json:async()=>structuredClone(data),headers:{get:name=>name==='Date'?new Date(stamp).toUTCString():null}});
 const w={fetch:async(url,opts)=>{const path=decodeURIComponent(new URL(url).pathname),method=opts.method;calls.push([method,path]);events.push(path);
  if(path.includes('/heartbeat.'))return response({at:stamp,capabilities:['command-receipts-v2']});
  if(path.includes('/commands/')&&method==='GET')return response(null);
  if(path.includes('/commands/')&&method==='PUT'){
   writes++;const command=JSON.parse(opts.body);
   if(putFails)throw Error('write failed');
   if(expire){clock=command.expiresAt+2000;for(const [key,item]of [...timers])if(item.delay>10000){timers.delete(key);item.fn();}return response(command);}
   // An unrelated old receipt cannot settle this command. Deliver a fresh
   // matching receipt only after the command reached Firebase.
   Object.assign(row,{online:true,power:true,mode:'actif',remaining:300,nativeSeconds:300,seenAt:stamp,result:{id:command.id,ok,message:'Refus contrôlé'}});
   if(handler)handler({val:()=>structuredClone(row)});
   return response(command);
  }
  return response(row);
 },GZActionAudio:{play:()=>sounds++}};
 if(sdk){w.firebase={auth:()=>({currentUser:{uid:owner}}),database:()=>({ref:()=>ref})};}
 const context={window:w,document:{getElementById:()=>null},Date:Clock,Map,Set,JSON,Number,String,Object,Math,Error,AbortController,Response,crypto,console,
  setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>1};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context);const relay=w.CP1Relay;relay.install({uid:()=>owner,token:async()=> 'test-token'});
 const result=relay.command({num:'Poste 1 ps4'},'start',300);
 if(!ok||putFails||listenFails||expire)await assert.rejects(result);else assert.equal((await result).result.ok,true);
 assert.equal(writes,1,'never retry a mutating command');assert.equal(sounds,0,'network callbacks never speak');
 if(sdk){assert.equal(detach,1,'detach receipt listener on success and all failures');assert(!handler);}
 assert.equal(timers.size,0,'no receipt or HTTP timeout left behind');
 const put=calls.findIndex(([m])=>m==='PUT');
 if(sdk)assert.equal(calls.slice(put+1).filter(([m,p])=>m==='GET'&&p.includes('/states/')).length,0,'no repeated receipt GET with SDK');
}
(async()=>{for(const file of process.argv.slice(2)){
 for(const options of [{},{sdk:false},{ok:false},{putFails:true},{listenFails:true},{expire:true}])await scenario(file,options);
 console.log(file+': live receipt, REST fallback, negative receipt, write failure, denied listener, timeout, no duplicate PUT, no background audio: OK');
}})().catch(e=>{console.error(e);process.exitCode=1});
