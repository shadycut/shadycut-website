const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { parseRules, publicPath } = require('../scripts/public-pages');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadycut-routes-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('shadycut-routes-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function write(file, text) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  for (const name of ['public-pages.js', 'generate-routes.js', 'generate-sitemap.js']) {
    write(`scripts/${name}`, fs.readFileSync(path.join(__dirname, '../scripts', name)));
  }
  write('index.html', '<html><head></head><body>Home</body></html>');
  let manual = '# Manual rules with CRLF\r\n';
  for (const slug of ['how-it-works', 'features', 'games', 'news', 'faq']) {
    write(`pages/${slug}/index.html`, '<html>Public hub</html>');
    manual += `/${slug}/ /pages/${slug}/ 200\r\n`;
  }
  manual += '/updates/existing/ /updates/existing 301\r\n' +
    '/updates/existing /pages/updates/existing 200\r\n' +
    '/old-download /downloads/report.html 301\r\n/pages/* /:splat 301\r\n';
  write('_redirects', manual);
  write('pages/updates/existing.html', '<html>Existing content</html>');
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const run = name => spawnSync(process.execPath, [path.join(root, 'scripts', `generate-${name}.js`)], { encoding: 'utf8' });
  function build() {
    for (const name of ['routes', 'sitemap']) {
      const result = run(name);
      assert.equal(result.status, 0, result.stderr);
    }
  }
  return { root, write, read, run, build, manual };
}

test('build discovers all content layouts, preserves manual bytes, and is deterministic', t => {
  const f = fixture(t);
  f.write('pages/updates/new-flat.html', '<html>Flat</html>');
  f.write('pages/case-studies/new-case/index.html', '<html>Directory</html>');
  f.write('pages/articles/new-article/index.html', '<html>Article</html>');
  f.build();
  const routes = f.read('_redirects');
  const xml = f.read('sitemap.xml');
  const marker = '# END AUTO-GENERATED CONTENT ROUTES\r\n';
  assert.equal(routes.slice(routes.indexOf(marker) + marker.length), f.manual);
  const rules = parseRules(routes);
  assert.equal(new Set(rules.map(r => r.from)).size, rules.length);
  for (const [publicUrl, target] of [
    ['/updates/new-flat/', '/pages/updates/new-flat'],
    ['/case-studies/new-case/', '/pages/case-studies/new-case/'],
    ['/articles/new-article/', '/pages/articles/new-article/']
  ]) {
    assert.ok(rules.some(r => r.from === publicUrl && r.to === target && r.status === 200));
    assert.ok(xml.includes(`https://shadycut.com${publicUrl}</loc>`));
  }
  assert.ok(xml.includes('https://shadycut.com/updates/existing</loc>'));
  assert.ok(!xml.includes('/pages/'));
  f.build();
  assert.equal(f.read('_redirects'), routes);
  assert.equal(f.read('sitemap.xml'), xml);
  fs.unlinkSync(path.join(f.root, 'pages/updates/new-flat.html'));
  f.build();
  assert.ok(!f.read('_redirects').includes('/updates/new-flat'));
  assert.ok(!f.read('sitemap.xml').includes('/updates/new-flat'));
});

