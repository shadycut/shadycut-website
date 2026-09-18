# Article and Update detail templates

This site uses static HTML. To create an article, copy `article.html` into
`pages/articles/<readable-slug>.html` and replace every `{{PLACEHOLDER}}` with the
article’s content. Escape text and attribute values as HTML. The template’s
`<base href="/">` resolves assets, shared components and homepage anchors
from the site root, independently of source-file depth. These are
internal filenames. New pages use `/articles/<readable-slug>/`; existing
published URLs without a trailing slash remain unchanged.

Both templates carry `<meta name="robots" content="noindex">` because the
template files themselves are served at `/templates/…`. Delete that tag, and
the comment above it, in the copy: a page that keeps it is excluded from the
sitemap and gets no generated route, so it will not be reachable at all.

Set `{{PUBLISHED_ISO}}` to the publication date in `YYYY-MM-DD` format and
`{{PUBLISHED_DATE}}` to its readable display value. The Published row reuses
the Case Study `.content-meta` styles, with a compact two-column article layout.
The second column shows Reading Time. Keep `components/article-meta.js` and
the `data-reading-time` value slot: the script counts the actual body text
(including headings, checklist and quote), estimates 200 words per minute,
and rounds up to a whole minute with a minimum of one. The hero and CTA are
excluded, and editing the body automatically updates the estimate on reload.
The title and lede use the same alignment, widths and responsive settings
as the Case Study hero.

Add section headings and paragraphs inside `.content-body.editorial-content`. Copy
`content-checklist.html` and `content-quote.html` into the body as needed;
these are reusable markup components with shared styles and no additional
JavaScript. Give each checklist a unique ID, repeat its list items, and
replace the quote and attribution. Keep `.content-callout` as the existing
component hook; `.editorial-callout` supplies the shared editorial
panel appearance, while `.content-checklist` and `.editorial-quote` supply
the checklist and quote layout. `.content-meta` is available for optional
definition-list metadata using the same markup as the case studies.

Keep the existing `data-component="header"`, `data-component="footer"`,
loader and `data-component="case-study-cta"` slots. `npm run build` replaces
the header and footer slots with the real markup, as described under
*Build-time shared components*; the CTA is still loaded at runtime from
`components/case-study-cta.html`.

Hero images fill the content width and crop with `object-fit: cover`, reaching
480px tall on desktop and at least 240px on small screens. The body starts
48px below the image (36px on mobile) and uses the same bottom spacing
as Case Studies. Set the image’s actual
width and height attributes and useful alt text; adjust `object-position`
only if an image needs a different focal point.

The first article's public URL is `/articles/why-highlight-generators-fail-at-long-form-gaming-content`.
Its temporary image is `assets/articles/highlight-generators-hero.jpg`. Replace that
dedicated image or change the article’s `src` when final artwork is available.
Update the dimensions and alt text for the replacement.

## Updates

To create an update, copy `update.html` into `pages/updates/<readable-slug>.html`
and replace its placeholders using the same rules as Article above. Each
Update supplies its own hero image through `{{HERO_SRC}}`, dimensions and
alt text, with the same sizing and cropping as Article.

Update keeps the Article layout classes, reading-time script, reusable
checklist/callout/quote markup and shared header, footer and CTA. Its
`update-page` class selects slightly bluer and softer pink background accents.
All three News detail types (Article, Update and Case Study) keep the label,
title and intro centered on desktop and mobile.
The background uses Article's existing two radial glows, preserving their
positions, opacity and size. The current Article has no separate lightning
asset or layer; Update does not introduce a new background composition.

The first update's public URL is `/updates/from-first-file-to-first-real-edit`.
Its publication date defaults to September 16, 2026. Its temporary hero
uses `updates/ShadyCut-Cover.jpg`, not a product screenshot.
Replace the page's image source when final artwork is ready,
and update the dimensions and alt text.

## Shared editorial presentation

All public Articles, Case Studies and Updates use `.editorial-content` on
their existing `.content-body` wrapper. The shared rules live only in
`assets/css/styles.css`: an 800px reading width, soft gray 18px body copy
(17px on mobile), 1.7 line height, consistent headings, compact lists,
cyan markers, underlined yellow-to-cyan links and visible keyboard focus.
Major body H2 sections receive a subtle divider; H3 headings stay subordinate.

