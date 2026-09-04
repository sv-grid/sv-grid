# shadcn-svelte integration

If your Svelte 5 app already uses shadcn-svelte, SvGrid drops in
without a redesign. You keep the exact palette, radius, font, and dark
mode you already have - the grid reads them straight from the same CSS
variables your `Button`, `Input`, and `Table` components use.

There is nothing to "port". A shadcn app stores its theme as a flat
set of CSS custom properties (`--background`, `--foreground`,
`--border`, `--primary`, ...). SvGrid themes off its own flat set of
custom properties (`--sg-*`). Wiring the two together is one CSS block
- no JavaScript, no theme provider, no re-render on toggle.

## Side by side: the same table, before and after

On the left is what a shadcn app already has - a hand-written
`Table`. On the right is the same region rendered by `<SvGrid>`, which
inherits the identical tokens and adds sorting, filtering, and
virtualization for free. The only new lines are the import and the
grid element.

<div style="display:grid;gap:1rem;grid-template-columns:1fr 1fr;align-items:start;margin:1rem 0">
  <div style="min-width:0">
    <strong>Before - shadcn <code>Table</code></strong>
    <pre style="overflow:auto"><code>&lt;script lang="ts"&gt;
  import * as Table from '$lib/components/ui/table'
  let rows = [/* ...orders... */]
&lt;/script&gt;

&lt;Table.Root&gt;
  &lt;Table.Header&gt;
    &lt;Table.Row&gt;
      &lt;Table.Head&gt;Order&lt;/Table.Head&gt;
      &lt;Table.Head&gt;Customer&lt;/Table.Head&gt;
      &lt;Table.Head class="text-right"&gt;Amount&lt;/Table.Head&gt;
    &lt;/Table.Row&gt;
  &lt;/Table.Header&gt;
  &lt;Table.Body&gt;
    {#each rows as r}
      &lt;Table.Row&gt;
        &lt;Table.Cell&gt;{r.id}&lt;/Table.Cell&gt;
        &lt;Table.Cell&gt;{r.customer}&lt;/Table.Cell&gt;
        &lt;Table.Cell class="text-right"&gt;{r.amount}&lt;/Table.Cell&gt;
      &lt;/Table.Row&gt;
    {/each}
  &lt;/Table.Body&gt;
&lt;/Table.Root&gt;
&lt;!-- static markup: no sort, no filter, no virtualization --&gt;</code></pre>
  </div>
  <div style="min-width:0">
    <strong>After - <code>&lt;SvGrid&gt;</code>, same tokens</strong>
    <pre style="overflow:auto"><code>&lt;script lang="ts"&gt;
  import { SvGrid, type ColumnDef } from '@svgrid/grid'
  import '@svgrid/grid/themes/shadcn.css'  // 1 line to match shadcn

  let rows = [/* ...same orders... */]
  const columns: ColumnDef[] = [
    { id: 'id',       field: 'id',       header: 'Order' },
    { id: 'customer', field: 'customer', header: 'Customer' },
    { id: 'amount',   field: 'amount',   header: 'Amount', type: 'number' },
  ]
&lt;/script&gt;

&lt;SvGrid
  data={rows}
  {columns}
  sortable
  filterable
  class="rounded-md border" /&gt;
&lt;!-- sortable, filterable, virtualized, keyboard + a11y --&gt;</code></pre>
  </div>
</div>

The `@svgrid/grid/themes/shadcn.css` import above is the fastest path:
a ready-made preset that mirrors shadcn's zinc-neutral palette in light
and dark, toggled by the same `[data-theme='dark']` attribute you
already use. Import it once and you are done.

## Install it with the CLI you already have

SvGrid publishes a shadcn-svelte registry item, so the grid installs the
same way the rest of your components did:

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)
  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```sh
npx shadcn-svelte@latest add https://svgrid.com/r/data-table.json
```

That writes a ready-to-edit `data-table.svelte` into
`$lib/components/ui/data-table/` and installs `@svgrid/grid`. Your
`components.json` aliases are respected, and the file is yours - the
difference from a copied recipe is that the behaviour behind it lives in a
package you version-bump.

Already have the TanStack-based data table from the shadcn docs? See
[Migrating from the shadcn-svelte data table](./migrating-from-shadcn-data-table.md).

## Inherit your *exact* theme with the live token bridge

The preset matches the default shadcn look. If you have customized your
theme - a different `--primary`, a wider `--radius`, a brand font - skip
the preset and bridge SvGrid's tokens to *your* variables instead. Now
the grid tracks whatever your app's tokens resolve to, in real time.

shadcn stores its palette as bare HSL channels (`--background` holds
`0 0% 100%`, not `hsl(0 0% 100%)`), so wrap each one in `hsl()` at the
point of assignment:

