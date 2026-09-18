// Proxy to native clean source routes: Cloudflare normalizes .html/index.html
// targets, which can otherwise expose /pages/ in browser-visible redirects.
const fs = require('node:fs');
const path = require('node:path');
const { parseRules, firstRule, discoverContentPages } = require('./public-pages');
const ROOT = path.resolve(__dirname, '..');
const filename = path.join(ROOT, '_redirects');
const BEGIN = '# BEGIN AUTO-GENERATED CONTENT ROUTES';
const END = '# END AUTO-GENERATED CONTENT ROUTES';
const original = fs.readFileSync(filename, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';

function splitBlock(text) {
  const begins = [...text.matchAll(/^# BEGIN AUTO-GENERATED CONTENT ROUTES\r?$/gm)];
  const ends = [...text.matchAll(/^# END AUTO-GENERATED CONTENT ROUTES\r?$/gm)];
  if (!begins.length && !ends.length) {
    // Prepend so broad catchalls cannot shadow new routes. Existing exact
    // manual routes remain authoritative and are never duplicated below.
    return { prefix: '', suffix: text };
  }
  if (begins.length !== 1 || ends.length !== 1 || begins[0].index >= ends[0].index) {
    throw new Error('Invalid or duplicate auto-generated route markers; _redirects was not changed.');
  }
  const afterEnd = ends[0].index + ends[0][0].length;
  return { prefix: text.slice(0, begins[0].index), suffix: text.slice(afterEnd).replace(/^\n/, '') };
}

const { prefix, suffix } = splitBlock(original);
const manualRules = parseRules(prefix + suffix);
const precedingRules = parseRules(prefix);
const generated = [];
const paths = new Set();
const pages = discoverContentPages(ROOT, manualRules);
for (const page of pages) {
  if (page.manual) continue;
  const base = page.pathname.slice(0, -1);
  const aliases = [base, base + '.html', base + '/index', base + '/index.html'];
  const candidates = [...aliases.map(from => ({ from, to: page.pathname, status: 308 })),
    { from: page.pathname, to: page.target, status: 200 }];
  for (const rule of candidates) {
    if (paths.has(rule.from)) throw new Error(`Duplicate generated public route: ${rule.from}`);
    if (manualRules.some(manual => manual.from === rule.from)) throw new Error(`Generated route conflicts with manual rule: ${rule.from}`);
    const earlier = firstRule(precedingRules, rule.from);
    if (earlier) throw new Error(`Manual rule before generated block shadows ${rule.from}: ${earlier.from}`);
    paths.add(rule.from);
    generated.push(`${rule.from} ${rule.to} ${rule.status}`);
  }
}
const output = prefix + [BEGIN, ...generated, END, ''].join(newline) + suffix;
if (output !== original) fs.writeFileSync(filename, output);
console.log(`Generated content routes (${pages.filter(page => !page.manual).length} pages, ${generated.length} rules).`);
