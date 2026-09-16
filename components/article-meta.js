(() => {
  const body = document.querySelector('.article-detail .content-body');
  const value = document.querySelector('.article-meta [data-reading-time]');
  if (!body || !value) return;

  // Include body headings, checklist, quote and attribution; exclude the hero and CTA.
  const words = body.textContent.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? [];
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  value.textContent = `${minutes} min read`;
})();