Keep callouts special: add `.editorial-callout` to existing semantic notes,
checklists and summary boxes, and `.editorial-quote` to existing quote
containers. A plain `blockquote` inside the editorial wrapper also receives
the shared quote treatment. Preserve the blockquote and any figcaption.
Use `.editorial-media` alongside the existing featured-media class for the
shared image/video frame; inline images and videos inherit matching borders
and radii. Existing hero dimensions, crops and wide download sections remain.
These opt-in rules do not apply to product pages, legal pages or standalone
downloadable Story/Director reports.

## Public content URLs on Cloudflare Pages

Existing Articles, Updates and Case Studies use `/<content-type>/<slug>` public
URLs. New pages use `/<content-type>/<slug>/`. Neither format includes
`.html` or a date-prefixed folder. Keep
canonicals, `og:url`, JSON-LD page IDs, internal links and News cards
aligned with those public URLs, not internal filenames. The sitemap is generated
automatically as described below.

Public page sources live under `pages/`; only the homepage stays at
`index.html` in the repository root. Every public site page loads
`/assets/css/styles.css`. Games and Features rules are scoped to their
page bodies, and responsive rules keep their original cascade order.
Templates use this same stylesheet and root-relative base.

The root `_redirects` file maps existing public URLs to source locations
with exact 200 proxies. Directory pages such as `/games/` target
`/pages/games/`; Articles, Updates and Case Studies target their
extensionless routes under `/pages/articles/`, `/pages/updates/` and
`/pages/case-studies/`. Pages resolves these targets to the corresponding
HTML files. Do not proxy to `.html` or `index.html` directly: Pages'
automatic HTML normalization could expose `/pages/` in a browser URL.
The build generates proxies and normalization aliases for new detail pages;
the existing manually maintained rules remain unchanged.

Case Study page HTML lives at `pages/case-studies/<slug>.html`. Videos,
posters and downloadable reports retain their existing locations under
`case-studies/<YYMMDD-case-study-folder>/`. These standalone reports are
downloadable product outputs, not site-layout pages; their content and
embedded report styling remain untouched.
Exact 301 rules redirect old dated page URLs (with or without
`.html`) and earlier aliases to the clean URL. Cloudflare applies only
the first matching rule, so a clean page proxy does not follow the old
page's redirect. Keep the 301 rules above the proxies.

The public Case Study URLs are:

- `/case-studies/from-a-two-hour-stream-to-one-story-worth-watching`
- `/case-studies/from-an-odette-pull-to-a-complete-story`

Do not redirect whole Case Study folders or move their downloads:
direct links such as
`/case-studies/260802-chowds-ab-pilot/story-blueprint.html` and
`/case-studies/260905-1cestream-genshin-odette/director_plan.html`
remain available. Site pages use `<base href="/">`, which resolves
shared assets and components to the site root at the clean public URL.

Directory and legal-page aliases explicitly preserve Cloudflare's
existing 308 normalization. A final `/pages/*` rule sends direct source
requests back to public paths; it does not run recursively when a 200
proxy serves a public page. Keep it after the exact rules. Canonicals,
social metadata and sitemap URLs must never use `/pages/`.

There are no separate Case Studies or Updates index pages in the current
site. Keep the News hub and its existing filters; this source migration
does not create new archive pages or change the existing root fallback.

Deploy the repository's static files with `_redirects` included in the
Cloudflare Pages output root. A plain static-file server does not apply
these rules; use `npx wrangler pages dev .` for local routing checks.

## Build-time shared components

`components/header.html` and `components/footer.html` remain the single source
of truth for the site shell. `scripts/inline-components.js` (`npm run components`,
part of `npm run build`) copies them into every page between
`BEGIN`/`END AUTO-GENERATED COMPONENT` comments, so the primary navigation and
footer link graph is in the served HTML and does not depend on JavaScript.

Do not edit a generated block by hand and do not paste header or footer markup
into a page: edit the fragment and rebuild. New pages keep the
`<div data-component="header"></div>` and `<div data-component="footer"></div>`
placeholders that the templates provide; the build converts them on its first
run and regenerates the blocks in place afterwards. Files under `templates/`
keep their placeholders because they are scaffolding and are never served.

