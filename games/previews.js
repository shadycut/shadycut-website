(() => {
  const previews = [];

  document.querySelectorAll('.game-card').forEach((card) => {
    const video = card.querySelector('video');
    if (!video) return;
    previews.push(video);

    const showImage = () => card.classList.remove('is-playing');
    video.addEventListener('playing', () => card.classList.add('is-playing'));
    video.addEventListener('error', showImage);
    video.addEventListener('waiting', showImage);
    video.addEventListener('pause', showImage);
    video.muted = true;
    // Hover only changes opacity in CSS; playback and its source stay intact.
    if (!document.hidden) video.play().catch(showImage);
  });

  document.addEventListener('visibilitychange', () => {
    previews.forEach((video) => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    });
  });
  window.addEventListener('pagehide', () => previews.forEach((video) => video.pause()));
})();
