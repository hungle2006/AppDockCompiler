(()=>{'use strict';
const attach=()=>{const root=document.querySelector('#app-sidebar nav.nav');if(!root||root.querySelector('.appdock-firmware-nav'))return;
 const link=document.createElement('a');link.className='appdock-firmware-nav';link.href='/firmware';link.setAttribute('aria-label','Nạp firmware cho board Arduino và ESP');link.innerHTML='<span aria-hidden="true" class="appdock-firmware-nav-ico">⌘</span><span>Nạp firmware</span><span class="appdock-firmware-nav-tag">NEW</span>';root.appendChild(link)};
 let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;attach()})};
 document.addEventListener('DOMContentLoaded',()=>{attach();new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})});
})();