The build fails without writing anything when a public page is missing either
slot or contains a duplicate, so a page cannot ship without the shared
navigation. Every page under `pages/`, plus `index.html` and `404.html`,
is covered.

`components/loader.js` no longer fetches the header or footer. It still fetches
the remaining runtime components and wires up the header behaviour that needs
JavaScript: the mobile menu, the dropdown open/close logic, Escape handling and
inert placeholder links. Keep the `<script src="components/loader.js"></script>`
tag on every page.

## Automatic routes and sitemap generation

Run `npm run build` before publishing the static repository root. It runs
`npm run components`, `npm run social`, `npm run routes` and `npm run sitemap`
in that order, with no dependencies or installation required. In Cloudflare Pages, use `npm run build` as the
build command and keep the existing repository-root output directory.
There is no checked-in deploy command; direct upload workflows must run
this build command before uploading. Generation does not deploy anything.

Both generators share content discovery and exclusions in `scripts/public-pages.js`.
They discover public HTML under `pages/`, including flat detail
files and `<slug>/index.html` pages in `articles`, `case-studies`, and
`updates`. Existing exact 200 proxies determine public URLs. Without a
proxy, both layouts map to `/<content-type>/<slug>/`. Adding a published
source file and running `npm run build` creates its public route and sitemap
entry automatically. Include a canonical URL matching the public URL in
the source HTML. Neither generator publishes `/pages/` paths or alias URLs
as canonical URLs.

`scripts/generate-routes.js` maintains only the marked
`AUTO-GENERATED CONTENT ROUTES` section in `_redirects`. Everything outside
it, including legacy redirects and existing static/content proxies, is
preserved. The block is initially inserted before existing rules to avoid
catchall shadowing. Generated 200 proxies target the native clean source
route (extensionless for flat files, directory paths for `index.html`)
to prevent Cloudflare's HTML normalization from exposing `/pages/`.
Generated public aliases normalize to the same trailing-slash URL.

Do not edit generated rules by hand. Removing or marking a generated page
non-indexable removes its generated rules on the next build. Two source
layouts with the same content type and slug fail clearly, as do exact
manual-rule conflicts or rules before the block that shadow generated URLs.
Existing manual routes are retained even when their source is non-indexable;
the sitemap still excludes that page. Content-type `index.html` files are
not automatically treated as landing pages.

For unpublished pages, use a robots `noindex` meta tag, an explicit
`<meta name="draft" content="true">`, or a `draft`/`drafts` directory or
`draft-` filename. Unfilled template copies and meta-refresh redirect pages
are excluded too. The six required public hubs must exist and be indexable
or generation fails. URLs are deduplicated and output is deterministic.

No `lastmod`, `changefreq`, or `priority` is generated: current content
provides publication dates, not verified modification dates. Do not manually
edit `sitemap.xml`; regenerate it after adding or removing public pages.

## Social preview images

Every public page resolves one social image through the same rule, applied by
`scripts/generate-social-images.js` (`npm run social`, part of `npm run build`):

1. an explicit `<meta name="social-image">` override;
2. otherwise the page's own `<meta name="hero-image">`;
3. otherwise the generic `assets/social/shadycut-og.jpg`.

Declare the hero next to the canonical link, using the same path as the page's
hero `img` (`<base href="/">` resolves both), and describe it with
`hero-image-alt`. Article and Update copies fill `{{HERO_SRC}}` and
`{{HERO_ALT}}` there as well as in the hero figure. Use `social-image` and
`social-image-alt` only when a page needs dedicated social artwork that is not
its hero.

The build writes `og:image`, `og:image:type/width/height/alt`, `twitter:image`
and `twitter:image:alt` into the marked `AUTO-GENERATED SOCIAL IMAGE` block in
the page head, always as absolute `https://shadycut.com` URLs. Do not edit those
tags by hand: change the declaration and rebuild. Type and dimensions are read
from the file, so they cannot drift from the published artwork.

Referenced images are validated: the file must exist in the repository, be a
JPEG, PNG or WebP (social crawlers do not read AVIF) and be at least 200x200.
A missing or unusable image fails the build before any page is rewritten.
`npm run social -- --check` validates without writing, and pages without Open
Graph metadata or an image declaration, such as `404.html`, are left untouched.
