async function loadComponent(selector, path) {
  const target = document.querySelector(selector);
  if (!target) return;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  target.outerHTML = await response.text();
}

Promise.all([
  loadComponent('[data-component="header"]', 'components/header.html'),
  loadComponent('[data-component="case-study-cta"]', 'components/case-study-cta.html'),
  loadComponent('[data-component="see-it-in-action"]', 'components/see-it-in-action.html'),
  loadComponent('[data-component="session-understanding"]', 'components/session-understanding.html'),
  loadComponent('[data-component="case-study-permission-note"]', 'components/case-study-permission-note.html'),
  loadComponent('[data-component="follow-the-journey"]', 'components/follow-the-journey.html'),
  loadComponent('[data-component="footer"]', 'components/footer.html')
]).then(() => {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('.menu-toggle');
  const panel = header?.querySelector('.mobile-menu-panel');
  const nav = panel?.querySelector('nav');

  // Navigation targets do not exist yet: keep the links inert instead of routing nowhere.
  header?.querySelectorAll('[data-nav-placeholder]').forEach((link) => {
    link.addEventListener('click', (event) => event.preventDefault());
  });

  // Desktop dropdowns. CSS handles hover and focus on its own; this adds a grace period on the way
  // out so a slow diagonal move towards the panel does not close it, plus click and Escape.
  const triggers = Array.from(header?.querySelectorAll('.nav-trigger') ?? []);
  const CLOSE_DELAY = 260;
  let closeTimer;
  const setOpen = (trigger, open) => {
    trigger.setAttribute('aria-expanded', String(open));
    trigger.closest('.nav-item')?.classList.toggle('is-open', open);
  };
  const closeDropdowns = (except) => triggers.forEach((trigger) => {
    if (trigger !== except) setOpen(trigger, false);
  });
  triggers.forEach((trigger) => {
    const item = trigger.closest('.nav-item');
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      closeDropdowns(trigger);
      setOpen(trigger, open);
    });
    if (!item) return;
    item.addEventListener('mouseenter', () => {
      window.clearTimeout(closeTimer);
      closeDropdowns(trigger);
      setOpen(trigger, true);
    });
    item.addEventListener('mouseleave', () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (!item.matches(':hover') && !item.contains(document.activeElement)) setOpen(trigger, false);
      }, CLOSE_DELAY);
    });
  });
  if (triggers.length) {
    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) closeDropdowns();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = triggers.find((trigger) => trigger.getAttribute('aria-expanded') === 'true');
      closeDropdowns();
      if (open) open.focus();
    });
    header.addEventListener('focusout', () => {
      window.requestAnimationFrame(() => {
        if (!header.contains(document.activeElement)) closeDropdowns();
      });
    });
  }

  if (!toggle || !panel || !nav) return;
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  panel.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.focus();
  });
}).catch((error) => console.error(error));
