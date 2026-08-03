# SvAvatar

A user or entity avatar: an image with an automatic initials-and-color fallback,
plus an optional presence status dot.

`SvAvatar` never shows a broken image. Give it a `name` and, if you have one, a
`src`; when the image is missing or fails to load, it falls back to up-to-two
initials on a stable, name-derived color so the same person always gets the same
tint. Presets cover the common sizes, and a `status` dot marks presence.

Related: [SvAvatarGroup](sv-avatar-group.md) · [SvChip](sv-chip.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvAvatar` starter into your app:

<div data-docs-add="add avatar"></div>

Prefer to see it first? `npx @svgrid/ui try avatar` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvAvatar` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvAvatar } from '@svgrid/grid'
```

## Example

<div data-docs-demo="333-app-feedback" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvAvatar } from '@svgrid/grid'
</script>

<SvAvatar name="Ada Lovelace" src="/ada.jpg" status="online" />
<SvAvatar name="Grace Hopper" />           <!-- initials fallback -->
<SvAvatar name="Alan Turing" size="lg" shape="square" />
```

## Props

| Prop     | Type                                           | Default  | Description                                                        |
| -------- | ---------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `name`   | `string`                                       | `''`     | Drives the initials fallback and the deterministic color.         |
| `src`    | `string`                                       | -        | Image URL. On load error, falls back to initials automatically.   |
| `alt`    | `string`                                       | -        | Accessible name; defaults to `name`.                              |
| `size`   | `sm` \| `md` \| `lg` \| `number`              | `md`     | Preset (28 / 36 / 48 px) or an explicit pixel size.               |
| `shape`  | `circle` \| `square`                          | `circle` | Circle or rounded square.                                         |
| `status` | `online` \| `offline` \| `busy` \| `away`     | -        | Presence dot in the corner, colored per state.                    |
| `color`  | `string`                                       | -        | Overrides the hash-derived fallback color (any CSS color).        |

The initials and fallback color come from two pure helpers exported alongside
the component, so you can reuse the same logic outside an avatar:

```ts
import { avatarInitials, avatarColorHue } from '@svgrid/grid'

avatarInitials('Ada Lovelace') // 'AL'
avatarColorHue('Ada Lovelace') // stable hue 0-359 for a matching tint
```

## Examples

### Image with graceful fallback

Always pass `name` even when you have a `src` - it becomes the fallback if the
image fails:

```svelte
<SvAvatar name={user.fullName} src={user.photoUrl} />
```

### Presence

The `status` dot marks online / away / busy / offline state for people rows:

```svelte
<SvAvatar name="Ada" status={user.online ? 'online' : 'offline'} />
```

### Custom sizing and color

Pass a number for an exact size and `color` to pin a brand tint:

```svelte
<SvAvatar name="Support Bot" size={56} color="#7c3aed" shape="square" />
```

### Reusing the initials and color helpers

The same helpers that drive the fallback are exported, so you can render a
matching initials chip anywhere - for example a compact mention token - without
mounting an avatar:

```svelte
<script lang="ts">
  import { avatarInitials, avatarColorHue } from '@svgrid/grid'

  const name = 'Grace Hopper'
  const bg = `hsl(${avatarColorHue(name)} 62% 45%)`
</script>

<span
  style="display:inline-grid; place-items:center; width:24px; height:24px;
         border-radius:50%; color:#fff; font-size:10px; font-weight:600;
         background:{bg};"
>
  {avatarInitials(name)}
</span>
```

Because `avatarColorHue` is a pure hash of the name, the same person always
lands on the same tint here as in every `SvAvatar` and `SvAvatarGroup` on the
page.

## Accessibility

- Renders with `role="img"` and an `aria-label` (from `alt`, else `name`), so it
  announces even in initials mode.
- The presence dot is decorative (`aria-hidden`); reflect status in text where it
  matters.
- The initials and placeholder glyph are hidden from assistive tech since the
  label already conveys the identity.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvAvatarGroup](sv-avatar-group.md) - stacked avatars with a "+N" overflow.
- [SvChip](sv-chip.md) - entity chips that use an avatar as their leading icon.
