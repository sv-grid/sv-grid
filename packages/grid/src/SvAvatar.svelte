<script lang="ts">
  /**
   * SvAvatar - a user/entity avatar: an image with an initials + colour-hash
   * fallback (used when there is no `src` or the image fails to load), plus an
   * optional presence status dot. Parity: Smart avatar.
   *
   * ```svelte
   * <SvAvatar name="Ada Lovelace" src="/ada.jpg" status="online" />
   * ```
   */
  import { avatarInitials, avatarColorHue } from './avatar'

  type Props = {
    name?: string
    src?: string
    alt?: string
    /** Preset (sm 28 / md 36 / lg 48) or an explicit pixel size. */
    size?: 'sm' | 'md' | 'lg' | number
    shape?: 'circle' | 'square'
    status?: 'online' | 'offline' | 'busy' | 'away'
    /** Override the hash-derived fallback colour (any CSS colour). */
    color?: string
  }

  let { name = '', src, alt, size = 'md', shape = 'circle', status, color }: Props = $props()

  const px = $derived(typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 48 : 36)
  const initials = $derived(avatarInitials(name))
  const bg = $derived(color ?? `hsl(${avatarColorHue(name || '?')} 62% 45%)`)
  // Fall back to initials when the image errors.
  let broken = $state(false)
  const showImg = $derived(!!src && !broken)
</script>

<span
  class="sv-avatar sv-avatar--{shape}"
  style:width={`${px}px`}
  style:height={`${px}px`}
  style:font-size={`${Math.round(px * 0.4)}px`}
  style:background={showImg ? undefined : bg}
  role="img"
  aria-label={alt ?? (name || 'avatar')}
  title={name || undefined}
>
  {#if showImg}
    <img class="sv-avatar__img" src={src} alt={alt ?? name} onerror={() => (broken = true)} />
  {:else if initials}
    <span class="sv-avatar__initials" aria-hidden="true">{initials}</span>
  {:else}
    <svg class="sv-avatar__ph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.5-8 5.5V22h16v-2.5C20 16.5 16.4 14 12 14Z" /></svg>
  {/if}
  {#if status}<span class="sv-avatar__status is-{status}" aria-hidden="true"></span>{/if}
</span>

<style>
  .sv-avatar {
    position: relative; display: inline-grid; place-items: center; overflow: visible;
    color: #fff; font-weight: 600; line-height: 1; user-select: none; flex: none;
    vertical-align: middle;
  }
  .sv-avatar--circle { border-radius: 50%; }
  .sv-avatar--square { border-radius: 22%; }
  .sv-avatar__img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
  .sv-avatar--circle .sv-avatar__img, .sv-avatar--circle { }
  .sv-avatar__initials { letter-spacing: 0.02em; }
  .sv-avatar__ph { width: 62%; height: 62%; opacity: 0.9; }
  .sv-avatar__status {
    position: absolute; right: -1px; bottom: -1px; width: 28%; height: 28%; min-width: 8px; min-height: 8px;
    border-radius: 50%; border: 2px solid var(--sg-bg, #fff);
  }
  .sv-avatar__status.is-online { background: var(--sg-success, #16a34a); }
  .sv-avatar__status.is-offline { background: var(--sg-muted, #94a3b8); }
  .sv-avatar__status.is-busy { background: var(--sg-danger, #dc2626); }
  .sv-avatar__status.is-away { background: var(--sg-warning, #d97706); }
</style>
