# AI-native launch kit

The goal of this launch is one spike of attention around the thing that is
genuinely new: **an AI can build a working Svelte data-app for you, grounded on
the real library, via MCP.** The grid is what people find once they arrive. Lead
with the AI story everywhere.

Run these in a coordinated window (same morning, US time, Tue-Thu):
1. Show HN (see below)
2. Product Hunt (see below)
3. The 60-second demo video (script below) pinned on X + embedded in both
4. A short r/sveltejs post (variant below)

Then let the reactivated bot keep the momentum warm.

---

## 1. Show HN

**Title** (HN titles must be plain, no hype, <= 80 chars):

```
Show HN: SvGrid - a Svelte 5 data grid an AI can drive to build a full app
```

Alt titles if the first feels long:
- `Show HN: A Svelte 5 data grid with an MCP server so Claude/Cursor build the app`
- `Show HN: SvGrid - headless Svelte 5 grid + MCP server for AI-built data apps`

**First comment** (post immediately as OP - this is where the story lives):

```
Hi HN. I'm one of the maintainers. SvGrid is a data grid built from the first
line for Svelte 5 runes, not a React grid wrapped in a Svelte shim.

Two things make it worth a look beyond "another grid":

1. It ships an MCP server (@svgrid/mcp). Point Claude, Cursor, or Zed at it and
   the model answers with real, version-pinned prop/method/event names and the
   source of 280+ live demos as grounding - so the code it writes actually runs
   instead of hallucinating an API. There's also a Studio layer whose model an
   agent can drive end to end: add entities, wire a data source (PGlite /
   Supabase / REST), set auth, and generate a runnable SvelteKit app, with every
   edit validated so the agent can't emit an invalid project.

2. The core (@svgrid/grid) is MIT and genuinely not gated: no license key, no
   row-count cap, no watermark, no upsell popups. Row + column virtualization
   (there's a 1M-row demo), Excel-style filters, 14 inline editors, cell-range
   selection with copy/paste and a fill handle, grouping, tree data,
   master/detail, and a native Kanban board mode are all in the free package.
   A commercial pack adds export/print/pivot/AI/Studio, and that's what funds it.

It's headless-first: a ~7.5 KB gzipped engine you can compose, plus a drop-in
<SvGrid /> render component (~42 KB) when you just want it to work.

We're the team behind jQWidgets and htmlelements.com, shipping UI components
since 2011. SvGrid is our Svelte-5-native effort.

Try it: npm create @svgrid@latest
MCP: claude mcp add svgrid -- npx -y @svgrid/mcp
Demos: https://svgrid.com/demos   Repo: https://github.com/sv-grid/sv-grid

Happy to answer anything about the runes-native architecture, the MCP grounding
approach, or the open-core split.
```

**HN survival notes:**
- Post 8-10am ET Tue/Wed/Thu. Stay in the thread for the first 3 hours;
  engagement in the first hour is most of the ranking signal.
- Expect "why not just use <existing grid>" and "why Svelte-only". Answer
  honestly and on your own terms (runes-native architecture, deep SvelteKit
  integration, MCP grounding). Do not disparage other libraries.
- Do NOT ask for upvotes anywhere - HN penalizes it hard.
- Have the 1M-row demo and the MCP one-liner ready to paste; concrete beats
  claims.

---

## 2. Product Hunt

**Name:** SvGrid

**Tagline** (<= 60 chars, pick one):
- `The Svelte 5 data grid an AI can build your app with`
- `Headless Svelte 5 grid + MCP server for AI-built apps`
- `Svelte 5 data grid. Headless-first. AI-native.`

**Description** (<= 260 chars):

```
A Svelte 5-native data grid: 1M-row virtualization, Excel-style filters, inline
editing, Kanban, pivot. MIT core, no gating. Ships an MCP server so Claude,
Cursor, and Zed build accurate, runnable grid apps for you.
```

