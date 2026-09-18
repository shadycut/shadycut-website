// Static-site build step; uses only Node's standard library.
// Writes the shared og:image/twitter:image block into every public page from
// the page's declared hero or social image. `--check` validates without writing.
const fs = require('node:fs');
const path = require('node:path');
const { updatePage, discoverSocialPages } = require('./social-images');

const ROOT = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');

function generateSocialImages() {
  const problems = [];
  const writes = [];
  const counts = { hero: 0, override: 0, default: 0 };
  for (const source of discoverSocialPages(ROOT)) {
    const filename = path.join(ROOT, source.slice(1));
    const html = fs.readFileSync(filename, 'utf8');
    // Unfilled template copies carry placeholders instead of real metadata.
    if (/\{\{[A-Z_]+\}\}/.test(html)) continue;
    let result;
    try {
      result = updatePage(ROOT, html);
    } catch (error) {
      problems.push(`${source}: ${error.message}`);
      continue;
    }
    if (!result) continue;
    counts[result.origin] += 1;
    if (result.html === html) continue;
    if (check) problems.push(`${source}: social image metadata is out of date; run npm run social`);
    else writes.push([filename, result.html]);
  }
  // Validate every page before touching any file: a partial rewrite would leave
  // the site with a mix of old and new social metadata.
  if (problems.length) throw new Error(`Social image metadata failed:\n- ${problems.join('\n- ')}`);
  for (const [filename, html] of writes) fs.writeFileSync(filename, html);
  const total = counts.hero + counts.override + counts.default;
  console.log(`${check ? 'Checked' : 'Generated'} social image metadata (${total} pages: ${counts.override} override, ` +
    `${counts.hero} hero, ${counts.default} default${check ? '' : `, ${writes.length} updated`}).`);
}

generateSocialImages();
