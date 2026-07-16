<script lang="ts">
  /**
   * SvSwitchButton - an on/off sliding switch (ARIA `switch`). Parity: Smart
   * `smart-switch-button`. Controlled via `checked` + `onChange`; keyboard
   * togglable; optional inline on/off labels.
   */
  type Props = {
    checked?: boolean
    onChange?: (checked: boolean) => void
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    name?: string
    ariaLabel?: string
    /** Optional labels rendered inside the track. */
    onLabel?: string
    offLabel?: string
  }

  let {
    checked = false,
    onChange,
    disabled = false,
    size = 'md',
    name,
    ariaLabel,
    onLabel,
    offLabel,
  }: Props = $props()

  function toggle() {
    if (disabled) return
    onChange?.(!checked)
  }
  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
    else if (e.key === 'ArrowRight') { if (!checked) onChange?.(true) }
    else if (e.key === 'ArrowLeft') { if (checked) onChange?.(false) }
  }
</script>

<button
  type="button"
  role="switch"
  class="sv-switch sv-switch--{size}"
  class:is-on={checked}
  aria-checked={checked}
  aria-label={ariaLabel}
  {disabled}
  onclick={toggle}
  onkeydown={onKeydown}
>
  <span class="sv-switch__track">
    {#if onLabel || offLabel}
      <span class="sv-switch__txt sv-switch__txt--on">{onLabel ?? ''}</span>
      <span class="sv-switch__txt sv-switch__txt--off">{offLabel ?? ''}</span>
    {/if}
    <span class="sv-switch__thumb"></span>
  </span>
  {#if name}<input type="hidden" {name} value={checked ? 'true' : 'false'} />{/if}
</button>

<style>
  .sv-switch {
    --_accent: var(--sg-accent, #2563eb);
    --_h: 22px; --_w: 40px;
    display: inline-flex; align-items: center; background: none; border: 0; padding: 2px; cursor: pointer;
  }
  .sv-switch--sm { --_h: 18px; --_w: 32px; }
  .sv-switch--lg { --_h: 28px; --_w: 52px; }
  .sv-switch[disabled] { opacity: 0.5; cursor: not-allowed; }
  .sv-switch__track {
    position: relative; width: var(--_w); height: var(--_h); border-radius: 999px;
    background: var(--sg-border, #cbd5e1); transition: background 0.16s;
    display: inline-flex; align-items: center;
  }
  .sv-switch.is-on .sv-switch__track { background: var(--_accent); }
  .sv-switch__thumb {
    position: absolute; left: 2px; top: 50%; transform: translateY(-50%);
    width: calc(var(--_h) - 4px); height: calc(var(--_h) - 4px); border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.16s;
  }
  .sv-switch.is-on .sv-switch__thumb { left: calc(var(--_w) - var(--_h) + 2px); }
  .sv-switch__txt {
    position: absolute; font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase;
    top: 50%; transform: translateY(-50%);
  }
  .sv-switch__txt--on { left: 6px; opacity: 0; }
  .sv-switch__txt--off { right: 5px; color: var(--sg-muted, #64748b); }
  .sv-switch.is-on .sv-switch__txt--on { opacity: 1; }
  .sv-switch.is-on .sv-switch__txt--off { opacity: 0; }
  .sv-switch:focus-visible { outline: none; }
  .sv-switch:focus-visible .sv-switch__track { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
