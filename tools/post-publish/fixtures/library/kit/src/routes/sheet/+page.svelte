<script lang="ts">
  import { SvSheet } from '@svgrid/enterprise'

  const budget: string[][] = [
    ['Line', 'Jan', 'Feb', 'Mar', 'Q1'],
    ['Rent', '2400', '2400', '2400', '=SUM(B2:D2)'],
    ['Payroll', '18500', '18500', '19200', '=SUM(B3:D3)'],
    ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)', '=SUM(D2:D3)', '=SUM(E2:E3)'],
  ]
</script>

<h1>sheet</h1>
<SvSheet data={[{ name: 'Budget', cells: budget }]} rows={12} columns={6} />
