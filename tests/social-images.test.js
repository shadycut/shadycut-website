const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { resolveSocialImage, imageSize, DEFAULT_IMAGE, DEFAULT_ALT } = require('../scripts/social-images');

const ORIGIN = 'https://shadycut.com';

function png(width, height) {
  const header = Buffer.alloc(25);
  header.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header.writeUInt8(8, 24);
  return header;
}

function jpeg(width, height) {
  const frame = Buffer.alloc(13);
  frame.writeUInt16BE(0xffc0, 0);
  frame.writeUInt16BE(11, 2);
  frame.writeUInt8(8, 4);
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02]), frame]);
}

function head(extra = '') {
  return ['<!doctype html>', '<html lang="en">', '<head>', '  <base href="/">', '  <title>Page - ShadyCut</title>',
    extra, '  <meta property="og:title" content="Page - ShadyCut">',
    '  <meta property="og:description" content="Description.">',
    '  <meta name="twitter:card" content="summary_large_image">', '</head>',
    '<body>Body</body>', '</html>', ''].filter(line => line !== '').join('\n');
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadycut-social-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('shadycut-social-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function write(file, contents) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  for (const name of ['public-pages.js', 'social-images.js', 'generate-social-images.js']) {
    write(`scripts/${name}`, fs.readFileSync(path.join(__dirname, '../scripts', name)));
  }
  write('assets/social/shadycut-og.jpg', jpeg(1200, 630));
  write('assets/articles/hero.jpg', jpeg(1672, 941));
  write('assets/social/dedicated.png', png(1200, 675));
  write('index.html', head());
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const run = (...args) => spawnSync(process.execPath,
    [path.join(root, 'scripts', 'generate-social-images.js'), ...args], { encoding: 'utf8' });
  return { root, write, read, run };
}

test('the shared rule prefers an override, then the hero, then the generic image', () => {
  assert.deepEqual(resolveSocialImage(head('  <meta name="hero-image" content="assets/articles/hero.jpg">\n' +
    '  <meta name="hero-image-alt" content="Hero alt">')),
  { src: 'assets/articles/hero.jpg', alt: 'Hero alt', origin: 'hero' });
  assert.deepEqual(resolveSocialImage(head('  <meta name="hero-image" content="assets/articles/hero.jpg">\n' +
    '  <meta name="social-image" content="/assets/social/dedicated.png">\n' +
    '  <meta name="social-image-alt" content="Dedicated alt">')),
  { src: '/assets/social/dedicated.png', alt: 'Dedicated alt', origin: 'override' });
  assert.deepEqual(resolveSocialImage(head()), { src: DEFAULT_IMAGE, alt: DEFAULT_ALT, origin: 'default' });
});

test('dimensions come from the image file itself', () => {
  assert.deepEqual(imageSize(jpeg(1672, 941)), { width: 1672, height: 941 });
  assert.deepEqual(imageSize(png(1200, 675)), { width: 1200, height: 675 });
  assert.equal(imageSize(Buffer.from('not an image')), null);
});

test('every page gets absolute og:image and twitter:image URLs from one resolved image', t => {
  const f = fixture(t);
  f.write('pages/articles/hero-page.html', head('  <meta name="hero-image" content="assets/articles/hero.jpg">\n' +
    '  <meta name="hero-image-alt" content="Hero alt">'));
  f.write('pages/articles/override-page.html', head('  <meta name="hero-image" content="assets/articles/hero.jpg">\n' +
    '  <meta name="social-image" content="/assets/social/dedicated.png">\n' +
    '  <meta name="social-image-alt" content="Dedicated alt">'));
  f.write('pages/terms.html', head());
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);

  const hero = f.read('pages/articles/hero-page.html');
  for (const tag of ['property="og:image"', 'name="twitter:image"']) {
    assert.ok(hero.includes(`<meta ${tag} content="${ORIGIN}/assets/articles/hero.jpg">`), tag);
  }
  assert.ok(hero.includes('<meta property="og:image:type" content="image/jpeg">'));
  assert.ok(hero.includes('<meta property="og:image:width" content="1672">'));
  assert.ok(hero.includes('<meta property="og:image:height" content="941">'));
  assert.ok(hero.includes('<meta property="og:image:alt" content="Hero alt">'));
  assert.ok(hero.includes('<meta name="twitter:image:alt" content="Hero alt">'));
  // The generated block stays with the other Open Graph tags and leaves the
  // page's own metadata and body untouched.
  assert.match(hero, /og:description[\s\S]*BEGIN AUTO-GENERATED SOCIAL IMAGE[\s\S]*END AUTO-GENERATED SOCIAL IMAGE[\s\S]*twitter:card/);
  assert.ok(hero.includes('<body>Body</body>'));

  const override = f.read('pages/articles/override-page.html');
  assert.ok(override.includes(`<meta property="og:image" content="${ORIGIN}/assets/social/dedicated.png">`));
  assert.ok(override.includes('<meta property="og:image:type" content="image/png">'));
  assert.ok(override.includes('<meta property="og:image:height" content="675">'));
  assert.ok(override.includes('<meta name="twitter:image:alt" content="Dedicated alt">'));

  for (const file of ['pages/terms.html', 'index.html']) {
    assert.ok(f.read(file).includes(`<meta property="og:image" content="${ORIGIN}/${DEFAULT_IMAGE}">`), file);
    assert.ok(f.read(file).includes(`<meta name="twitter:image:alt" content="${DEFAULT_ALT}">`), file);
  }
});

