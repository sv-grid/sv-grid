<script lang="ts">
  /**
   * SvSwitchButton - an on/off sliding switch (ARIA `switch`). Parity: Smart
   * `smart-switch-button`. Controlled via `checked` + `onChange`; keyboard
   * togglable; optional inline on/off labels.
   */
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createSwitch } from './createSwitch.svelte'

  type Props = SvEditorProps & {
    checked?: boolean
    onChange?: (checked: boolean) => void
    /** Optional labels rendered inside the track. */
    onLabel?: string
    offLabel?: string
  }

  let {
    checked = false,
    onChange,
    disabled = false,
    readonly = false,
    size = 'md',
    name,
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    onLabel,
    offLabel,
  }: Props = $props()

  const autoId = nextEditorId('sv-switch')
  const uid = $derived(id ?? autoId)

  // The styled switch is just a renderer over the headless core.
  const sw = createSwitch({
    checked: () => checked,
    onChange: (v) => { if (readonly) return; onChange?.(v) },
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <!-- role="switch" arrives via switchProps(), which the a11y pass cannot see through -->
  <!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
  <button
    class="sv-switch sv-switch--{size}"
    class:is-on={checked}
    class:is-readonly={readonly}
    {...sw.switchProps()}
    aria-readonly={readonly ? 'true' : undefined}
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
</SvField>

<style>
  .sv-switch {
    --_accent: var(--sg-accent, #2563eb);
    --_h: 22px; --_w: 40px;
    display: inline-flex; align-items: center; background: none; border: 0; padding: 2px; cursor: pointer;
  }
  .sv-switch--sm { --_h: 18px; --_w: 32px; }
  .sv-switch--lg { --_h: 28px; --_w: 52px; }
  .sv-switch[disabled] { opacity: 0.5; cursor: not-allowed; }
  .sv-switch.is-readonly { cursor: default; }
  .sv-switch__track {
    position: relative; width: var(--_w); height: var(--_h); border-radius: 999px;
    background: var(--sg-border, #cbd5e1); transition: background 0.16s;
    display: inline-flex; align-items: center;
  }
  .sv-switch.is-on .sv-switch__track { background: var(--_accent); }
  .sv-switch__thumb {
    position: absolute; inset-inline-start: 2px; top: 50%; transform: translateY(-50%);
    width: calc(var(--_h) - 4px); height: calc(var(--_h) - 4px); border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: inset-inline-start 0.16s;
  }
  .sv-switch.is-on .sv-switch__thumb { inset-inline-start: calc(var(--_w) - var(--_h) + 2px); }
  .sv-switch__txt {
    position: absolute; font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase;
    top: 50%; transform: translateY(-50%);
  }
  .sv-switch__txt--on { inset-inline-start: 6px; opacity: 0; }
  .sv-switch__txt--off { inset-inline-end: 5px; color: var(--sg-muted, #64748b); }
  .sv-switch.is-on .sv-switch__txt--on { opacity: 1; }
  .sv-switch.is-on .sv-switch__txt--off { opacity: 0; }
  .sv-switch:focus-visible { outline: none; }
  .sv-switch:focus-visible .sv-switch__track { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
