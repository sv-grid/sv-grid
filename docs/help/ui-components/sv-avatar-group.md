# SvAvatarGroup

Overlapping, stacked avatars with a "+N" overflow pill - the "assigned to" and
"members" row for cards, tables, and detail panels.

`SvAvatarGroup` takes an array of avatar descriptors and renders them as a neat
overlapping stack, capping the count with `max` and rolling the rest into a
"+N" pill. Each entry is a subset of [SvAvatar](sv-avatar.md) props, so the same
initials-and-color fallback applies to every face.

Related: [SvAvatar](sv-avatar.md) · [SvChip](sv-chip.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvAvatarGroup` starter into your app:

<div data-docs-add="add avatar-group"></div>

Prefer to see it first? `npx @svgrid/ui try avatar-group` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvAvatarGroup` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvAvatarGroup } from '@svgrid/grid'
```

## Example

<div data-docs-demo="340-command-palette" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvAvatarGroup } from '@svgrid/grid'
</script>

<SvAvatarGroup max={3} avatars={[
  { name: 'Ada Lovelace' },
  { name: 'Alan Turing' },
  { name: 'Grace Hopper' },
  { name: 'Ken Thompson' },
]} />
```

## Props

| Prop      | Type                             | Default | Description                                                    |
| --------- | -------------------------------- | ------- | ------------------------------------------------------------- |
| `avatars` | `ReadonlyArray<AvatarProps>`     | -       | The people/entities to stack (see the entry shape below).     |
| `max`     | `number`                         | `4`     | How many avatars to show before collapsing to "+N".           |
| `size`    | `sm` \| `md` \| `lg` \| `number`| `md`    | Size preset or explicit pixel size, applied to every avatar.  |

### The avatar entry shape

Each item is a compact subset of the [SvAvatar](sv-avatar.md) props:

```ts
type AvatarProps = {
  name?: string   // initials + deterministic fallback color
  src?: string    // image URL
  alt?: string    // accessible name
  color?: string  // override the fallback color
}
```

The overlap and the "+N" pill size scale automatically with `size`.

## Examples

### Assignees on a card

Drop a group into a card footer to show who is on a task:

```svelte
<SvAvatarGroup size="sm" max={4} avatars={task.assignees} />
```

### Overflow tuning

Lower `max` in tight rows so more faces roll into the "+N" pill:

```svelte
<SvAvatarGroup max={2} avatars={team} />
<!-- shows 2 faces then +N for the rest -->
```

### Mixing images and initials

Entries with a `src` render the photo; entries without fall back to initials -
in the same stack:

```svelte
<SvAvatarGroup avatars={[
  { name: 'Ada Lovelace', src: '/ada.jpg' },
  { name: 'Grace Hopper' },
]} />
```

### Reviewers from records

Map your own member objects to the compact entry shape, then let `max` collapse
the tail into "+N" - ideal for an "assigned to" cell or a card footer:

```svelte {runnable}
<script lang="ts">
  import { SvAvatarGroup } from '@svgrid/grid'

  type Member = { id: string; fullName: string; photoUrl?: string }
  let reviewers = $state<Member[]>([])

  const faces = $derived(
    reviewers.map((m) => ({ name: m.fullName, src: m.photoUrl }))
  )
</script>

<div style="display:flex; align-items:center; gap:8px;">
  <SvAvatarGroup size="sm" max={4} avatars={faces} />
  <span style="color:var(--sg-muted); font-size:12px;">{reviewers.length} reviewers</span>
</div>
```

> Tip: the overlap and the "+N" pill scale from `size`, so switching to
> `size="sm"` in a dense grid row keeps the stack tight without any manual
> spacing.

## Accessibility

- The stack is a `role="group"`; each face is an [SvAvatar](sv-avatar.md) with
  its own `aria-label`, so every visible member is announced.
- The "+N" pill is text, so the hidden count is readable - though for a full
  roster, pair the group with an expandable list.
- Faces overlap visually but keep their own labels; color is a supplement, not
  the only cue.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvAvatar](sv-avatar.md) - the single-face primitive this stacks.
- [SvChip](sv-chip.md) - a removable per-person chip when you need names too.