test('regeneration is stable and replaces hand-written image tags', t => {
  const f = fixture(t);
  f.write('pages/articles/hero-page.html', head('  <meta name="hero-image" content="assets/articles/hero.jpg">\n' +
    '  <meta name="hero-image-alt" content="Hero alt">\n' +
    '  <meta property="og:image" content="https://shadycut.com/assets/social/shadycut-og.jpg">\n' +
    '  <meta name="twitter:image" content="https://shadycut.com/assets/social/shadycut-og.jpg">'));
  assert.equal(f.run().status, 0);
  const first = f.read('pages/articles/hero-page.html');
  assert.equal((first.match(/og:image"/g) || []).length, 1);
  assert.equal((first.match(/twitter:image"/g) || []).length, 1);
  assert.ok(!first.includes('shadycut-og.jpg'));

  const second = f.run();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /0 updated/);
  assert.equal(f.read('pages/articles/hero-page.html'), first);
  assert.equal(f.run('--check').status, 0);
});

test('a referenced social image must exist, be a crawlable format, and be large enough', t => {
  const f = fixture(t);
  f.write('assets/articles/tiny.png', png(64, 64));
  f.write('assets/articles/hero.avif', Buffer.from('avif bytes'));
  const cases = [['assets/articles/missing.jpg', /social image not found/],
    ['assets/articles/tiny.png', /at least 200x200/],
    ['assets/articles/hero.avif', /unsupported social image format/],
    ['https://cdn.example.com/hero.jpg', /must be a site path/],
    ['../secrets/hero.jpg', /invalid social image path/]];
  for (const [src, message] of cases) {
    f.write('pages/articles/broken.html', head(`  <meta name="hero-image" content="${src}">`));
    const result = f.run();
    assert.equal(result.status, 1, src);
    assert.match(result.stderr, message);
    assert.match(result.stderr, /pages\/articles\/broken\.html/);
    // Validation fails before anything is written.
    assert.ok(!f.read('index.html').includes('og:image'), src);
  }
});

test('unfilled templates and pages without social metadata are left alone', t => {
  const f = fixture(t);
  f.write('pages/articles/draft-copy.html', head('  <meta name="hero-image" content="{{HERO_SRC}}">'));
  f.write('404.html', '<!doctype html>\n<html lang="en">\n<head>\n<meta name="robots" content="noindex">\n</head>\n<body>Missing</body>\n</html>\n');
  const before = { template: f.read('pages/articles/draft-copy.html'), missing: f.read('404.html') };
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read('pages/articles/draft-copy.html'), before.template);
  assert.equal(f.read('404.html'), before.missing);
});

test('every published page in the repository follows the shared rule', () => {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-social-images.js'), '--check'],
    { encoding: 'utf8', cwd: root });
  assert.equal(result.status, 0, result.stderr);
  for (const file of ['index.html', 'pages/features/index.html', 'pages/articles/why-shadycut-stops-before-the-final-edit.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const image = html.match(/<meta property="og:image" content="([^"]+)">/)[1];
    assert.ok(image.startsWith(`${ORIGIN}/`), file);
    assert.ok(html.includes(`<meta name="twitter:image" content="${image}">`), file);
  }
});
