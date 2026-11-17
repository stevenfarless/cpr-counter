/* Pure timing model; seconds on a shared audio timeline. */
'use strict';
(function(root){
 function validBpm(n){return Number.isInteger(n)&&n>=100&&n<=120;}
 function snapshot(elapsed,period,mode){
  if(!Number.isFinite(elapsed)||!Number.isFinite(period)||period<=0||!['cycles','continuous'].includes(mode))throw new RangeError('Invalid timing snapshot input.');
  if(elapsed<0)return {phase:'lead',count:0,pulse:false};
  if(mode==='cycles'&&elapsed>=30*period)return {phase:'breaths',count:30,pulse:false};
  const index=Math.floor(elapsed/period);
  return {phase:'compressions',count:index+1,pulse:elapsed-index*period<0.13};
 }
 root.CadenceCore=Object.freeze({validBpm,snapshot});
})(globalThis);
