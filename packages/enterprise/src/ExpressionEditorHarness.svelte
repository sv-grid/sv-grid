<script lang="ts">
  /**
   * Test-only harness for `SvExpressionEditor`.
   *
   * Runes cannot live in a `.ts` test file, and the behaviour under test is
   * specifically "a parent reassigns `value`" - so the parent has to be a real
   * component. This is also the shape of the real thing: a preset button, or a
   * saved filter being loaded, replacing the expression from outside.
   */
  import SvExpressionEditor from './SvExpressionEditor.svelte'
  import type { ExprColumn } from './expressions/expression-columns'
  import type { PredicateExpr } from './expressions/expression-types'

  type Props = {
    columns: ReadonlyArray<ExprColumn>
    initial: PredicateExpr
    /** Applied to `value` when the "preset" button is clicked. */
    preset: PredicateExpr
    onChange?: (v: PredicateExpr) => void
  }

  let { columns, initial, preset, onChange }: Props = $props()

  let value = $state<PredicateExpr>(initial)
  let emissions = $state(0)

  export function currentValue(): PredicateExpr {
    return value
  }
  export function emissionCount(): number {
    return emissions
  }
</script>

<button type="button" data-testid="apply-preset" onclick={() => (value = preset)}>
  preset
</button>
<span data-testid="emissions">{emissions}</span>

<SvExpressionEditor
  {columns}
  bind:value
  onChange={(v) => {
    emissions += 1
    onChange?.(v)
  }}
/>
