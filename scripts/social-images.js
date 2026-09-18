// One shared social-image rule for the whole site: an explicit social-image
// override wins, then the page's own hero image, then the generic ShadyCut
// social image. og:image and twitter:image always resolve to the same absolute
// production URL, and every referenced file is validated against the repository.
const fs = require('node:fs');
const path = require('node:path');
const { ORIGIN, attributes, excludedSource } = require('./public-pages');

const BEGIN = '<!-- BEGIN AUTO-GENERATED SOCIAL IMAGE -->';
const END = '<!-- END AUTO-GENERATED SOCIAL IMAGE -->';
const DEFAULT_IMAGE = 'assets/social/shadycut-og.jpg';
const DEFAULT_ALT = 'ShadyCut cover artwork';
// Open Graph and Twitter both reject images below 200x200, and crawlers do not
// read AVIF, so hero artwork must supply a JPEG, PNG or WebP source.
const MIN_SIZE = 200;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function escapeAttribute(value) {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function decodeAttribute(value) {
  return value.replace(/&(amp|lt|gt|quot|#39|apos);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'"
  })[entity]);
}

function head(html) {
  const end = html.search(/<\/head\s*>/i);
  return end === -1 ? html : html.slice(0, end);
}

function metaContent(html, name) {
  for (const match of head(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.name || '').toLowerCase() === name && attrs.content !== undefined) {
      const content = decodeAttribute(attrs.content).trim();
      if (content) return content;
    }
  }
  return undefined;
}

// The shared rule. Returns the declared source path plus the alt text that
// describes it; neither is read from the rendered page body.
function resolveSocialImage(html) {
  const override = metaContent(html, 'social-image');
  if (override) return { src: override, alt: metaContent(html, 'social-image-alt') || DEFAULT_ALT, origin: 'override' };
  const hero = metaContent(html, 'hero-image');
  if (hero) return { src: hero, alt: metaContent(html, 'hero-image-alt') || DEFAULT_ALT, origin: 'hero' };
  return { src: DEFAULT_IMAGE, alt: DEFAULT_ALT, origin: 'default' };
}

function jpegSize(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
    // SOF0-SOF15 carry the frame size; DHT (c4), JPG (c8) and DAC (cc) do not.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (marker === 0xda) return null;
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

function webpSize(buffer) {
  const format = buffer.toString('ascii', 12, 16);
  if (format === 'VP8 ' && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (format === 'VP8X' && buffer.length >= 30) {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  return null;
}

// Dimensions come from the file itself, so og:image:width/height cannot drift
// away from the artwork that is actually published.
function imageSize(buffer) {
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 8) === 'PNG\r\n\x1a\n' && buffer.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return webpSize(buffer);
  }
  if (buffer.length >= 4 && buffer.readUInt16BE(0) === 0xffd8) return jpegSize(buffer);
  return null;
}

// Both page-relative (`assets/...`, resolved by the shared `<base href="/">`)
// and root-relative (`/assets/...`) declarations name the same public file.
function sitePath(src) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) {
    throw new Error(`social image must be a site path, not an absolute URL: ${src}`);
  }
  if (/[?#]/.test(src)) throw new Error(`social image must not carry a query or fragment: ${src}`);
  const pathname = src.replace(/^\/+/, '');
  if (!pathname || pathname.split('/').includes('..')) throw new Error(`invalid social image path: ${src}`);
  return `/${pathname}`;
}

function imageMetadata(root, src) {
  const pathname = sitePath(src);
  const type = TYPES[path.extname(pathname).toLowerCase()];
  if (!type) throw new Error(`unsupported social image format: ${src} (use .jpg, .png or .webp)`);
  const file = path.join(root, decodeURIComponent(pathname).slice(1));
  if (path.relative(root, file).startsWith('..')) throw new Error(`social image escapes the site root: ${src}`);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`social image not found: ${src}`);
  const size = imageSize(fs.readFileSync(file));
  if (!size) throw new Error(`social image is not a readable ${type} file: ${src}`);
  if (size.width < MIN_SIZE || size.height < MIN_SIZE) {
    throw new Error(`social image must be at least ${MIN_SIZE}x${MIN_SIZE}: ${src} is ${size.width}x${size.height}`);
  }
  return { url: ORIGIN + pathname, type, ...size };
}

