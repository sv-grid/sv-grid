# 30-second tutorials

Short screen recordings of a gallery demo being used, with a spoken narration,
that land on the docs page for the feature (a muted, looping clip with the
transcript under it) and on YouTube (the narrated cut).

Everything is generated from one script per tutorial. Nothing is recorded by
hand: Playwright drives the real demo in the example gallery while Chromium's
screencast captures it, the narration is synthesized per beat, and ffmpeg
muxes the outputs.

```
tools/tutorials/scripts/<id>.mjs      the tutorial: narration beats + the actions
tools/tutorials/manifest.json         what has been recorded (tracked, parent repo)
website/public/tutorials/<id>.*       muted docs cut + poster + VTT (tracked, website repo)
tutorials-out/<id>/                   narrated master, GIF, SRT, thumbnail (gitignored)
```

## Record

```
pnpm dev                                    # the example gallery on :5174 (or pass --serve)
node --env-file=.env tools/tutorials/record.mjs inline-editing      # one
node --env-file=.env tools/tutorials/record.mjs all                 # every script
pnpm tutorials:embed                        # blocks onto the docs pages + index rebuild
```

`record.mjs --dry` validates the scripts and prints the beats and word counts
without recording. `TUTORIAL_DEBUG=1` keeps a screenshot per beat next to the
recording, which is the fastest way to see where an action landed.

Needs ffmpeg (`winget install Gyan.FFmpeg` on Windows, then a new terminal or
`FFMPEG_PATH`; `sudo apt-get install -y ffmpeg` on Ubuntu) and Chromium for
Playwright (`pnpm test:e2e:install`).

Narration is ElevenLabs over their REST API: `ELEVENLABS_API_KEY`, optionally
`ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`. Clips are cached under
`.tutorials-cache/tts/` by voice + text, so unchanged narration costs nothing on
a re-record. Without a key (or with `TTS_PROVIDER=silence`) the pipeline runs
with silent narration of the estimated length; captions and transcript are
still written. Commercial use of ElevenLabs voices needs at least their Starter
plan; the free tier requires attribution.

## Write a tutorial

A script is a plain module:

```js
export default {
  id: 'inline-editing',                      // = file name, manifest key, asset name
  title: 'Inline editing in SvGrid',
  description: 'One sentence for search results, 160 chars max.',
  demo: '05-inline-editing',                 // gallery demo it records
  docsPage: 'docs/help/editing/overview.md', // where the block goes
  anchorAfter: '<div data-docs-demo="05-inline-editing"',   // or anchor: '## Heading'
  tags: ['inline editing', 'cell editor'],
  gif: { beats: [0, 1] },                    // beat window for the GIF (default: first 12 s)
  zoom: 1.25, theme: 'dark', preset: 'ember',
  async setup(page, h) { await h.gridReady(5); await h.focusGrid() },
  beats: [
    { say: 'Double-click any cell to start editing.', lead: 400,
      async do(page, h) { await h.dblclickCell(1, /first name/i) } },
    { say: 'Type a value and press Enter.',
      async do(page, h) { await h.type('Margaret'); await h.press('Enter') }, hold: 500 },
    { say: 'A beat can be narration only.' },
  ],
  async verify(page, h) { if ((await h.kpi(/pending edits/i)) < 1) throw new Error('no edit') },
}
```

Timing: every beat's narration is synthesized and measured before recording,
and the beat stays on screen for at least that long. `lead` is the delay
before the action starts (default 300 ms), `hold` the pause after both the
narration and the action are over (default 400 ms). Aim for 70-85 words in
4-6 beats; `record.mjs --dry` prints the count. Present tense, second person,
concrete verbs, no dashes (a hyphen or a comma instead), no other grid
products by name.

`verify` runs after the last beat and should prove the feature did what the
narration says (an edit registered, a card moved, a well holds the field). A
failing verify discards the take.

