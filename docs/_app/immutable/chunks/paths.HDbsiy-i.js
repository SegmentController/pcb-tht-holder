import{y as b,s as l}from"./scheduler.vdNBqtRQ.js";const e=[];function _(o,u=b){let i;const n=new Set;function r(t){if(l(o,t)&&(o=t,i)){const c=!e.length;for(const s of n)s[1](),e.push(s,o);if(c){for(let s=0;s<e.length;s+=2)e[s][0](e[s+1]);e.length=0}}}function f(t){r(t(o))}function a(t,c=b){const s=[t,c];return n.add(s),n.size===1&&(i=u(r,f)||b),t(o),()=>{n.delete(s),n.size===0&&i&&(i(),i=null)}}return{set:r,update:f,subscribe:a}}const h=globalThis.__sveltekit_1dh1dwc?.base??"/pcb-tht-holder",p=globalThis.__sveltekit_1dh1dwc?.assets??h;export{p as a,h as b,_ as w};
