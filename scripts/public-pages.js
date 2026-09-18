const fs = require('node:fs');
const path = require('node:path');
const ORIGIN = 'https://shadycut.com';
const CONTENT_TYPES = ['articles', 'case-studies', 'updates'];

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return result;
}

function pageInfo(filename) {
  const html = fs.readFileSync(filename, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  let canonical;
  for (const match of html.matchAll(/<(meta|link)\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const name = (attrs.name || '').toLowerCase();
    const content = (attrs.content || '').trim().toLowerCase();
    if ((['robots', 'googlebot', 'bingbot'].includes(name) && /\b(noindex|none)\b/.test(content)) ||
        (attrs['http-equiv'] || '').toLowerCase() === 'refresh' ||
        (['draft', 'status', 'publication-status'].includes(name) && /^(true|draft|unpublished)$/.test(content))) return { indexable: false };
    if (match[1].toLowerCase() === 'link' && /\bcanonical\b/i.test(attrs.rel || '')) canonical = attrs.href;
  }
  return { indexable: !/\{\{[A-Z_]+\}\}/.test(html), canonical };
}

function excludedSource(source) {
  return source.split('/').some(segment => /^(?:[._]|draft(?:s)?(?:[.-]|$)|templates?(?:[.-]|$)|readme(?:\.|$))/i.test(segment));
}

function parseRules(text) {
  return text.split(/\r?\n/).map(line => line.replace(/\s*#.*$/, '').trim().split(/\s+/))
    .filter(parts => parts.length >= 3)
    .map(([from, to, status]) => ({ from, to, status: Number(status) }));
}

function matches(pattern, pathname) {
  const expression = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${expression}$`).test(pathname);
}

function firstRule(rules, pathname) { return rules.find(rule => matches(rule.from, pathname)); }
function sourceKey(filename) { return filename.replace(/\/index(?:\.html)?\/?$/, '/').replace(/\.html$/, ''); }
function proxyFor(rules, source) {
  return rules.find(rule => rule.status === 200 && !rule.from.includes('*') && sourceKey(rule.to) === sourceKey(source));
}

function publicPath(rules, source, fallback, canonical) {
  const proxy = proxyFor(rules, source);
  const pathname = proxy ? proxy.from : fallback;
  if (canonical) {
    let url;
    try { url = new URL(canonical, ORIGIN); } catch { return null; }
    if (url.origin !== ORIGIN || url.search || url.hash || url.pathname.startsWith('/pages/')) return null;
    if (sourceKey(url.pathname).replace(/\/$/, '') !== sourceKey(pathname).replace(/\/$/, '')) return null;
    // Source-key equivalence identifies aliases; it does not make redirecting
    // .html, index.html or trailing-slash variants valid canonical URLs.
    if (url.pathname !== pathname) {
      throw new Error(`Canonical URL mismatch for ${source}: ${canonical}; expected ${ORIGIN}${pathname}`);
    }
  }
  return pathname;
}

function discoverContentPages(root, rules) {
  const sources = [];
  for (const type of CONTENT_TYPES) {
    const directory = path.join(root, 'pages', type);
    if (!fs.existsSync(directory)) continue;
    const slugs = new Map();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      let source, slug;
      if (entry.isFile() && entry.name !== 'index.html' && entry.name.endsWith('.html')) {
        slug = entry.name.slice(0, -5);
        source = `/pages/${type}/${entry.name}`;
      } else if (entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, 'index.html'))) {
        slug = entry.name;
        source = `/pages/${type}/${slug}/index.html`;
      } else continue;
      if (slugs.has(slug)) throw new Error(`Conflicting content slug ${type}/${slug}: ${slugs.get(slug)} and ${source}`);
      slugs.set(slug, source);
      if (excludedSource(source)) continue;
      if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) throw new Error(`Invalid content slug: ${source}`);
      sources.push({ source, fallback: `/${type}/${slug}/` });
    }
  }
  return sources.sort((a, b) => a.source.localeCompare(b.source, 'en')).flatMap(({ source, fallback }) => {
    const info = pageInfo(path.join(root, source.slice(1)));
    if (!info.indexable) return [];
    const pathname = publicPath(rules, source, fallback, info.canonical);
    if (!pathname || pathname.startsWith('/pages/')) return [];
    const rule = firstRule(rules, pathname);
    if (rule && rule.status >= 300 && rule.status < 400) return [];
    return [{ source, pathname, target: sourceKey(source), manual: Boolean(proxyFor(rules, source)) }];
  });
}

module.exports = { ORIGIN, CONTENT_TYPES, attributes, pageInfo, excludedSource, parseRules, firstRule,
  publicPath, discoverContentPages };
