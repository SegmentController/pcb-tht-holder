import{y as l,s as w,a6 as x,M as m,L as q}from"./scheduler.2uZGbjKm.js";const u=[];function k(e,i){return{subscribe:v(e,i).subscribe}}function v(e,i=l){let r;const n=new Set;function a(t){if(w(e,t)&&(e=t,r)){const o=!u.length;for(const s of n)s[1](),u.push(s,e);if(o){for(let s=0;s<u.length;s+=2)u[s][0](u[s+1]);u.length=0}}}function b(t){a(t(e))}function f(t,o=l){const s=[t,o];return n.add(s),n.size===1&&(r=i(a,b)||l),t(e),()=>{n.delete(s),n.size===0&&r&&(r(),r=null)}}return{set:a,update:b,subscribe:f}}function T(e,i,r){const n=!Array.isArray(e),a=n?[e]:e;if(!a.every(Boolean))throw new Error("derived() expects stores as input, got a falsy value");const b=i.length<2;return k(r,(f,t)=>{let o=!1;const s=[];let d=0,p=l;const h=()=>{if(d)return;p();const c=i(n?s[0]:s,f,t);b?f(c):p=q(c)?c:l},g=a.map((c,_)=>x(c,y=>{s[_]=y,d&=~(1<<_),o&&h()},()=>{d|=1<<_}));return o=!0,h(),function(){m(g),p(),o=!1}})}const z=globalThis.__sveltekit_4dwx05?.base??"/pcb-tht-holder",B=globalThis.__sveltekit_4dwx05?.assets??z;export{B as a,z as b,T as d,k as r,v as w};