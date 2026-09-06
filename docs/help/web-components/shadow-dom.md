# Shadow DOM: `<sv-grid-shadow>`

Two elements ship, and which one you want is a styling decision:

| Element | Renders in | Page CSS | Use when |
| --- | --- | --- | --- |
| `<sv-grid>` | the light DOM | applies normally | Almost always - a data grid usually wants to inherit your app's theme. |
| `<sv-grid-shadow>` | an open shadow root | **cannot reach the grid** | You are embedding in a page whose CSS you do not control, or shipping into someone else's site. |

They are two elements rather than one with a `shadow` attribute because Svelte's
`customElement.shadow` is resolved when the component is COMPILED. No runtime
flag can switch it, so no attribute can either.

```html
<script type="module" src="https://unpkg.com/@svgrid/grid-wc/dist/shadow/sv-grid-shadow-element.js"></script>

<sv-grid-shadow id="grid" sortable filterable style="display:block;height:420px"></sv-grid-shadow>
<script type="module">
  const grid = document.getElementById('grid')
  grid.columns = [{ field: 'name', header: 'Name' }, { field: 'city', header: 'City' }]
  grid.data = [{ name: 'Ada', city: 'London' }, { name: 'Linus', city: 'Helsinki' }]
</script>
```

Everything else is identical: the same 98 properties, the same 72 attributes,
the same 20 events. Events are dispatched `composed: true`, so
`addEventListener` on the host works exactly as it does on `<sv-grid>`.


## What the shadow root does and does not isolate

Theming with `--sg-*` tokens, which reach into the shadow root by inheritance.

<div data-docs-demo="10-custom-cells-and-themes" data-height="500"></div>

The root is **open**, never closed. A closed root leaves `el.shadowRoot` null,
which would stop you styling, querying, or testing your own grid - so it is not
offered.

Isolation is one-directional, and worth being precise about:

- **Page CSS cannot reach the grid.** A page rule like
  `table td { background: fuchsia }` hits `<sv-grid>` and stops at
  `<sv-grid-shadow>`'s boundary. That is the point of the element.
- **The grid's CSS is still in your page.** About twenty overlay surfaces - the
  cell dropdown, the date picker, tooltips, toasts, modals - portal to
  `document.body` deliberately, so they escape every ancestor `overflow` and
  clip. Those land outside the shadow root, so the bundle injects its stylesheet
  into `document.head` as well as adopting it into the root. Every rule is
  scoped to an `.sv-grid-*` class, so it does not style your page, but it is
  present in it.

## Theming

`--sg-*` tokens work in both elements, unchanged:

```css
sv-grid, sv-grid-shadow {
  --sg-bg: #fff;
  --sg-header-bg: #f8fafc;
}
```

A theme stylesheet works too, including its dark variant, even though its
selectors are `:root` and `:root[data-theme='dark']` and neither can MATCH
inside a shadow tree. Custom properties are *inherited* properties, and
inheritance crosses a shadow boundary - so the values land on the host and are
inherited by everything in the root. Verified in a browser rather than reasoned
about: it was assumed to be broken for a while, and it is not.


## Constraints

Selection, clipboard and the menus that portal out of the root - all identical inside a shadow tree.

<div data-docs-demo="04-selection-copy-paste" data-height="460"></div>

- **The root is resolved on mount.** Moving a live `<sv-grid-shadow>` into a
  different document needs a fresh element, not a reparent.
- **Do not give the host a `transform`, `filter`, or `contain`.** Any of those
  makes it a containing block for fixed positioning, and the grid's menus -
  which are `position: fixed` - would anchor to the host instead of the
  viewport.
- **Closed roots are unsupported**, for the reason above.


## See also

- [Quick start](./quick-start.md)
- [`<sv-grid>` reference](./sv-grid.md)
- [Limitations](./limitations.md)
