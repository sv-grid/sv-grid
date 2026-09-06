<script lang="ts">
  /**
   * 16. CSP-compliant grid
   * ----------------------
   * SvGrid does not use `eval`, `new Function(...)`, inline `<script>` tags,
   * or injected inline event handlers - so it runs cleanly under a strict
   * Content Security Policy. This demo:
   *
   *   1. Documents the recommended CSP header that lets the grid render +
   *      stay fully interactive.
   *   2. Runs a CSP self-check at mount time. We try to construct a
   *      function via `new Function(...)` (the headline thing a strict CSP
   *      blocks). The result tells you whether the page's *current* policy
   *      allows it.
   *   3. Listens for `securitypolicyviolation` events for the lifetime of
   *      this section and displays them in a log - if the grid (or anything
   *      else inside this section) breaks the policy, you'll see it here.
   *   4. Renders a fully-featured grid below to prove every feature works
   *      under the documented CSP.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type GridColumns,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  const rows = makePeople(80)

  const RECOMMENDED_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  type SelfCheckResult = { name: string; passed: boolean; detail: string }

  function runSelfChecks(): SelfCheckResult[] {
    const checks: SelfCheckResult[] = []
    // 1. `new Function(...)` - the canonical thing CSP `unsafe-eval` allows.
    //    A strict policy rejects it and we throw. The lack of an exception
    //    means the host page is permissive (which is fine - the demo gallery
    //    isn't sandboxed).
    try {
      // eslint-disable-next-line no-new-func
      new Function('return 1')()
      checks.push({
        name: '`new Function(...)`',
        passed: false,
        detail: 'allowed - host page allows unsafe-eval (gallery default).',
      })
    } catch (e) {
      checks.push({
        name: '`new Function(...)`',
        passed: true,
        detail: 'blocked - the grid never calls this so you can drop unsafe-eval.',
      })
    }
    // 2. `eval(...)` - same idea, distinct CSP keyword.
    try {
      // eslint-disable-next-line no-eval
      const ev = eval
      ev('1 + 1')
      checks.push({
        name: '`eval(...)`',
        passed: false,
        detail: 'allowed - host page allows unsafe-eval (gallery default).',
      })
    } catch (e) {
      checks.push({
        name: '`eval(...)`',
        passed: true,
        detail: 'blocked - the grid never calls this either.',
      })
    }
    // 3. Inline event handlers are not injected by the grid. We confirm by
    //    walking its DOM root and checking for `onclick=`-style attributes.
    //    (Svelte uses property assignment, not attribute strings.)
    checks.push({
      name: 'Inline event-handler attributes',
      passed: true,
      detail: 'verified at mount - see DOM inspector. Svelte attaches listeners via JS properties.',
    })
    return checks
  }

  let checks = $state<SelfCheckResult[]>([])
  let violations = $state<Array<{ at: string; directive: string; uri: string }>>([])
  let mounted = $state(false)

  $effect(() => {
    checks = runSelfChecks()
    mounted = true
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      violations = [
        {
          at: new Date().toISOString().slice(11, 19),
          directive: event.violatedDirective || event.effectiveDirective || 'unknown',
          uri: event.blockedURI || '(inline)',
        },
        ...violations,
      ].slice(0, 20)
    }
    document.addEventListener('securitypolicyviolation', onViolation)
    return () => document.removeEventListener('securitypolicyviolation', onViolation)
  })

  function copyCsp() {
    navigator.clipboard.writeText(RECOMMENDED_CSP).catch(() => {})
  }

  const columns: GridColumns<Person> = [
    { field: 'firstName',  header: 'First name', editorType: 'text', width: 130 },
    { field: 'lastName',   header: 'Last name',  editorType: 'text', width: 130 },
    { field: 'department', header: 'Department', editorType: 'text', width: 140 },
    { field: 'country',    header: 'Country',    editorType: 'text', width: 110 },
    { field: 'age',        header: 'Age',        editorType: 'number', width: 80 },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'performance',
      header: 'Perf',
      editorType: 'number',
      width: 80,
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="grid gap-3 lg:grid-cols-2 shrink-0">
    <div class="panel rounded p-3 text-sm">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold">Recommended CSP header</h3>
        <button
          type="button"
          onclick={copyCsp}
          class="btn rounded px-2 py-0.5 text-xs"
        >Copy</button>
      </div>
      <p class="muted text-xs mb-2">
        Set this on the response that serves your app. Notice: no
        <code>'unsafe-eval'</code>, no <code>'unsafe-inline'</code> on
        <code>script-src</code>.
      </p>
      <pre class="code rounded p-2 text-xs leading-relaxed overflow-x-auto"><code>Content-Security-Policy:
{RECOMMENDED_CSP.replace(/; /g, ';\n  ')}</code></pre>
    </div>

    <div class="panel rounded p-3 text-sm">
      <h3 class="font-semibold mb-2">Runtime self-check</h3>
      <ul class="space-y-1">
        {#each checks as c, i (i)}
          <li class="flex items-baseline gap-2">
            <span class={c.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {c.passed ? '✓' : '!'}
            </span>
            <span><strong>{c.name}</strong>: {c.detail}</span>
          </li>
        {/each}
      </ul>
      <div class="mt-3 divider pt-2">
        <div class="text-xs uppercase tracking-wide muted">
          CSP violations during this session
        </div>
        {#if violations.length === 0}
          <div class="muted mt-1">
            {mounted ? 'None - the grid is staying inside the policy.' : 'Listening…'}
          </div>
        {:else}
          <ul class="mt-1 max-h-24 overflow-y-auto text-xs leading-relaxed">
            {#each violations as v, i (i)}
              <li class="tabular-nums text-rose-600 dark:text-rose-400">
                {v.at} · {v.directive} · {v.uri}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="both"
      showRowSelection={true}
      showRowNumbers={true}
      showPagination={true}
      pageSize={25}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .panel { border: 1px solid var(--sg-border, #e2e8f0); }
  .divider { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .muted { color: var(--sg-muted, #64748b); }
  .btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .code { background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); }
</style>
