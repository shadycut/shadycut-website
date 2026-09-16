(() => {
  const grid = document.querySelector('.news-grid');
  const filters = document.querySelector('.news-filters');
  if (!grid || !filters) return;

  // ISO publication dates keep every filtered view in newest-first order.
  // Equal dates retain the order in the page; the sources have no publication times.
  const cards = Array.from(grid.querySelectorAll('[data-news-type]'))
    .sort((a, b) => b.dataset.published.localeCompare(a.dataset.published));
  cards.forEach((card) => grid.append(card));

  const buttons = Array.from(filters.querySelectorAll('button[data-filter]'));
  const status = document.querySelector('.news-filter-status');
  filters.hidden = false;
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.filter;
      buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      cards.forEach((card) => {
        card.hidden = type !== 'all' && card.dataset.newsType !== type;
        if (card.hidden) card.querySelector('video')?.pause();
      });
      if (status) status.textContent = type === 'all' ? 'Showing all content.' : `Showing ${button.textContent}.`;
    });
  });

  // Play the real previews only while their cards are visible. Keep the poster
  // if playback is unavailable or the viewer prefers reduced motion.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const previews = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting && !target.closest('.news-card').hidden) {
          target.play().catch(() => {});
        } else {
          target.pause();
        }
      });
    });
    grid.querySelectorAll('video').forEach((video) => previews.observe(video));
  }
})();
