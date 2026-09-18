const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseRules, firstRule } = require('../scripts/public-pages');

const root = path.resolve(__dirname, '..');
const missingPaths = ['/does-not-exist-404-check', '/missing/deep/page/',
  '/features/nonexistent', '/assets/missing-404-check.css'];

test('root 404 page is noindex and resolves shared assets from any missing URL', () => {
  const html = fs.readFileSync(path.join(root, '404.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<base href="\/">/);
  assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
  assert.match(html, /class="button button-primary" href="\/">Back to homepage<\/a>/);
  assert.match(html, /href="\/assets\/css\/styles\.css"/);
  // The shared shell is inlined at build time, so the 404 page keeps working navigation
  // without JavaScript. See tests/inline-components.test.js.
  assert.match(html, /<header class="site-shell site-header">/);
  assert.match(html, /<footer class="site-shell site-footer">/);
  assert.ok(!html.includes('data-component="header"'));
  assert.ok(!html.includes('data-component="footer"'));
  assert.match(html, /src="components\/loader\.js"/);
  const rules = parseRules(fs.readFileSync(path.join(root, '_redirects'), 'utf8'));
  for (const pathname of missingPaths) assert.equal(firstRule(rules, pathname), undefined);
});

// Opt in against Wrangler Pages (not a plain static server):
// SHADYCUT_PREVIEW_URL=http://127.0.0.1:8790 node --test tests/404.test.js
test('Pages preview returns real 404s while existing public proxies still return 200', {
  skip: !process.env.SHADYCUT_PREVIEW_URL
}, async () => {
  const origin = process.env.SHADYCUT_PREVIEW_URL;
  const expected404 = fs.readFileSync(path.join(root, '404.html'), 'utf8');
  const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const pathname of missingPaths) {
    const response = await fetch(new URL(pathname, origin), { redirect: 'manual' });
    assert.equal(response.status, 404, pathname);
    const html = await response.text();
    assert.equal(html, expected404, pathname);
    assert.notEqual(html, homepage, pathname);
  }
  const rules = parseRules(fs.readFileSync(path.join(root, '_redirects'), 'utf8'));
  for (const pathname of ['/', ...rules.filter(rule => rule.status === 200).map(rule => rule.from)]) {
    const response = await fetch(new URL(pathname, origin), { redirect: 'manual' });
    assert.equal(response.status, 200, pathname);
    assert.notEqual(await response.text(), expected404, pathname);
  }
});