**First comment (maker's comment):**

```
Maker here. We build UI components since 2011 (jQWidgets, htmlelements.com), and
SvGrid is our from-scratch Svelte 5 effort - runes-native, not a port.

What we're most excited to show: the MCP server. Connect it to your AI editor and
the model gets real, version-pinned APIs plus 280+ demo sources as grounding, so
"build me a grid that groups by department with a sparkline per row" produces code
that runs. The Studio layer goes further - an agent can scaffold a whole runnable
SvelteKit data-app from a schema.

The MIT core is honestly free: virtualization, filtering, 14 editors, range
selection + fill handle, grouping, tree, master/detail, Kanban board mode - no
key, no row cap, no watermark. A commercial pack (export/print/pivot/AI/Studio)
funds the project.

npm create @svgrid@latest  ·  https://svgrid.com/demos

Would love your feedback, especially from folks building on SvelteKit.
```

**Assets to attach:** the 60-second demo video (below) as the gallery lead, plus
3-4 demo screenshots (1M-row grid, Kanban board, pivot Designer, the AI/MCP
"build this" moment). First gallery item should be the AI moment, not a static
grid.

**PH timing:** launch 12:01am PT; rally the day; makers respond to every comment.

---

## 3. The 60-second demo video (the centerpiece)

This is the single most shareable asset. Screen recording, no talking-head
needed, captions on (most views are muted). Keep it under 60s for X autoplay.

**Storyboard:**

| Time | On screen | Caption overlay |
| --- | --- | --- |
| 0:00-0:05 | Blank editor. Type into Claude/Cursor: *"using svgrid, build an orders dashboard: grid grouped by region, sparkline per row, filter bar."* | "One prompt." |
| 0:05-0:15 | Model calls the svgrid MCP tools (show the tool calls flashing), writes the component. | "It reads the real API over MCP - no hallucinated props." |
| 0:15-0:25 | The generated app runs live: grouped grid, sparklines, filters working. | "That code runs. First try." |
| 0:25-0:38 | Scroll a 100k+ row grid smoothly; open the Excel-style filter; edit a cell inline. | "1M-row virtualization. Excel filters. 14 inline editors." |
| 0:38-0:48 | Toggle the same grid into Kanban board mode; drag a card between lanes. | "Same grid, board mode. Drag and drop built in." |
| 0:48-0:56 | Quick flash: pivot Designer drag-drop, then the Studio "generate app" moment. | "Pivot. And a Studio an agent can build the whole app in." |
| 0:56-1:00 | End card: SvGrid logo. `npm create @svgrid@latest` · MIT core. | "Svelte 5 native. MIT core. AI-native." |

**Production notes:**
- Record at the demo gallery (`pnpm dev`, localhost:5174) and a real
  Claude/Cursor session. The MCP tool-call flashes are the credibility shot -
  do not fake them.
- Export a 60s version (X/PH) and a 15s cut (0:00-0:15 + end card) for the bot
  and Reddit.
- No em-dashes in captions; no competitor names on screen.

---

## 4. r/sveltejs post (same day, softer tone)

**Title:** `SvGrid: a Svelte 5-native data grid (MIT core) with an MCP server for AI editors`

**Body:**

```
We shipped SvGrid, a data grid built for Svelte 5 runes from scratch (not a React
port). The MIT core has no gating - virtualization, Excel-style filters, inline
editing, grouping, tree data, master/detail, and a Kanban board mode are all free.

The part I'd love this sub's take on: it ships an MCP server, so Claude/Cursor/Zed
answer with real version-pinned APIs and 280+ demo sources as grounding. In
practice the generated grid code just runs. There's a Studio layer an agent can
drive to scaffold a whole SvelteKit data-app too.

npm create @svgrid@latest  ·  demos: https://svgrid.com/demos  ·  it's open core,
funded by a commercial pack, not donations. Feedback welcome - especially the
headless API ergonomics.
```

Reddit rules: engage in comments, don't cross-post the identical text everywhere,
don't lead with the paid pack. Also good targets: the Svelte Discord #showcase,
"This Week in Svelte" newsletter submission, and the `awesome-svelte` list (see
`discovery-lists.md`).

---

## Sequencing checklist

- [ ] Demo video recorded (60s + 15s cuts), captions, end card
- [ ] Screenshots exported (AI moment first)
- [ ] Show HN posted 8-10am ET, OP first comment up, maintainer watching thread
- [ ] Product Hunt scheduled 12:01am PT, gallery + maker comment ready
- [ ] r/sveltejs + Svelte Discord #showcase posted
- [ ] Twitter bot reactivated (see `bot-activation-runbook.md`) so the spike
      keeps echoing after launch day
- [ ] "This Week in Svelte" newsletter submission sent
