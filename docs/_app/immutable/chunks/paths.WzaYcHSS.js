import{y as l,s as q,a6 as w,M as m,L as k}from"./scheduler.2uZGbjKm.js";const u=[];function v(e,i){return{subscribe:x(e,i).subscribe}}function x(e,i=l){let r;const n=new Set;function a(t){if(q(e,t)&&(e=t,r)){const o=!u.length;for(const s of n)s[1](),u.push(s,e);if(o){for(let s=0;s<u.length;s+=2)u[s][0](u[s+1]);u.length=0}}}function b(t){a(t(e))}function f(t,o=l){const s=[t,o];return n.add(s),n.size===1&&(r=i(a,b)||l),t(e),()=>{n.delete(s),n.size===0&&r&&(r(),r=null)}}return{set:a,update:b,subscribe:f}}function T(e,i,r){const n=!Array.isArray(e),a=n?[e]:e;if(!a.every(Boolean))throw new Error("derived() expects stores as input, got a falsy value");const b=i.length<2;return v(r,(f,t)=>{let o=!1;const s=[];let d=0,p=l;const y=()=>{if(d)return;p();const c=i(n?s[0]:s,f,t);b?f(c):p=k(c)?c:l},h=a.map((c,_)=>w(c,g=>{s[_]=g,d&=~(1<<_),o&&y()},()=>{d|=1<<_}));return o=!0,y(),function(){m(h),p(),o=!1}})}const z=globalThis.__sveltekit_1yq8d1y?.base??"/pcb-tht-holder",B=globalThis.__sveltekit_1yq8d1y?.assets??z;export{B as a,z as b,T as d,v as r,x as w};
