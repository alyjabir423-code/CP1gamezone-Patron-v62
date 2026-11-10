const vm=require('vm'),fs=require('fs'),assert=require('assert');
const listeners={},store=new Map();let played=0,paused=0;
class Audio{play(){played++;return Promise.resolve();}pause(){paused++;}}
const document={hidden:false,readyState:'loading',addEventListener:(name,fn)=>listeners[name]=fn,getElementById:()=>null};
const window={addEventListener:()=>{}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),{window,document,Audio,Date,Map,Set,JSON,Object,Number,String,Math,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},sessionStorage:{getItem:()=>null,setItem:()=>{}},setInterval:()=>1});
window.GZActionAudio.play('start');assert.equal(played,0,'programmatic requests are silent');
function click(text,isTrusted=true){listeners.click({isTrusted,target:{closest:()=>({textContent:text,closest:()=>null})}});}
click('Activer',false);assert.equal(played,0,'synthetic clicks are silent');
click('Activer');assert.equal(played,1,'one trusted action speaks once');
window.GZActionAudio.play('confirmed');window.GZActionAudio.play('error');assert.equal(played,1,'delayed confirmations and errors are silent');
click('Pause');assert.equal(played,2);document.hidden=true;listeners.visibilitychange();assert(paused>0,'hide stops queued playback');
store.set('cp1-audio-enabled','0');click('Reprendre');assert.equal(played,2,'muted action stays silent');
console.log('Audio: trusted presses only, one announcement per gesture, silent synthetic and delayed events, hide stops playback, mute: OK');
