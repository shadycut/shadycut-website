// Static-site build step; uses only Node's standard library.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { ORIGIN, CONTENT_TYPES, pageInfo, excludedSource, parseRules, firstRule,
  publicPath, discoverContentPages } = require('./public-pages');
const REQUIRED = ['/', '/how-it-works/', '/features/', '/games/', '/news/', '/faq/'];
const rules = parseRules(fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8'));

function discoverPages() {
  const sources = [{ source: '/index.html', fallback: '/' }];
  const pagesRoot = path.join(ROOT, 'pages');
  for (const entry of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      sources.push({ source: `/pages/${entry.name}`, fallback: `/${entry.name.replace(/\.html$/, '')}` });
    } else if (entry.isDirectory() && !CONTENT_TYPES.includes(entry.name)) {
      const source = `/pages/${entry.name}/index.html`;
      if (fs.existsSync(path.join(ROOT, source.slice(1)))) {
        sources.push({ source, fallback: `/${entry.name}/` });
      }
    }
  }
  return sources.sort((a, b) => a.source.localeCompare(b.source, 'en'));
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

function generateSitemap() {
  const urls = new Set(discoverContentPages(ROOT, rules).map(page => ORIGIN + page.pathname));
  for (const { source, fallback } of discoverPages()) {
    if (excludedSource(source)) continue;
    const info = pageInfo(path.join(ROOT, source.slice(1)));
    if (!info.indexable) continue;
    const pathname = publicPath(rules, source, fallback, info.canonical);
    if (!pathname || pathname.startsWith('/pages/')) continue;
    const rule = firstRule(rules, pathname);
    if (rule && rule.status >= 300 && rule.status < 400) continue;
    urls.add(new URL(pathname, ORIGIN).href);
  }
  // Fail rather than silently publishing an incomplete sitemap or including a
  // required page that has become a redirect, draft, or noindex page.
  for (const pathname of REQUIRED) {
    if (!urls.has(ORIGIN + pathname)) throw new Error(`Required public page is missing or non-indexable: ${pathname}`);
  }
  const ordered = [...REQUIRED.map(pathname => ORIGIN + pathname),
    ...[...urls].filter(url => !REQUIRED.includes(new URL(url).pathname)).sort()];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ordered.map(url => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>\n`).join('') +
    '</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  console.log(`Generated sitemap.xml (${ordered.length} public URLs).`);
}

generateSitemap();
