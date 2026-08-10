<script lang="ts">
  /**
   * SvOtpInput - a segmented one-time-code / PIN entry: N single-char cells with
   * auto-advance, Backspace-to-previous, arrow navigation, and paste that
   * distributes across the cells. Emits the joined string. Parity: Smart OTP.
   *
   * ```svelte
   * <SvOtpInput length={6} value={code} onChange={(v) => (code = v)}
   *   onComplete={(v) => verify(v)} />
   * ```
   */
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'
  import { sanitizeOtp, otpCells, isOtpComplete } from './otp'

  type Props = Pick<
    SvEditorProps,
    'disabled' | 'label' | 'hint' | 'error' | 'required' | 'dir' | 'size' | 'id' | 'name' | 'invalid'
  > & {
    value?: string
    onChange?: (value: string) => void
    /** Fired once every cell is filled. */
    onComplete?: (value: string) => void
    length?: number
    /** Digits only (default) vs any character. */
    numeric?: boolean
    /** Mask the characters (password dots). */
    mask?: boolean
    autofocus?: boolean
  }

  let {
    value = $bindable(''),
    onChange,
    onComplete,
    length = 6,
    numeric = true,
    mask = false,
    disabled = false,
    label,
    hint,
    error,
    required = false,
    dir,
    size = 'md',
    id,
    name,
    invalid = false,
    autofocus = false,
  }: Props = $props()

  const autoId = nextEditorId('sv-otp')
  const uid = $derived(id ?? autoId)
  const cells = $derived(otpCells(sanitizeOtp(value, length, numeric), length))
  let inputs = $state<HTMLInputElement[]>([])

  function commit(next: string) {
    const clean = sanitizeOtp(next, length, numeric)
    value = clean // enables bind:value
    onChange?.(clean)
    if (isOtpComplete(clean, length)) onComplete?.(clean)
  }
  function focusCell(i: number) {
    const el = inputs[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }
  function currentCells(): string[] {
    return otpCells(sanitizeOtp(value, length, numeric), length)
  }

  function onCellInput(i: number, e: Event) {
    const ch = sanitizeOtp((e.currentTarget as HTMLInputElement).value, 1, numeric).slice(-1)
    const arr = currentCells()
    arr[i] = ch
    commit(arr.join(''))
    if (ch) focusCell(i + 1)
  }
  function onCellKeydown(i: number, e: KeyboardEvent) {
    const rtl = dir === 'rtl'
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = currentCells()
      if (arr[i]) {
        arr[i] = ''
        commit(arr.join(''))
      } else if (i > 0) {
        arr[i - 1] = ''
        commit(arr.join(''))
        focusCell(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusCell(rtl ? i + 1 : i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusCell(rtl ? i - 1 : i + 1)
    }
  }
  function onPaste(i: number, e: ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData?.getData('text') ?? ''
    const arr = currentCells()
    const pasted = sanitizeOtp(text, length - i, numeric)
    for (let k = 0; k < pasted.length; k++) arr[i + k] = pasted[k]!
    const joined = arr.join('')
    commit(joined)
    focusCell(Math.min(i + pasted.length, length - 1))
  }
  function mountFocus(node: HTMLInputElement, i: number) {
    if (autofocus && i === 0) node.focus()
  }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div
    class="sv-otp sv-otp--{size}"
    class:is-disabled={disabled}
    class:is-invalid={invalid}
    role="group"
    {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel: label ?? 'One-time code' })}
  >
    {#each cells as cell, i (i)}
      <input
        bind:this={inputs[i]}
        use:mountFocus={i}
        class="sv-otp__cell"
        type={mask ? 'password' : 'text'}
        inputmode={numeric ? 'numeric' : 'text'}
        autocomplete={i === 0 ? 'one-time-code' : 'off'}
        maxlength="1"
        value={cell}
        {disabled}
        aria-label={`Character ${i + 1} of ${length}`}
        oninput={(e) => onCellInput(i, e)}
        onkeydown={(e) => onCellKeydown(i, e)}
        onpaste={(e) => onPaste(i, e)}
        onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
      />
    {/each}
    {#if name}<input type="hidden" {name} value={value} />{/if}
  </div>
</SvField>

<style>
  .sv-otp { --_accent: var(--sg-accent, #2563eb); display: inline-flex; gap: 8px; }
  .sv-otp.is-disabled { opacity: 0.6; }
  .sv-otp__cell {
    width: 40px; height: 46px; text-align: center; font: inherit; font-weight: 650; font-size: 18px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    outline: none; caret-color: var(--_accent);
  }
  .sv-otp--sm .sv-otp__cell { width: 34px; height: 40px; font-size: 16px; }
  .sv-otp--lg .sv-otp__cell { width: 46px; height: 54px; font-size: 20px; }
  .sv-otp__cell:focus { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-otp.is-invalid .sv-otp__cell { border-color: var(--sg-danger, #dc2626); }
</style>
