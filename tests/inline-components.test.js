const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { excludedSource } = require('../scripts/public-pages');

const root = path.resolve(__dirname, '..');
const HEADER_LINKS = ['how-it-works/', 'features/', 'games/', 'news/', 'faq/'];
const FOOTER_LINKS = ['faq/', 'about/', 'privacy.html', 'terms.html', 'https://discord.gg/MBj6mBRqPG'];

function page(body) {
  return '<!doctype html>\n<html lang="en">\n<head>\n  <base href="/">\n</head>\n' +
    `<body>\n${body}\n  <script src="components/loader.js"></script>\n</body>\n</html>\n`;
}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadycut-components-'));
  t.after(() => {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('shadycut-components-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  function write(file, text) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  for (const name of ['public-pages.js', 'inline-components.js']) {
    write(`scripts/${name}`, fs.readFileSync(path.join(root, 'scripts', name)));
  }
  write('components/header.html', '<header class="site-shell site-header">\n' +
    '  <nav class="desktop-nav" aria-label="Primary navigation"><a href="news/">News</a></nav>\n' +
    '  <button class="menu-toggle" type="button" aria-expanded="false"></button>\n</header>\n');
  write('components/footer.html', '<div class="site-footer-wrap">\n' +
    '  <footer class="site-shell site-footer"><a href="faq/">FAQ</a></footer>\n</div>\n');
  const shell = ['  <div data-component="header"></div>', '  <main id="top">Body</main>',
    '  <div data-component="footer"></div>'].join('\n');
  for (const file of ['index.html', '404.html', 'pages/about/index.html', 'pages/updates/published.html']) {
    write(file, page(shell));
  }
  // Templates keep their placeholders: they are scaffolding, never served.
  write('templates/article.html', page(shell));
  write('pages/updates/draft-next.html', page(shell));
  write('case-studies/260802-pilot/story-blueprint.html', page('  <main>Report</main>'));
  const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
  const run = () => spawnSync(process.execPath, [path.join(dir, 'scripts', 'inline-components.js')], { encoding: 'utf8' });
  return { dir, write, read, run, page, shell };
}

test('build inlines the shared shell into every public page and stays deterministic', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  for (const file of ['index.html', '404.html', 'pages/about/index.html', 'pages/updates/published.html']) {
    const html = f.read(file);
    assert.ok(!html.includes('data-component="header"'), file);
    assert.ok(!html.includes('data-component="footer"'), file);
    assert.match(html, /<nav class="desktop-nav" aria-label="Primary navigation"><a href="news\/">News<\/a><\/nav>/);
    assert.match(html, /<footer class="site-shell site-footer"><a href="faq\/">FAQ<\/a><\/footer>/);
    for (const name of ['header', 'footer']) {
      assert.equal(html.split(`BEGIN AUTO-GENERATED COMPONENT ${name}`).length - 1, 1, `${file} ${name}`);
      assert.equal(html.split(`END AUTO-GENERATED COMPONENT ${name}`).length - 1, 1, `${file} ${name}`);
    }
    // Inlining replaces the placeholder in place and leaves the page untouched around it.
    assert.match(html, /<\/header>\n  <!-- END AUTO-GENERATED COMPONENT header -->\n  <main id="top">Body<\/main>/);
    assert.match(html, /<script src="components\/loader\.js"><\/script>/);
  }
  // Scaffolding and standalone reports are left alone; an unpublished page source
  // still gets the shell so it is correct the moment it is published.
  assert.equal(f.read('templates/article.html'), f.page(f.shell));
  assert.equal(f.read('case-studies/260802-pilot/story-blueprint.html'), f.page('  <main>Report</main>'));
  assert.match(f.read('pages/updates/draft-next.html'), /BEGIN AUTO-GENERATED COMPONENT header/);

  const stable = f.read('index.html');
  const second = f.run();
  assert.equal(second.status, 0);
  assert.match(second.stdout, /5 pages, 0 updated/);
  assert.equal(f.read('index.html'), stable);

  // The fragment stays the single source of truth: editing it updates every page.
  f.write('components/footer.html', '<footer class="site-shell site-footer"><a href="about/">About</a></footer>\n');
  assert.equal(f.run().status, 0);
  const updated = f.read('pages/about/index.html');
  assert.match(updated, /<a href="about\/">About<\/a>/);
  assert.ok(!updated.includes('site-footer-wrap'));
  assert.equal(updated.split('BEGIN AUTO-GENERATED COMPONENT footer').length - 1, 1);
});

test('missing or duplicated shell fails the build without rewriting pages', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const before = f.read('index.html');
  const about = f.read('pages/about/index.html');

  f.write('pages/faq/index.html', f.page('  <div data-component="header"></div>\n  <main>FAQ</main>'));
  let result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing the shared footer component: pages\/faq\/index\.html/);
  assert.equal(f.read('index.html'), before);

  f.write('pages/faq/index.html', f.page(f.shell));
  f.write('components/footer.html', '<footer class="site-footer">Changed</footer>\n');
  f.write('pages/about/index.html', about.replace('<main id="top">Body</main>',
    '<main id="top">Body</main>\n  <div data-component="header"></div>'));
  result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate header component in pages\/about\/index\.html/);
  assert.equal(f.read('index.html'), before);
});

test('every public page in the repository ships the real navigation and footer links', () => {
  const pages = ['index.html', '404.html'];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.relative(root, path.join(directory, entry.name)).split(path.sep).join('/');
      if (entry.isDirectory()) walk(path.join(directory, entry.name));
      else if (entry.name.endsWith('.html') && !excludedSource(`/${file}`)) pages.push(file);
    }
  };
  walk(path.join(root, 'pages'));
  assert.ok(pages.length >= 16);
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!html.includes('data-component="header"'), file);
    assert.ok(!html.includes('data-component="footer"'), file);
    assert.match(html, /<header class="site-shell site-header">/, file);
    assert.match(html, /<nav class="desktop-nav" aria-label="Primary navigation">/, file);
    assert.match(html, /<div class="mobile-menu-panel" id="mobile-navigation">/, file);
    assert.match(html, /aria-controls="mobile-navigation"/, file);
    assert.match(html, /<footer class="site-shell site-footer">/, file);
    for (const href of HEADER_LINKS) assert.ok(html.includes(`class="nav-top-link" href="${href}"`), `${file} ${href}`);
    for (const href of HEADER_LINKS) assert.ok(html.includes(`class="mobile-nav-group-link" href="${href}"`), `${file} ${href}`);
    for (const href of FOOTER_LINKS) assert.ok(html.includes(`href="${href}"`), `${file} ${href}`);
    assert.match(html, /<script src="components\/loader\.js"><\/script>/, file);
  }
});

test('the runtime loader no longer fetches the inlined shell but still wires up its behaviour', () => {
  const loader = fs.readFileSync(path.join(root, 'components/loader.js'), 'utf8');
  const fetched = [...loader.matchAll(/loadComponent\('\[data-component="([^"]+)"\]/g)].map(match => match[1]);
  assert.deepEqual(fetched, ['case-study-cta', 'see-it-in-action', 'session-understanding',
    'case-study-permission-note', 'follow-the-journey', 'discord-questions-cta']);
  for (const selector of ['.site-header', '.menu-toggle', '.mobile-menu-panel', '.nav-trigger']) {
    assert.ok(loader.includes(selector), selector);
  }
});