function renderBlock(image, alt, indent, newline) {
  const alternative = escapeAttribute(alt);
  return [BEGIN,
    `<meta property="og:image" content="${image.url}">`,
    `<meta property="og:image:type" content="${image.type}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    `<meta property="og:image:alt" content="${alternative}">`,
    `<meta name="twitter:image" content="${image.url}">`,
    `<meta name="twitter:image:alt" content="${alternative}">`,
    END].map(line => indent + line).join(newline);
}

function stripExisting(text) {
  const blocks = [...text.matchAll(/^[ \t]*<!-- BEGIN AUTO-GENERATED SOCIAL IMAGE -->[\s\S]*?<!-- END AUTO-GENERATED SOCIAL IMAGE -->[ \t]*\r?\n?/gm)];
  if (blocks.length > 1) throw new Error('duplicate auto-generated social image block');
  return text.replace(/^[ \t]*<!-- BEGIN AUTO-GENERATED SOCIAL IMAGE -->[\s\S]*?<!-- END AUTO-GENERATED SOCIAL IMAGE -->[ \t]*\r?\n?/m, '')
    .replace(/^[ \t]*<meta\b[^>]*\b(?:og|twitter):image(?::[a-z]+)?\b[^>]*>[ \t]*\r?\n?/gim, '');
}

// A page opts in through Open Graph metadata or its own image declaration;
// pages without either (the 404 page, downloadable reports) are left untouched.
function managesSocialImage(html) {
  return /<meta\b[^>]*\bproperty\s*=\s*["']og:/i.test(head(html)) ||
    metaContent(html, 'hero-image') !== undefined || metaContent(html, 'social-image') !== undefined;
}

function updatePage(root, html) {
  const end = html.search(/<\/head\s*>/i);
  if (end === -1 || !managesSocialImage(html)) return null;
  const resolved = resolveSocialImage(html);
  const image = imageMetadata(root, resolved.src);
  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  const stripped = stripExisting(html.slice(0, end));
  // Keep the block with the other Open Graph tags; fall back to the end of the
  // head for pages that only declare an image.
  const anchors = [...stripped.matchAll(/^([ \t]*)<meta\b[^>]*\bproperty\s*=\s*["']og:[^>]*>[ \t]*$/gim)];
  const anchor = anchors[anchors.length - 1];
  const indent = anchor ? anchor[1] : '  ';
  const block = renderBlock(image, resolved.alt, indent, newline);
  const at = anchor ? anchor.index + anchor[0].length : stripped.length;
  const before = anchor ? stripped.slice(0, at) + newline : stripped;
  const after = anchor ? stripped.slice(at).replace(/^\r?\n/, '') : '';
  return { html: before + block + newline + after + html.slice(end), image, alt: resolved.alt, origin: resolved.origin };
}

function discoverSocialPages(root) {
  const sources = [];
  const walk = (directory, prefix, recursive) => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const source = `${prefix}${entry.name}`;
      if (excludedSource(source)) continue;
      if (entry.isFile() && entry.name.endsWith('.html')) sources.push(source);
      else if (entry.isDirectory() && recursive) walk(path.join(directory, entry.name), `${source}/`, true);
    }
  };
  walk('.', '/', false);
  if (fs.existsSync(path.join(root, 'pages'))) walk('pages', '/pages/', true);
  return sources.sort((a, b) => a.localeCompare(b, 'en'));
}

module.exports = { BEGIN, END, DEFAULT_IMAGE, DEFAULT_ALT, MIN_SIZE, resolveSocialImage, imageSize,
  imageMetadata, updatePage, discoverSocialPages };
