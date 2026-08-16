<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/ui</h1>

<p align="center"><strong>Svelte 5 UI components, added to your app one command at a time.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/ui"><img src="https://img.shields.io/npm/v/%40svgrid%2Fui.svg?label=%40svgrid%2Fui" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/ui"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fui.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs/help/ui-components/index/">Docs</a> ·
  <a href="https://svgrid.com/demos/">Demos</a>
</p>

---

Add [SvGrid UI](https://svgrid.com/docs/help/ui-components/index/) components to your
app - and see them - in one command:

```sh
npx @svgrid/ui try calendar     # open it in a throwaway sandbox, no project needed
npx @svgrid/ui add calendar     # write the recipe into your app + install the dep
```

## How it works

`@svgrid/ui` is a **recipe scaffolder**, not a component library. `add` writes a
minimal, ready-to-edit `.svelte` starter into your project that imports from
[`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid), and installs the
package for you. The components themselves live in `@svgrid/grid` - you get bug
fixes and new features by bumping the package, while the file `add` drops in is
yours to style and wire however you like. Each recipe is a self-contained demo, so
`try` and `--preview` can render it immediately.

## See it immediately

```sh
# zero setup: spins up a sandbox and opens the component in your browser
npx @svgrid/ui try button

# try several at once (or a whole family) - they share one sandbox
npx @svgrid/ui try button calendar slider
npx @svgrid/ui try inputs

# in your own SvelteKit app: also writes a /preview/button route
npx @svgrid/ui add button --preview
#   -> start your dev server, open http://localhost:5173/preview/button
```

`try` needs no project - it caches a tiny Vite + Svelte sandbox under your temp
dir (so repeat runs are instant) and opens the browser, with a **theme picker
(all 19 presets) and a light/dark toggle** so you can see the component in your
target theme. Pass **several component ids** (or a group id) to render them
together in the same sandbox. `--preview` drops a `src/routes/preview/<id>` page
(plus a `/preview` index) into an existing SvelteKit app so it renders in your
running dev server.

## Usage

```sh
# add one component (installs @svgrid/grid)
npx @svgrid/ui add calendar

# add several, into a custom folder
npx @svgrid/ui add calendar time-picker --dir src/lib/ui

# add a whole family
npx @svgrid/ui add date-time

# just write files, don't run the package manager
npx @svgrid/ui add calendar --no-install

# see what you can add
npx @svgrid/ui list
```

### Options

| Flag             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--preview`, `-p`| (with `add`) Also write a `src/routes/preview/<id>` route so you can see it in your dev server. SvelteKit apps only. |
| `--dir <path>`   | Where to write files. Default: `src/lib/components/ui` (or `componentsDir` in a project `svgrid.json`). |
| `--force`        | Overwrite files that already exist.                                      |
| `--no-install`   | Skip installing the dependency; just print the install command.          |

## Components

<p align="center">
  <img src="https://svgrid.com/docs-media/svgrid-ui-map.svg" alt="The SvGrid UI suite: nine families of components, each usable standalone and as a grid cell editor." width="820" />
</p>

All 72 components ship in [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) and work standalone **or** as grid cell editors. Add any one with `npx @svgrid/ui add <id>`, a whole family with its group id, or see it instantly with `npx @svgrid/ui try <id>`. Click a component to see it live in the docs.

### Date & time family

Add the whole family: `npx @svgrid/ui add date-time` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try date-time`

| Component | id | What it is |
| --- | --- | --- |
| [Calendar](https://svgrid.com/docs/help/ui-components/sv-calendar/) | `calendar` | Themeable month / year / decade calendar with every selection mode. |
| [Time picker](https://svgrid.com/docs/help/ui-components/sv-time-picker/) | `time-picker` | Analog clock-dial time picker (12/24-hour, minute snapping). |
| [Date-time picker](https://svgrid.com/docs/help/ui-components/sv-date-time-picker/) | `date-time-picker` | Masked text field with DATE / TIME dropdown tabs. |
| [Date-range input](https://svgrid.com/docs/help/ui-components/sv-date-range-input/) | `date-range-input` | Compact start-to-end range field with preset shortcuts. |

### Buttons & toggles

Add the whole family: `npx @svgrid/ui add buttons` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try buttons`

| Component | id | What it is |
| --- | --- | --- |
| [Button](https://svgrid.com/docs/help/ui-components/sv-button/) | `button` | Themeable press primitive with variants, sizes, loading state, icon slot, and auto anchor rendering. |
| [Button group](https://svgrid.com/docs/help/ui-components/sv-button-group/) | `button-group` | Segmented button bar - single-select switcher, multi-select toggle set, or plain action row. |
| [Repeat button](https://svgrid.com/docs/help/ui-components/sv-repeat-button/) | `repeat-button` | A button that keeps firing while held - after an initial delay, then at a steady interval. |
| [Toggle button](https://svgrid.com/docs/help/ui-components/sv-toggle-button/) | `toggle-button` | A button with a sticky pressed on/off state, exposed via aria-pressed. |
| [Switch button](https://svgrid.com/docs/help/ui-components/sv-switch-button/) | `switch-button` | An on/off sliding switch with the ARIA switch role for settings that apply immediately. |
| [Checkbox](https://svgrid.com/docs/help/ui-components/sv-check-box/) | `check-box` | A themed checkbox with a true indeterminate state and an optional inline label. |
| [Radio group](https://svgrid.com/docs/help/ui-components/sv-radio-group/) | `radio-group` | Accessible single-select radio group with roving tabindex and arrow-key navigation. |
| [Rating](https://svgrid.com/docs/help/ui-components/sv-rating/) | `rating` | Star rating control on the ARIA slider pattern with hover preview, keyboard, and half steps. |

### Inputs

Add the whole family: `npx @svgrid/ui add inputs` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try inputs`

| Component | id | What it is |
| --- | --- | --- |
| [Text input](https://svgrid.com/docs/help/ui-components/sv-text-input/) | `text-input` | Single-line text field for text, email, url, tel and search, with clear button and validation chrome. |
| [Text area](https://svgrid.com/docs/help/ui-components/sv-text-area/) | `text-area` | Multi-line text field with optional auto-grow and a character counter. |
| [Number input](https://svgrid.com/docs/help/ui-components/sv-number-input/) | `number-input` | Numeric field with min/max/step, spinner buttons, thousands grouping, precision and prefix/suffix. |
| [Password input](https://svgrid.com/docs/help/ui-components/sv-password-input/) | `password-input` | Password field with a reveal toggle and an optional 4-level strength meter. |
| [Masked input](https://svgrid.com/docs/help/ui-components/sv-masked-input/) | `masked-input` | Pattern-masked text input that formats as you type and reports masked and raw values. |
| [Phone input](https://svgrid.com/docs/help/ui-components/sv-phone-input/) | `phone-input` | Country dial-code selector plus a national number field that emits an E.164-style string. |
| [Color input](https://svgrid.com/docs/help/ui-components/sv-color-input/) | `color-input` | Color swatch that opens a popover with a hex field, native picker and preset palette. |
| [OTP input](https://svgrid.com/docs/help/ui-components/sv-otp-input/) | `otp-input` | Segmented one-time-code / PIN entry with auto-advance and paste distribution. |
| [Duration input](https://svgrid.com/docs/help/ui-components/sv-duration-input/) | `duration-input` | Duration editor whose value is minutes but which accepts 1h 30m, 1:30 or 90. |
| [Tags input](https://svgrid.com/docs/help/ui-components/sv-tags-input/) | `tags-input` | Editable token / chips input over a string array with de-dupe and a max cap. |

### Selection

Add the whole family: `npx @svgrid/ui add selection` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try selection`

| Component | id | What it is |
| --- | --- | --- |
| [List box](https://svgrid.com/docs/help/ui-components/sv-list-box/) | `list-box` | Inline single/multi-select list, a WAI-ARIA listbox with type-ahead and optional windowing. |
| [Drop-down list](https://svgrid.com/docs/help/ui-components/sv-drop-down-list/) | `drop-down-list` | Single-select dropdown with a portalled, auto-flipping option list and no typing. |
| [Combo box](https://svgrid.com/docs/help/ui-components/sv-combo-box/) | `combo-box` | Searchable single-select where the value must come from the list; local or remote filtering. |
| [Auto complete](https://svgrid.com/docs/help/ui-components/sv-auto-complete/) | `auto-complete` | Free-text input with a live-filtered suggestion list; any value allowed. |
| [Multi select](https://svgrid.com/docs/help/ui-components/sv-multi-select/) | `multi-select` | Multi-select dropdown with a chip trigger, search box, and remote options. |
| [Tree select](https://svgrid.com/docs/help/ui-components/sv-tree-select/) | `tree-select` | Single-select dropdown over an indented, collapsible tree (cascader pattern). |
| [Grid select](https://svgrid.com/docs/help/ui-components/sv-grid-select/) | `grid-select` | Grid-in-a-dropdown single-select that picks a row across multiple columns. |
| [Country input](https://svgrid.com/docs/help/ui-components/sv-country-input/) | `country-input` | Searchable country picker with flag, dial code, and ISO alpha-2 output. |

### Range & meters

Add the whole family: `npx @svgrid/ui add range` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try range`

| Component | id | What it is |
| --- | --- | --- |
| [Slider](https://svgrid.com/docs/help/ui-components/sv-slider/) | `slider` | Single or dual-thumb range slider with steps, ticks, scale labels, and keyboard control. |
| [Gauge](https://svgrid.com/docs/help/ui-components/sv-gauge/) | `gauge` | Radial arc gauge for a single KPI with optional colored threshold bands. |
| [Progress](https://svgrid.com/docs/help/ui-components/sv-progress/) | `progress` | Linear determinate or indeterminate progress bar with intents, sizes, and label. |
| [Circular progress](https://svgrid.com/docs/help/ui-components/sv-circular-progress/) | `circular-progress` | Ring progress indicator, determinate or spinning, with center label or content. |
| [Sparkline](https://svgrid.com/docs/help/ui-components/sv-sparkline/) | `sparkline` | Tiny inline line, area, bar, or win/loss chart from a plain number array. |
| [Stat](https://svgrid.com/docs/help/ui-components/sv-stat/) | `stat` | KPI metric card with a big value and auto-colored up/down delta trend. |

### Overlays & menus

Add the whole family: `npx @svgrid/ui add overlays` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try overlays`

| Component | id | What it is |
| --- | --- | --- |
| [Popover](https://svgrid.com/docs/help/ui-components/sv-popover/) | `popover` | A floating panel anchored to a trigger, portalled to escape overflow-hidden ancestors. |
| [Tooltip](https://svgrid.com/docs/help/ui-components/sv-tooltip/) | `tooltip` | A small hover and focus tooltip anchored to its child, wired via aria-describedby. |
| [Modal](https://svgrid.com/docs/help/ui-components/sv-modal/) | `modal` | An accessible modal dialog with backdrop, focus trap, and Escape/backdrop close. |
| [Drawer](https://svgrid.com/docs/help/ui-components/sv-drawer/) | `drawer` | An edge-anchored side sheet (right/left/top/bottom) with the full dialog a11y contract. |
| [Toaster](https://svgrid.com/docs/help/ui-components/sv-toaster/) | `toaster` | The host that renders the shared toast queue; call toast() from anywhere. |
| [Context menu](https://svgrid.com/docs/help/ui-components/sv-context-menu/) | `context-menu` | Wraps a region and opens a menu at the pointer on right-click or long-press. |
| [Menu](https://svgrid.com/docs/help/ui-components/sv-menu/) | `menu` | A trigger-opened dropdown menu with submenus, icons, shortcuts, and keyboard support. |

### Layout & composite

Add the whole family: `npx @svgrid/ui add layout` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try layout`

| Component | id | What it is |
| --- | --- | --- |
| [Tabs](https://svgrid.com/docs/help/ui-components/sv-tabs/) | `tabs` | WAI-ARIA tab strip with roving arrow-key navigation, four positions, and optional closable tabs. |
| [Accordion](https://svgrid.com/docs/help/ui-components/sv-accordion/) | `accordion` | WAI-ARIA accordion of collapsible sections with single- or multiple-expand and roving header focus. |
| [Splitter](https://svgrid.com/docs/help/ui-components/sv-splitter/) | `splitter` | Two resizable panes split by a draggable WAI-ARIA separator, with pointer drag and arrow-key resize. |
| [Dock layout](https://svgrid.com/docs/help/ui-components/sv-dock-layout/) | `dock-layout` | Basic docking layout with nested resizable split groups, tabbed leaves, and drag-to-dock. |
| [Dock manager](https://svgrid.com/docs/help/ui-components/sv-dock-manager/) | `dock-manager` | Full docking manager with floating windows, tab reordering, and pinning / auto-hide. |
| [Card](https://svgrid.com/docs/help/ui-components/sv-card/) | `card` | Themed surface container with an optional header, body, and footer. |
| [Divider](https://svgrid.com/docs/help/ui-components/sv-divider/) | `divider` | Theme-driven separator line, horizontal or vertical, solid or dashed, with an optional label. |
| [Scroll area](https://svgrid.com/docs/help/ui-components/sv-scroll-area/) | `scroll-area` | Scroll container with the kit's themed custom scrollbars and contained overscroll. |
| [Grid chart](https://svgrid.com/docs/help/ui-components/sv-grid-chart/) | `grid-chart` | Inline-SVG chart that renders a ChartSpec with no external charting dependency, bound to grid data. |
| [Form](https://svgrid.com/docs/help/ui-components/sv-form/) | `form` | Schema-driven form that renders the UI-kit controls from a FormField[] with validation and submit. |
| [Field](https://svgrid.com/docs/help/ui-components/sv-field/) | `field` | Shared label / hint / error chrome that makes any control behave consistently. |
| [File upload](https://svgrid.com/docs/help/ui-components/sv-file-upload/) | `file-upload` | Drag-and-drop file field with click-to-browse, accept / size / count validation, and a file list. |

### Feedback & display

Add the whole family: `npx @svgrid/ui add feedback` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try feedback`

| Component | id | What it is |
| --- | --- | --- |
| [Badge](https://svgrid.com/docs/help/ui-components/sv-badge/) | `badge` | Small status pill or count label tinted from the grid's semantic tokens. |
| [Skeleton](https://svgrid.com/docs/help/ui-components/sv-skeleton/) | `skeleton` | Shimmering loading placeholder that reserves layout space while data loads. |
| [Alert](https://svgrid.com/docs/help/ui-components/sv-alert/) | `alert` | Inline contextual message with icon, title, dismiss, and trailing actions. |
| [Empty state](https://svgrid.com/docs/help/ui-components/sv-empty-state/) | `empty-state` | Centered placeholder for empty lists and no-results screens with an action slot. |
| [Chip](https://svgrid.com/docs/help/ui-components/sv-chip/) | `chip` | Compact interactive pill for tags, filter tokens, and entities with remove. |
| [Timeline](https://svgrid.com/docs/help/ui-components/sv-timeline/) | `timeline` | Vertical activity or history feed with a connecting rail and colored markers. |
| [Avatar](https://svgrid.com/docs/help/ui-components/sv-avatar/) | `avatar` | User avatar with automatic initials-and-color fallback and presence status dot. |
| [Avatar group](https://svgrid.com/docs/help/ui-components/sv-avatar-group/) | `avatar-group` | Overlapping stacked avatars with a +N overflow pill for members and assignees. |
| [Carousel](https://svgrid.com/docs/help/ui-components/sv-carousel/) | `carousel` | Sliding slideshow with arrows, dots, autoplay that pauses on hover, and swipe. |

### Navigation & rich

Add the whole family: `npx @svgrid/ui add navigation` &nbsp;·&nbsp; see them all: `npx @svgrid/ui try navigation`

| Component | id | What it is |
| --- | --- | --- |
| [Breadcrumb](https://svgrid.com/docs/help/ui-components/sv-breadcrumb/) | `breadcrumb` | A navigation trail that shows where the current page sits in your app's hierarchy. |
| [Pagination](https://svgrid.com/docs/help/ui-components/sv-pagination/) | `pagination` | A standalone pager: page numbers with ellipsis, prev/next, and optional first/last. |
| [Stepper](https://svgrid.com/docs/help/ui-components/sv-stepper/) | `stepper` | A progress stepper for wizards and multi-step forms, horizontal or vertical. |
| [Nav pane](https://svgrid.com/docs/help/ui-components/sv-nav-pane/) | `nav-pane` | An Outlook-style app-shell sidebar with collapsible sections, badges, and modules. |
| [Tree](https://svgrid.com/docs/help/ui-components/sv-tree/) | `tree` | A WAI-ARIA tree view with expand/select, tri-state checkboxes, virtualization, and lazy load. |
| [Command](https://svgrid.com/docs/help/ui-components/sv-command/) | `command` | A Cmd+K command palette: fuzzy-searchable actions in a focus-trapped dialog. |
| [Tour](https://svgrid.com/docs/help/ui-components/sv-tour/) | `tour` | A guided product tour that spotlights targets and walks users through each step. |
| [Rich text](https://svgrid.com/docs/help/ui-components/sv-rich-text/) | `rich-text` | A lightweight WYSIWYG editor with a formatting toolbar that emits HTML. |

Run `npx @svgrid/ui list` for the same catalogue in your terminal. Every component is also a plain import from `@svgrid/grid` - the CLI is a convenience, never the only way in.


MIT © jQWidgets Ltd
