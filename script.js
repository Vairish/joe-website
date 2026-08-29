const $=(q,r=document)=>r.querySelector(q),$$=(q,r=document)=>[...r.querySelectorAll(q)];
$('#year').textContent=new Date().getFullYear();

const menu=$('#main-nav'),menuButton=$('.menu-button');
const navLinks=$$('a',menu),navIndicator=$('.nav-indicator',menu);
function placeNavIndicator(link=menu.querySelector('a.active')){
  if(!link||innerWidth<=800){navIndicator.style.opacity='0';return}
  navIndicator.style.width=`${link.offsetWidth}px`;
  navIndicator.style.transform=`translateX(${link.offsetLeft}px)`;
  navIndicator.style.opacity='1';
}
const initialLink=navLinks.find(link=>link.getAttribute('href')===location.hash)||navLinks[0];
initialLink.classList.add('active');
requestAnimationFrame(()=>placeNavIndicator(initialLink));
navLinks.forEach(link=>link.addEventListener('pointerenter',()=>placeNavIndicator(link)));
menu.addEventListener('pointerleave',()=>placeNavIndicator());
addEventListener('resize',()=>placeNavIndicator(),{passive:true});
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')==='true';menuButton.setAttribute('aria-expanded',String(!open));menu.classList.toggle('open',!open)});
$$('a',menu).forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');menuButton.setAttribute('aria-expanded','false')}));

const reveals=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');reveals.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -35px'});
$$('.reveal').forEach(el=>reveals.observe(el));
$$('.photo-grid,.project-grid,.post-list').forEach(group=>{
  $$('.reveal',group).forEach((item,index)=>item.style.transitionDelay=`${index*90}ms`);
});

const sections=$$('main section[id]');
const sectionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${entry.target.id}`));placeNavIndicator()}}),{rootMargin:'-40% 0px -50%'});
sections.forEach(section=>sectionObserver.observe(section));

function updateHeaderTime(){
  const time=new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  $('#header-time').innerHTML=`IRE&nbsp;&nbsp;${time}`;
}
updateHeaderTime();setInterval(updateHeaderTime,30000);

addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;$('.progress span').style.width=`${max?scrollY/max*100:0}%`;$('.site-header').classList.toggle('scrolled',scrollY>15)},{passive:true});

const lightbox=$('#lightbox');
$$('.photo-card').forEach(card=>card.addEventListener('click',()=>{$('img',lightbox).src=card.dataset.image;$('img',lightbox).alt=$('img',card).alt;$('p',lightbox).textContent=card.dataset.caption;lightbox.showModal()}));
$('button',lightbox).addEventListener('click',()=>lightbox.close());
lightbox.addEventListener('click',event=>{if(event.target===lightbox)lightbox.close()});

// Subtle interaction layer — disabled when reduced motion is preferred.
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reducedMotion){
  $$('.project').forEach(card=>{
    card.addEventListener('pointermove',event=>{
      const box=card.getBoundingClientRect();
      card.style.setProperty('--rotate-x',`${((event.clientY-box.top)/box.height-.5)*-5}deg`);
      card.style.setProperty('--rotate-y',`${((event.clientX-box.left)/box.width-.5)*7}deg`);
    });
    card.addEventListener('pointerleave',()=>{
      card.style.setProperty('--rotate-x','0deg');
      card.style.setProperty('--rotate-y','0deg');
    });
  });

  $$('.welcome-copy a,.post>a,.project>a').forEach(item=>{
    item.addEventListener('pointermove',event=>{
      const box=item.getBoundingClientRect();
      item.style.translate=`${(event.clientX-box.left-box.width/2)*.12}px ${(event.clientY-box.top-box.height/2)*.12}px`;
    });
    item.addEventListener('pointerleave',()=>item.style.translate='0 0');
  });
}
