// Static-site build step; uses only Node's standard library.
// Inlines the shared header and footer into every public page so the primary
// navigation and footer link graph is present in the served HTML without
// JavaScript. components/header.html and components/footer.html stay the single
// source of truth: the blocks below are regenerated from them on every build.
const fs = require('node:fs');
const path = require('node:path');
const { excludedSource } = require('./public-pages');

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS = ['header', 'footer'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'private', 'templates', 'components']);
const ENTRY_PAGES = ['index.html', '404.html'];

const begin = name => `<!-- BEGIN AUTO-GENERATED COMPONENT ${name}: edit components/${name}.html -->`;
const end = name => `<!-- END AUTO-GENERATED COMPONENT ${name} -->`;

function placeholderPattern(name) {
  return new RegExp(`^([ \\t]*)<div\\s+data-component="${name}"\\s*>\\s*</div>[ \\t]*$`, 'gm');
}

function blockPattern(name) {
  return new RegExp(`^([ \\t]*)<!-- BEGIN AUTO-GENERATED COMPONENT ${name}\\b[^\\n]*-->` +
    `[\\s\\S]*?^[ \\t]*<!-- END AUTO-GENERATED COMPONENT ${name} -->[ \\t]*$`, 'gm');
}

function readComponent(name) {
  const html = fs.readFileSync(path.join(ROOT, 'components', `${name}.html`), 'utf8');
  return html.replace(/\r\n/g, '\n').replace(/^\s+|\s+$/g, '');
}

// Re-indent under the placeholder so regenerating a page is byte-stable.
function renderBlock(name, markup, indent) {
  const body = markup.split('\n').map(line => (line.trim() ? indent + line : '')).join('\n');
  return `${indent}${begin(name)}\n${body}\n${indent}${end(name)}`;
}

function inline(html, name, markup) {
  let matches = 0;
  const replace = (pattern) => {
    html = html.replace(pattern, (match, indent) => {
      matches += 1;
      return renderBlock(name, markup, indent);
    });
  };
  // An existing block is regenerated in place; a fresh placeholder is converted.
  replace(blockPattern(name));
  replace(placeholderPattern(name));
  return { html, matches };
}

function walkPages(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) continue;
      walkPages(absolute, results);
    } else if (entry.name.endsWith('.html')) {
      results.push(path.relative(ROOT, absolute).split(path.sep).join('/'));
    }
  }
  return results;
}

// Every entry page and every non-draft page source must carry the shared shell;
// a page that silently lost it would ship without the navigation link graph.
function requiredPages(files) {
  const required = new Set(ENTRY_PAGES.filter(file => fs.existsSync(path.join(ROOT, file))));
  for (const file of files) {
    if (file.startsWith('pages/') && !excludedSource(`/${file}`)) required.add(file);
  }
  return required;
}

function inlineComponents() {
  const markup = new Map(COMPONENTS.map(name => [name, readComponent(name)]));
  const files = walkPages(ROOT);
  const required = requiredPages(files);
  for (const file of required) {
    if (!files.includes(file)) throw new Error(`Expected public page is missing: ${file}`);
  }
  // Validate every page before touching any of them, so a broken page fails the
  // build instead of leaving the site half rewritten.
  const pending = [];
  let inlined = 0;
  for (const file of files) {
    const filename = path.join(ROOT, file);
    const original = fs.readFileSync(filename, 'utf8');
    let html = original;
    const counts = new Map();
    for (const name of COMPONENTS) {
      const result = inline(html, name, markup.get(name));
      html = result.html;
      counts.set(name, result.matches);
    }
    for (const name of COMPONENTS) {
      if (counts.get(name) > 1) throw new Error(`Duplicate ${name} component in ${file}`);
      if (required.has(file) && counts.get(name) !== 1) {
        throw new Error(`Public page is missing the shared ${name} component: ${file}`);
      }
    }
    if (!counts.get('header') && !counts.get('footer')) continue;
    inlined += 1;
    if (html !== original) pending.push([filename, html]);
  }
  for (const [filename, html] of pending) fs.writeFileSync(filename, html);
  console.log(`Inlined shared components (${inlined} pages, ${pending.length} updated).`);
}

inlineComponents();
