<script lang="ts">
  /**
   * A person's avatar as user cells and the user editor draw it: the picture,
   * or initials on a color from the name.
   */
  import type { FieldUser } from './sources.svelte'
  import { safeUrl } from './attachments'

  let { user, size = 20 }: { user: FieldUser; size?: number } = $props()

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'
  const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  const src = $derived(user.avatarUrl ? safeUrl(user.avatarUrl, true) : null)
</script>

{#if src}
  <img class="sv-fuf" {src} alt="" width={size} height={size} loading="lazy" decoding="async" style:--s={`${size}px`} />
{:else}
  <span class="sv-fuf" style:--s={`${size}px`} style:background={`hsl(${hue(user.name)} 55% 46%)`} aria-hidden="true">{initials(user.name)}</span>
{/if}

<style>
  .sv-fuf {
    display: inline-flex; flex: none; align-items: center; justify-content: center;
    width: var(--s); height: var(--s); border-radius: 999px; object-fit: cover;
    color: #fff; font-size: calc(var(--s) * 0.45); font-weight: 600;
    box-shadow: 0 0 0 2px var(--sg-bg, #fff);
  }
</style>