```css
/* Scope to a wrapper so only grids inside it inherit the map.
 * Move it to :root in app.css to theme every grid on the site. */
.sg-shadcn {
  --sg-bg:                    hsl(var(--background));
  --sg-fg:                    hsl(var(--foreground));
  --sg-border:                hsl(var(--border));
  --sg-header-bg:             hsl(var(--muted));
  --sg-header-fg:             hsl(var(--foreground));
  --sg-row-alt-bg:            hsl(var(--muted) / 0.3);
  --sg-row-hover-bg:          hsl(var(--accent));
  --sg-selection-bg:          hsl(var(--primary) / 0.15);
  --sg-accent:                hsl(var(--primary));
  --sg-focus-ring:            0 0 0 2px hsl(var(--ring));
  --sg-scrollbar-bg:          hsl(var(--background));
  --sg-scrollbar-thumb:       hsl(var(--muted-foreground) / 0.4);
  --sg-scrollbar-thumb-hover: hsl(var(--muted-foreground) / 0.6);
  --sg-font:                  var(--font-sans, sans-serif);
  --sg-radius:                var(--radius);
}
```

```svelte {runnable}
<div class="sg-shadcn">
  <SvGrid {data} {columns} sortable filterable rowHeight={40} />
</div>
```

Row height is a prop, not a token - the virtualizer needs it as a
number, so it cannot come from the stylesheet above.

**Always wrap in `hsl()`.** Writing `--sg-accent: var(--primary)`
passes bare HSL channels straight to the grid, which expects a complete
colour value - the result is an invalid colour (usually transparent).

## Dark mode is automatic

shadcn already redefines its tokens under `.dark`. Because every
`--sg-*` value above is expressed *in terms of* those tokens, the grid
flips with the rest of your app the instant `.dark` is toggled on
`<html>` - no listener, no reactive statement, no API call. SvGrid
reads `--sg-*` from the DOM at paint time, so mid-session theme
switches repaint the grid for free.

This also means nested themes work: put `.dark` on one panel and grids
inside it go dark while the rest of the page stays light.

## Custom cells with shadcn components

Cell snippets are plain Svelte, so you can render shadcn components
directly inside the grid - a `Badge` for status, a `Button` for row
actions:

```svelte
{#snippet StatusCell({ value }: { value: string })}
  <Badge variant={value === 'delivered' ? 'default' : 'secondary'}>
    {value}
  </Badge>
{/snippet}

{#snippet RowActions({ row })}
  <Button variant="ghost" size="sm" onclick={() => edit(row)}>Edit</Button>
{/snippet}
```

Assign the snippet to a column's `cell` field
(`{ id: 'status', field: 'status', header: 'Status', cell: StatusCell }`)
and it renders in every row, inheriting the same theme context.

## A note on OKLCH

Recent shadcn-svelte releases have been migrating tokens from bare HSL
channels to OKLCH. If your `app.css` defines `--primary` as
`oklch(...)`, use `oklch(var(--primary) / 0.15)` in the bridge instead
of `hsl(...)`. Check the format of `--background` in your `app.css`
before writing the map; open DevTools and confirm the computed value of
`--sg-bg` is a real colour, not transparent, after any shadcn upgrade.

## Frequently asked questions

### Does SvGrid work with shadcn-svelte?

Yes. Import the `@svgrid/grid/themes/shadcn.css` preset for the default
shadcn look, or bridge SvGrid's `--sg-*` tokens to your own
`--background` / `--foreground` / `--primary` variables to inherit your
exact customized theme. Both handle dark mode through the same
`.dark` / `[data-theme='dark']` toggle you already use.

### Do I need to duplicate my theme for the grid?

No. The whole point of the token bridge is that there is one source of
truth - your shadcn variables. The grid reads them; it does not copy
them.

### Will dark mode break?

No, as long as your bridge expresses `--sg-*` in terms of shadcn tokens
(`hsl(var(--background))`) rather than hard-coded colours. The cascade
handles the flip.

## Try it

The grid reads `--sg-*` custom properties, so matching a design system is a
block of variables rather than a theme file. Change one and the grid follows.

```svelte {runnable}
<div class="shadcn-scope">
  <SvGrid data={people} {columns} sortable />
</div>

<style>
  .shadcn-scope {
    --sg-accent: hsl(240 5.9% 10%);
    --sg-border: hsl(240 5.9% 90%);
    --sg-header-bg: hsl(240 4.8% 95.9%);
    --sg-row-hover: hsl(240 4.8% 97%);
    --sg-radius: 8px;
    --sg-font-size: 13px;
  }
</style>
```

## Matching a light shadcn surface

The same grid under a light token block. Because the tokens are plain custom
properties, a theme switch is a class change rather than a rebuild.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', age: 54, salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 150,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<div class="shadcn-light">
  <SvGrid data={seed} {columns} sortable />
</div>

<style>
  .shadcn-light {
    --sg-bg: hsl(0 0% 100%);
    --sg-fg: hsl(240 10% 3.9%);
    --sg-border: hsl(240 5.9% 90%);
    --sg-header-bg: hsl(240 4.8% 95.9%);
    --sg-header-fg: hsl(240 3.8% 46.1%);
    --sg-row-hover: hsl(240 4.8% 97.5%);
    --sg-accent: hsl(240 5.9% 10%);
    --sg-radius: 8px;
  }
</style>
```

## See also

- [Design tokens](./tokens.md) - the full `--sg-*` surface and the 19
  built-in presets (`shadcn`, `tailwind`, `material`, ...)
- [Tailwind integration](./tailwind.md) - wiring tokens through
  Tailwind's `theme(...)` layer
- [Theme integrations](https://svgrid.com/demos/74-theme-integrations/)
  demo - shadcn and four other design systems, side by side, light and
  dark
