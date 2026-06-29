# GitHub social preview images

On-brand 1280x640 cards for GitHub's repo **Social preview** (Settings ->
General -> Social preview). All are PNG, 1280x640 (GitHub's recommended size),
and well under the 1 MB upload limit.

| File | Use |
| --- | --- |
| `svgrid-github-social.png` | Primary. Headline lockup: "The Svelte 5 data grid. / Headless-first. Render-ready." |
| `svgrid-github-social-product.png` | Product card: headline + a mini-grid showing an accent-highlighted cell. |
| `svgrid-github-social-centered.png` | Centered, minimal: mark + wordmark + tagline. |

## Apply on GitHub

1. Repo -> **Settings** -> **General**.
2. Scroll to **Social preview** -> **Edit** -> upload one of the PNGs above.

(The image lives in GitHub's settings, not in code - it is not auto-read from
the repo. These files are kept here as the source of truth + for reuse on other
social cards.)

## Regenerate

```bash
node tools/render-social-preview.mjs
```

Renders all three via Chromium (Playwright) at 1280x640. Brand tokens (dark
navy gradient, the 4-tile mark, the Svelte orange->red accent) are lifted from
`website/public/og-image.svg`; edit the variant markup in the script to tweak
copy or layout. Inter is pulled from Google Fonts when online and falls back to
the system sans otherwise.
