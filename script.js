const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

$('#year').textContent = new Date().getFullYear();

const header = $('.site-header');
const menu = $('#main-nav');
const menuButton = $('.menu-button');

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menu.classList.toggle('open', !open);
});

$$('a', menu).forEach(link => link.addEventListener('click', () => {
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

addEventListener('scroll', () => {
  header.classList.toggle('scrolled', scrollY > 24);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && scrollY < innerHeight) {
    $('.hero-background img').style.transform = `scale(1.015) translateY(${scrollY * .045}px)`;
  }
}, { passive: true });

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .07, rootMargin: '0px 0px -30px' });
$$('.reveal').forEach(item => revealObserver.observe(item));

const navLinks = $$('a', menu);
const sections = ['photography', 'music', 'software', 'notes'].map(id => document.getElementById(id));
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -55%' });
sections.forEach(section => sectionObserver.observe(section));

const stack = $('#polaroid-stack');
if (stack) {
  const cards = $$('.card', stack);
  let order = [...cards];

  const restack = () => order.forEach((card, index) => {
    card.classList.remove('slot-1', 'slot-2', 'slot-3');
    card.classList.add(`slot-${index + 1}`);
    $('.card-hit', card).setAttribute('aria-disabled', String(index === 0));
  });

  cards.forEach(card => $('.card-hit', card).addEventListener('click', () => {
    if (order[0] === card) return;
    order = [card, ...order.filter(other => other !== card)];
    restack();
  }));

  restack();
}

const lightbox = $('#lightbox');
$$('.photo').forEach(button => button.addEventListener('click', () => {
  const image = $('img', lightbox);
  image.src = button.dataset.image;
  image.alt = $('img', button).alt;
  $('p', lightbox).textContent = button.dataset.caption;
  lightbox.showModal();
}));

$('button', lightbox).addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => {
  if (event.target === lightbox) lightbox.close();
});
