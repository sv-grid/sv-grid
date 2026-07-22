<script lang="ts">
  /**
   * SvBreadcrumb, SvPagination and SvStepper - the navigation set. Pure,
   * keyboard-accessible, theme-token driven. Pagination's page-range math lives
   * in the framework-free `paginationRange` helper.
   */
  import { SvBreadcrumb, SvPagination, SvStepper, type BreadcrumbItem, type StepItem } from '@svgrid/grid'

  const crumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '#' },
    { label: 'Reports', href: '#' },
    { label: 'Q3', href: '#' },
    { label: 'Revenue' },
  ]

  const longTrail: BreadcrumbItem[] = [
    { label: 'Root', href: '#' },
    { label: 'Region', href: '#' },
    { label: 'Country', href: '#' },
    { label: 'City', href: '#' },
    { label: 'Store #1024' },
  ]

  let page = $state(1)

  const steps: StepItem[] = [
    { label: 'Account', description: 'Your details' },
    { label: 'Shipping', description: 'Where to send it' },
    { label: 'Payment', description: 'How you pay', optional: true },
    { label: 'Review', description: 'Confirm & submit' },
  ]
  let step = $state(1)
</script>

<div class="wrap">
  <header>
    <h2>Navigation</h2>
    <p>Breadcrumb trail, pager and stepper - the wayfinding trio for admin apps and Studio-generated screens.</p>
  </header>

  <section>
    <h3>Breadcrumb</h3>
    <SvBreadcrumb items={crumbs} />
    <p class="muted">Collapses the middle on long trails (click the ellipsis to expand):</p>
    <SvBreadcrumb items={longTrail} maxItems={3} />
  </section>

  <section>
    <h3>Pagination</h3>
    <SvPagination {page} pageCount={20} onChange={(p) => (page = p)} showFirstLast />
    <p class="muted">Page {page} of 20.</p>
  </section>

  <section>
    <h3>Stepper</h3>
    <SvStepper {steps} current={step} onChange={(i) => (step = i)} />
    <div class="row">
      <button class="nav" disabled={step === 0} onclick={() => (step = Math.max(0, step - 1))}>Back</button>
      <button class="nav primary" disabled={step === steps.length - 1} onclick={() => (step = Math.min(steps.length - 1, step + 1))}>Next</button>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .row { display: flex; gap: 10px; margin-top: 16px; }
  .muted { color: var(--sg-muted, #94a3b8); font-size: 12.5px; margin: 10px 0 6px; }
  .nav { font: inherit; font-size: 13px; padding: 7px 14px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); cursor: pointer; }
  .nav.primary { background: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); }
  .nav:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
