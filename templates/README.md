# Article and Update detail templates

This site uses static HTML. To create an article, copy `article.html` into
`articles/<readable-slug>.html` and replace every `{{PLACEHOLDER}}` with the
article’s content. Escape text and attribute values as HTML. The template’s
`<base href="../">` resolves assets, shared components and homepage anchors
from that directory; adjust it if nesting the page more deeply. These are
internal filenames: the public URL is `/articles/<readable-slug>`, without
`.html` or a trailing slash.

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

Add section headings and paragraphs inside `.content-body`. Copy
`content-checklist.html` and `content-quote.html` into the body as needed;
these are reusable markup components with shared styles and no additional
JavaScript. Give each checklist a unique ID, repeat its list items, and
replace the quote and attribution. `.content-callout` supplies the shared
panel appearance, while `.content-checklist` and `.content-quote` supply
the component-specific layout. `.content-meta` is available for optional
definition-list metadata using the same markup as the case studies.

Keep the existing header, footer, loader and `data-component="case-study-cta"`
slot. The CTA is loaded directly from `components/case-study-cta.html`.

Hero images fill the content width and crop with `object-fit: cover`, reaching
480px tall on desktop and at least 240px on small screens. The body starts
48px below the image and has no bottom padding; the main supplies the
spacing before the CTA. Set the image’s actual
width and height attributes and useful alt text; adjust `object-position`
only if an image needs a different focal point.

The first article's public URL is `/articles/why-highlight-generators-fail-at-long-form-gaming-content`.
Its temporary image is `assets/articles/highlight-generators-hero.jpg`. Replace that
dedicated image or change the article’s `src` when final artwork is available.
Update the dimensions and alt text for the replacement.

## Updates

To create an update, copy `update.html` into `updates/<readable-slug>.html`
and replace its placeholders using the same rules as Article above. Each
Update supplies its own hero image through `{{HERO_SRC}}`, dimensions and
alt text, with the same sizing and cropping as Article.

Update keeps the Article layout classes, reading-time script, reusable
checklist/callout/quote markup and shared header, footer and CTA. Its
`update-page` class selects the `UPDATE` label's page treatment: a
left-aligned title and intro, with slightly bluer and softer pink accents.
The background uses Article's existing two radial glows, preserving their
positions, opacity and size. The current Article has no separate lightning
asset or layer; Update does not introduce a new background composition.

The first update's public URL is `/updates/from-first-file-to-first-real-edit`.
Its publication date defaults to September 16, 2026. Its temporary hero
uses `updates/ShadyCut-Cover.jpg`, not a product screenshot.
Replace the page's image source when final artwork is ready,
and update the dimensions and alt text.

## Public content URLs on Cloudflare Pages

Articles, Updates and Case Studies all use `/<content-type>/<slug>` public
URLs, without `.html`, a date-prefixed folder, or a trailing slash. Keep
canonicals, `og:url`, JSON-LD page IDs, internal links, News cards and
`sitemap.xml` aligned with those public URLs, not internal filenames.

Cloudflare Pages serves `articles/<slug>.html` and `updates/<slug>.html`
at `/articles/<slug>` and `/updates/<slug>` automatically. The root
`_redirects` file adds explicit permanent (301) redirects for published
`.html` URLs and trailing-slash variants. Add the corresponding rules
when publishing another Article or Update.

Case Study HTML, videos and artifacts stay together under
`case-studies/<YYMMDD-case-study-folder>/`. Each clean `/case-studies/<slug>`
URL has an exact 200 proxy rule in `_redirects` pointing to its internal
extensionless route; Pages resolves that route to the existing `.html`
file. Do not proxy to the `.html` URL directly: Pages' automatic extension
redirect would expose the dated route and create a redirect loop.
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
remain available. Case Studies currently use `<base href="../../">`,
which resolves shared assets to the site root both at the internal
location and at the clean public URL.

Deploy the repository's static files with `_redirects` included in the
Cloudflare Pages output root. A plain static-file server does not apply
these rules; use `npx wrangler pages dev .` for local routing checks.