The `h` helpers (`tools/tutorials/lib/drive.mjs`) move a visible cursor
between actions: `hover`, `click`, `dblclick`, `clickCell`, `dblclickCell`,
`type`, `press`, `easedScroll`, `clickHeaderFilter`, `dragFillHandle`,
`dragHtml5` (native drag and drop, for the pivot designer and the kanban
board), `selectOption` (a native select, by selector or by a chart-panel
picker's label), `clickChip` (a button by its text, inside a scope), `kpi`,
`settleRowCount`, `focusGrid`, `hideIntro`, `pause`.

`draft.mjs <demo-id>` writes a first version of a script from the demo's
source, meta and docs pages with the Anthropic API (`ANTHROPIC_API_KEY`), with
every action left as a `TODO` that you script by hand.

## Beyond a gallery demo: the stage, the website, longer cuts

A script names what it records with one of three keys:

| Key | Records | Used for |
| --- | --- | --- |
| `demo: '05-inline-editing'` | a gallery demo (`:5174/#/<id>`) | feature tutorials |
| `stage: true` | the recording stage, `examples/stage.html` | install tutorials, title and end cards |
| `site: 'studio/new'` | a route of the website (`:5180`) | the Studio designer |

The stage is a small page in the gallery's Vite root with four scenes, driven
from a beat through `h.stage`: a terminal (`h.stage.term.run(cmd, { output })`
types the command and prints the lines), an editor
(`h.stage.editor.type(code)`), a browser frame around the real component
(`h.stage.browser.mount('first-grid' | 'minimal-template' | 'sheet-budget')`,
presets in `examples/src/stage/presets.ts`), and title / end cards
(`h.stage.show('title', { kicker, title, subtitle, lines })`). `show('split')`
puts the editor and the browser side by side. Terminal output is scripted, so
keep it to what the real CLI prints (see the comments in `scripts/install-*.mjs`
for where each transcript comes from).

A longer cut lists `segments` instead of `beats`: each segment is one take
(`demo` / `stage` / `site` + `setup` + `beats` + optional `verify`, `zoom`,
`hideIntro`, `introHold`, `outroHold`). Segments are recorded one after the
other, trimmed at their own sync flash, faded and joined; the narration and
the captions keep their timing across the join.

`kind: 'marketing'` marks a YouTube-only cut: no `docsPage`, nothing under
`website/public/tutorials`, recorded at 1920x1080 (`view` overrides). The
result is `tutorials-out/<id>/<id>.youtube.mp4` with the SRT, the GIF and the
thumbnail; publish it with `youtube.mjs upload <id>`. Demo segments in a
marketing cut set their own `zoom` (1.35-1.5 fills a 1080p frame).

Before a cut ships, `node tools/tutorials/scan-overlay.mjs tutorials-out/<id>/<id>.youtube.mp4`
checks the master for the Vite error overlay, which the dev server pushes to
every open page when any module fails to transform; the recorder removes it
on sight, and the scan proves it stayed away.

`poster: { beat: n }` takes the poster and the YouTube thumbnail from the end
of beat `n` instead of the intro hold (a stage cut opens on an empty
terminal). `--serve` also starts the website when a script has a `site`
segment; `--site <url>` points at one already running.

## Where the docs block goes

`embed.mjs` writes a `<figure class="docs-tutorial">` between
`<!-- tutorial:<id> -->` markers, so a re-run replaces it in place. A new block
goes after `anchorAfter` (usually the demo's own embed), else above `anchor`,
else above `## See also`, else above the FAQ. "See also" must stay the last
section of a page (tools/demo-doc-coverage.test.ts).

The block carries the muted MP4 with `preload="none"`, the poster, the VTT
captions and the transcript as plain paragraphs. Docs.svelte plays the clip
when it scrolls into view and pauses it when it leaves; a click toggles; with
`prefers-reduced-motion` the native controls are shown instead. The transcript
is what reaches llms-full.txt and the site search, and the page's head gets a
`VideoObject` per tutorial from `tools/lib/tutorial-media.mjs`, emitted by both
the prerenderer and `seo.ts`.

## YouTube

```
node --env-file=.env tools/tutorials/youtube.mjs --auth              # once: prints YT_REFRESH_TOKEN
node --env-file=.env tools/tutorials/youtube.mjs --verify
node --env-file=.env tools/tutorials/youtube.mjs upload inline-editing            # dry run
node --env-file=.env tools/tutorials/youtube.mjs upload inline-editing --post     # really upload
node --env-file=.env tools/tutorials/youtube.mjs link inline-editing <videoId>    # after a manual upload
pnpm tutorials:embed                                                 # figcaption link + embedUrl
```

`--auth` needs a Desktop-type OAuth client in the Google Cloud console with
the YouTube Data API v3 enabled; it opens a loopback redirect and prints the
refresh token, which goes into `.env` / the repo secrets and nowhere else.

Google locks every video uploaded through an OAuth project that has not
passed the YouTube API Services compliance audit to **private**, regardless
of the privacy the request asked for. Until the audit is approved the
supported path is manual: `upload <id>` (dry run) writes
`tutorials-out/<id>/<id>.youtube.json` with the title, description and tags;
upload `<id>.youtube.mp4`, `<id>.srt` and `<id>.thumb.jpg` from YouTube
Studio, then `link <id> <videoId>`.

Quota: an upload with captions and thumbnail costs about 2,050 of the 10,000
daily units, so four a day.

## Tests and CI

`pnpm tutorials:check` re-renders the docs blocks from the manifest and runs
`tools/tutorials.test.ts`: every embedded id has a manifest entry on the page
the manifest names, the media exists under `website/public/tutorials/`, the
docs cut is under 2.5 MB and the poster under 150 KB, and the transcript is in
`docs-index.json` and `llms-full.txt`. `.github/workflows/tutorials.yml`
re-records on a runner on request (manual dispatch) and commits to both repos.

## Known traps

- The gallery is a Vite dev server. Any file edit under `examples/` or the
  package sources hot-swaps the demo mid-take and resets its state; the
  recorder watches the Vite client's console for that and redoes the take.
- The Vite error overlay (any module that fails to transform, such as a
  gitignored bench adapter importing an uninstalled package) is hidden by the
  recorder's CSS so it cannot eat the pointer; the take logs a warning.
- Coordinates: the demo is rendered at CSS `zoom: 1.25` inside a 1280x720
  viewport. Chromium's `getBoundingClientRect` and Playwright's `boundingBox`
  both account for it; the helpers scroll a target into view and refuse to
  click outside the viewport (a column scrolled out of the grid used to get a
  click at x > 1280, which reset the page).
- Playwright's screencast never draws the pointer; the visible cursor is an
  overlay injected by `lib/cursor.mjs`, so drive every action through `h.*`.
