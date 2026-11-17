const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
vm.runInThisContext(fs.readFileSync(__dirname+'/core.js','utf8'));
const C=globalThis.CadenceCore;let checks=0;
function check(f){f();checks++;}
for(const n of [100,110,120])check(()=>assert(C.validBpm(n)));
for(const n of [99,121,NaN,Infinity,110.5,0,-1,'110',null,true])check(()=>assert(!C.validBpm(n)));
check(()=>assert(Object.isFrozen(C)));
for(const bpm of [100,110,120]){
 const p=60/bpm;
 check(()=>assert.equal(C.snapshot(-.01,p,'cycles').count,0));
 check(()=>assert.equal(C.snapshot(0,p,'cycles').count,1));
 for(let n=1;n<=30;n++)check(()=>assert.equal(C.snapshot((n-1)*p+.001,p,'cycles').count,n));
 check(()=>assert.equal(C.snapshot(30*p-.000001,p,'cycles').count,30));
 check(()=>assert.equal(C.snapshot(30*p,p,'cycles').phase,'breaths'));
 check(()=>assert.equal(C.snapshot(100*p,p,'cycles').count,30));
 check(()=>assert.equal(C.snapshot(30*p+.001,p,'continuous').count,31));
 check(()=>assert.equal(C.snapshot(.129,p,'cycles').pulse,true));
 check(()=>assert.equal(C.snapshot(.13,p,'cycles').pulse,false));
 check(()=>assert.equal(C.snapshot(.131,p,'cycles').pulse,false));
 check(()=>assert.equal(C.snapshot(p-.001,p,'continuous').count,1));
 check(()=>assert.equal(C.snapshot(p,p,'continuous').count,2));
}
for(const args of [
 [NaN,1,'cycles'],[Infinity,1,'cycles'],[0,NaN,'cycles'],[0,Infinity,'cycles'],
 [0,0,'cycles'],[0,-1,'cycles'],[0,1,'unknown'],[0,1,null]
])check(()=>assert.throws(()=>C.snapshot(...args),RangeError));
console.log(JSON.stringify({checks,passed:true,scope:'Pure timing model and invalid-input boundaries only'}));
