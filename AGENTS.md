# ShadyCut Website Agent Instructions

## Product

ShadyCut is an AI-assisted video editing system for long-form recordings,
initially focused on gaming streams.

It is not a highlight generator.

Its job is to understand what a recording is about, identify the strongest
story, and produce a coherent proposed edit that requires minimal human review
before becoming an editable professional timeline.

Streamer speech is the primary story spine.
Gameplay and other observations provide context and evidence.

The long-term core should generalize beyond gaming.

## Website Purpose

The website should:
- explain ShadyCut clearly;
- show real proof of the product;
- publish useful product/content updates;
- help relevant creators understand and join the beta.

Prefer concrete product truth over generic AI marketing language.

Do not invent:
- customers;
- usage numbers;
- testimonials;
- partnerships;
- performance claims;
- supported capabilities.

## Page Types

The site may contain:
- Product pages;
- How It Works / Features pages;
- Supported Games pages;
- News / Updates;
- Articles;
- Case Studies;
- Beta pages;
- About;
- legal/privacy pages.

Navigation and exact page structure may evolve.
Do not treat the current sitemap as permanent architecture.

## Content

Write for humans first.

Prefer fewer strong, useful pages over high-volume SEO filler.

Public content should make it easier to understand:
- what ShadyCut does;
- why story understanding matters;
- how it differs from highlight generation;
- what real progress or creator testing has happened.

Case studies and product claims must be grounded in real ShadyCut results.

Do not expose private prompts, internal artifacts, research data or engineering
details unless explicitly requested for public use.

## Design

Preserve the established ShadyCut visual identity unless redesign is requested.

Prefer:
- clean;
- premium;
- restrained;
- product-focused;
- clear hierarchy;
- strong typography;
- good responsive behavior.

Avoid generic AI/SaaS visual clutter, excessive animation and unnecessary UI.

## Engineering

Keep the website lightweight.

Prefer:
inspect relevant implementation
→ make the smallest correct change
→ run focused validation

Avoid:
- unrelated refactors;
- speculative architecture;
- unnecessary dependencies;
- unnecessary backend infrastructure;
- rebuilding working pages from scratch for small changes.

Reuse existing components and patterns when they are good enough.

## SEO, Accessibility and Performance

Maintain sensible:
- titles and meta descriptions;
- semantic headings;
- internal links;
- readable URLs;
- alt text and accessible interactions;
- responsive behavior;
- optimized assets;
- minimal unnecessary client-side JavaScript.

Do not keyword-stuff content.

## Legal and Privacy

Do not invent legal language or compliance claims.

Treat Privacy Policy, Terms, Cookie Policy and consent behavior as real product
requirements.

## Testing

Use focused validation appropriate to the change.

Where relevant, verify:
- build succeeds;
- changed routes render;
- navigation works;
- no obvious runtime errors;
- responsive behavior is not broken.

## Reporting

After completing work, report:
- what changed;
- files/pages affected;
- focused validation performed;
- anything deliberately left unchanged;
- any concrete remaining limitation.

Keep reporting concise.