test('both generators exclude drafts, noindex, redirects, aliases, scaffolding and non-HTML', t => {
  const f = fixture(t);
  const excluded = {
    'noindex.html': '<meta content="follow, NOINDEX" name="robots">',
    'draft-marked.html': '<meta name="draft" content="true">',
    'draft-folder/index.html': '<html>Draft</html>',
    'redirect.html': '<meta http-equiv="refresh" content="0;url=/news/">',
    'alias.html': '<link rel="canonical" href="https://shadycut.com/updates/another/">',
    'external.html': '<link rel="canonical" href="https://example.com/updates/external/">',
    'template.html': '<title>{{TITLE}}</title>',
    'README.html': '<html>Readme</html>',
    'index.html': '<html>Archive scaffolding</html>',
    'image.png': 'Not HTML'
  };
  for (const [file, html] of Object.entries(excluded)) f.write(`pages/updates/${file}`, html);
  f.write('pages/updates/published.html', '<!-- <meta name="robots" content="noindex"> --><html>Published</html>');
  f.build();
  const rules = parseRules(f.read('_redirects'));
  assert.deepEqual(rules.filter(r => r.status === 200 && r.from.startsWith('/updates/')).map(r => r.from).sort(),
    ['/updates/existing', '/updates/published/']);
  const xml = f.read('sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.filter(url => url.includes('/updates/')).length, 2);
  f.write('pages/updates/published.html', '<meta name="robots" content="noindex">');
  f.build();
  assert.ok(!f.read('_redirects').includes('/updates/published'));
  assert.ok(!f.read('sitemap.xml').includes('/updates/published'));
});

test('ambiguous layouts, manual conflicts and malformed markers fail without writing routes', t => {
  const f = fixture(t);
  f.write('pages/updates/collision.html', '<html>Flat</html>');
  f.write('pages/updates/collision/index.html', '<html>Directory</html>');
  let result = f.run('routes');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Conflicting content slug updates\/collision/);
  assert.equal(f.read('_redirects'), f.manual);
  fs.unlinkSync(path.join(f.root, 'pages/updates/collision.html'));
  f.write('_redirects', f.manual + '/updates/collision /news/ 301\r\n');
  const conflict = f.read('_redirects');
  result = f.run('routes');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /conflicts with manual rule/);
  assert.equal(f.read('_redirects'), conflict);
  f.write('_redirects', '# BEGIN AUTO-GENERATED CONTENT ROUTES\r\n' + f.manual);
  result = f.run('routes');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid or duplicate/);
});

test('canonical validation requires the exact public URL with and without a proxy', () => {
  for (const [source, publicUrl, aliases] of [
    ['/pages/privacy.html', '/privacy', ['/privacy.html', '/privacy/']],
    ['/pages/terms.html', '/terms', ['/terms.html', '/terms/']],
    ['/pages/features/index.html', '/features/', ['/features', '/features/index.html']],
    ['/pages/updates/new-flat.html', '/updates/new-flat/', ['/updates/new-flat', '/updates/new-flat.html']]
  ]) {
    for (const rules of [[], [{ from: publicUrl, to: source, status: 200 }]]) {
      assert.equal(publicPath(rules, source, publicUrl, `https://shadycut.com${publicUrl}`), publicUrl);
      for (const alias of aliases) {
        assert.throws(() => publicPath(rules, source, publicUrl, `https://shadycut.com${alias}`),
          /Canonical URL mismatch/);
      }
    }
  }
  // The actual proxy, not the generated-route fallback, defines the public URL.
  const rules = [{ from: '/updates/existing', to: '/pages/updates/existing', status: 200 }];
  assert.equal(publicPath(rules, '/pages/updates/existing.html', '/updates/existing/',
    'https://shadycut.com/updates/existing'), '/updates/existing');
});

test('sitemap rejects redirecting legal-page canonicals without changing generated output', t => {
  const f = fixture(t);
  f.write('_redirects', f.manual + '/privacy.html /privacy 308\r\n/privacy /pages/privacy 200\r\n' +
    '/terms.html /terms 308\r\n/terms /pages/terms 200\r\n');
  for (const slug of ['privacy', 'terms']) {
    f.write(`pages/${slug}.html`, `<link rel="canonical" href="https://shadycut.com/${slug}">`);
  }
  f.build();
  const routes = f.read('_redirects');
  const sitemap = f.read('sitemap.xml');
  for (const slug of ['privacy', 'terms']) {
    assert.ok(sitemap.includes(`https://shadycut.com/${slug}</loc>`));
    f.write(`pages/${slug}.html`, `<link rel="canonical" href="https://shadycut.com/${slug}.html">`);
    const result = f.run('sitemap');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Canonical URL mismatch/);
    assert.ok(result.stderr.includes(`expected https://shadycut.com/${slug}`));
    assert.equal(f.read('sitemap.xml'), sitemap);
    assert.equal(f.read('_redirects'), routes);
    f.write(`pages/${slug}.html`, `<link rel="canonical" href="https://shadycut.com/${slug}">`);
  }
  f.build();
  assert.equal(f.read('sitemap.xml'), sitemap);
  assert.equal(f.read('_redirects'), routes);
});
