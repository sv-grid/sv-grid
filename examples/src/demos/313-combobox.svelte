<script lang="ts">
  /**
   * SvComboBox - a production form field: type to filter a grouped, portalled
   * list; the value must come from the list (unmatched text reverts on blur).
   * Copy-paste ready.
   */
  import { SvComboBox } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  const currencies: ListOption[] = [
    { value: 'usd', label: 'USD - US Dollar', group: 'Americas' },
    { value: 'cad', label: 'CAD - Canadian Dollar', group: 'Americas' },
    { value: 'brl', label: 'BRL - Brazilian Real', group: 'Americas' },
    { value: 'eur', label: 'EUR - Euro', group: 'Europe' },
    { value: 'gbp', label: 'GBP - British Pound', group: 'Europe' },
    { value: 'chf', label: 'CHF - Swiss Franc', group: 'Europe' },
    { value: 'jpy', label: 'JPY - Japanese Yen', group: 'Asia' },
    { value: 'sgd', label: 'SGD - Singapore Dollar', group: 'Asia' },
  ]
  let currency = $state<string | number | null>('eur')
  let account = $state<string | number | null>(null)
  const accountError = $derived(account == null ? 'Select an account' : undefined)
  const accounts: ListOption[] = [
    { value: 'op', label: 'Operating account' },
    { value: 'sv', label: 'Savings account' },
    { value: 'py', label: 'Payroll account' },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Combo box</h2>
    <p>An editable select: type to filter a grouped list, pick a value. Great for long, known option sets in forms.</p>
  </header>

  <form class="form" onsubmit={(e) => e.preventDefault()}>
    <SvComboBox options={currencies} value={currency} label="Currency" clearable onChange={(v) => (currency = v)} />
    <SvComboBox options={accounts} value={account} label="From account" required invalid={!!accountError} error={accountError} onChange={(v) => (account = v)} />
  </form>
</div>

<style>
  .wrap { padding: 20px; max-width: 380px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .form { display: flex; flex-direction: column; gap: 16px; }
</style>
