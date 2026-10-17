<script lang="ts" module>
  /**
   * Progress checklist block - a getting-started card for a new account. An
   * SvProgress bar counts done tasks; each task is an SvCollapsible with a
   * description and an SvButton that completes it (one open at a time, the
   * next open task opens on its own). Done tasks are struck through with a
   * check; at 100% the card turns into an all-done state that can be
   * dismissed. SvBadge, SvToaster + toast for feedback.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createChecklist() below owns the task list, which task is open,
   * the complete flow, progress and the dismissed flag with no markup. The
   * component under it is one styled render of that core; import
   * createChecklist from this file (or `npx @svgrid/ui add
   * onboarding-checklist --headless` for the core alone) to draw your own.
   */
  export type ChecklistTask = { id: string; title: string; text: string; action: string; minutes: number; done: boolean }
  export type ChecklistOptions = {
    tasks?: ChecklistTask[]
    /** Ids already completed; load them from your server. */
    done?: string[]
    /** Does the task's work (save it, open a dialog); throw to leave it open. */
    onComplete?: (task: ChecklistTask) => Promise<void> | void
  }

  const SAMPLE_TASKS: ChecklistTask[] = [
    { id: 'account', title: 'Create your account', text: 'Signed up with ada@lumen.dev.', action: 'Done', minutes: 1, done: true },
    { id: 'source', title: 'Connect a data source', text: 'Postgres, MySQL, BigQuery or a CSV upload. Lumen reads through a read-only role.', action: 'Connect Postgres', minutes: 3, done: true },
    { id: 'dashboard', title: 'Build your first dashboard', text: 'Start from the Revenue template or a blank canvas, then pin three charts.', action: 'Open a template', minutes: 5, done: false },
    { id: 'invite', title: 'Invite a teammate', text: 'Editors can change dashboards; viewers only read them. Free on every plan.', action: 'Send invite', minutes: 1, done: false },
    { id: 'report', title: 'Schedule a weekly report', text: 'Email a PDF of any dashboard every Monday at 09:00 to a list you choose.', action: 'Schedule report', minutes: 2, done: false },
  ]

  export function createChecklist(opts: ChecklistOptions = {}) {
    const source = opts.tasks ?? SAMPLE_TASKS
    const fresh = () => source.map((t) => ({ ...t, done: t.done || !!opts.done?.includes(t.id) }))
    const firstOpen = (list: ChecklistTask[]) => list.find((t) => !t.done)?.id ?? null

    let tasks = $state(fresh())
    let openId = $state<string | null>(firstOpen(fresh()))
    let working = $state<string | null>(null)
    let dismissed = $state(false)

    const doneCount = $derived(tasks.filter((t) => t.done).length)
    const allDone = $derived(doneCount === tasks.length)
    const minutesLeft = $derived(tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0))

    async function complete(id: string) {
      const task = tasks.find((t) => t.id === id)
      if (!task || task.done || working) return
      working = id
      try {
        await opts.onComplete?.(task)
        task.done = true
        openId = firstOpen(tasks)
      } catch {
        // The caller reported the failure; the task stays open.
      } finally {
        working = null
      }
    }

    function setOpen(id: string, open: boolean) { openId = open ? id : openId === id ? null : openId }

    function reset() {
      tasks = fresh()
      openId = firstOpen(tasks)
      dismissed = false
    }

    return {
      get tasks() { return tasks },
      get openId() { return openId },
      /** Id of the task whose action is running. */
      get working() { return working },
      get dismissed() { return dismissed },
      get doneCount() { return doneCount },
      get allDone() { return allDone },
      get minutesLeft() { return minutesLeft },
      isOpen: (id: string) => openId === id,
      setOpen,
      complete,
      dismiss: () => { dismissed = true },
      restore: () => { dismissed = false },
      reset,
      /** Spread on your own disclosure button for a task. */
      triggerProps: (id: string) => ({
        type: 'button' as const,
        'aria-expanded': openId === id,
        onclick: () => setOpen(id, openId !== id),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvCollapsible, SvProgress, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const list = createChecklist({
    // Stand-in for the task's real work; post to your API here.
    onComplete: (task) =>
      new Promise<void>((res) => setTimeout(res, 700)).then(() => { toast.success(`${task.title}: done`) }),
  })
</script>

<section class="sv-checklist">
  {#if list.dismissed}
    <p class="sv-checklist-muted sv-checklist-restore">Checklist hidden. <button class="sv-checklist-link" onclick={list.restore}>Show it again</button></p>
  {:else}
    <SvCard>
      <div class="sv-checklist-head">
        <div>
          <h2>Get started with Lumen</h2>
          <p class="sv-checklist-muted">{list.allDone ? 'Everything is set up.' : `About ${list.minutesLeft} min left`}</p>
        </div>
        <button class="sv-checklist-close" aria-label="Hide checklist" onclick={list.dismiss}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="sv-checklist-progress">
        <SvProgress value={list.doneCount} max={list.tasks.length} color={list.allDone ? 'success' : 'accent'} ariaLabel="Onboarding progress" />
        <span class="sv-checklist-count">{list.doneCount} of {list.tasks.length} done</span>
      </div>

      {#if list.allDone}
        <div class="sv-checklist-all-done">
          <span class="sv-checklist-tick sv-checklist-tick-big" aria-hidden="true">✓</span>
          <div>
            <strong>You are all set</strong>
            <p class="sv-checklist-muted">Your data is connected, the team is in and the Monday report is scheduled.</p>
          </div>
          <div class="sv-checklist-done-actions">
            <SvButton variant="primary" onclick={list.dismiss}>Dismiss checklist</SvButton>
            <SvButton variant="ghost" onclick={list.reset}>Start over</SvButton>
          </div>
        </div>
      {:else}
        <div class="sv-checklist-tasks">
          {#each list.tasks as task (task.id)}
            <SvCollapsible open={list.isOpen(task.id)} onOpenChange={(o) => list.setOpen(task.id, o)}>
              {#snippet header()}
                <span class="sv-checklist-row" class:sv-checklist-is-done={task.done}>
                  <span class="sv-checklist-tick" aria-hidden="true">{task.done ? '✓' : ''}</span>
                  <span class="sv-checklist-title">{task.title}</span>
                  {#if task.done}<span class="sv-checklist-sr">(done)</span>{:else}<SvBadge variant="neutral" size="sm">{task.minutes} min</SvBadge>{/if}
                </span>
              {/snippet}
              <div class="sv-checklist-task-body">
                <p class="sv-checklist-muted">{task.text}</p>
                {#if !task.done}
                  <SvButton variant="primary" size="sm" loading={list.working === task.id} onclick={() => list.complete(task.id)}>{task.action}</SvButton>
                {/if}
              </div>
            </SvCollapsible>
          {/each}
        </div>
      {/if}
    </SvCard>
  {/if}
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-checklist { min-height: 520px; padding: 32px 24px; display: flex; justify-content: center; align-items: flex-start; box-sizing: border-box; color: var(--sg-fg, #0f172a); }
  .sv-checklist > :global(*) { width: 100%; max-width: 540px; }
  .sv-checklist-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .sv-checklist-head h2 { margin: 0 0 4px; font-size: 19px; letter-spacing: -.01em; }
  .sv-checklist-muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; line-height: 1.5; }
  .sv-checklist-close { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: var(--sg-radius, 6px); background: none; color: var(--sg-muted, #64748b); cursor: pointer; }
  .sv-checklist-close:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  .sv-checklist-close:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); }
  .sv-checklist-progress { display: flex; align-items: center; gap: 12px; margin: 16px 0 18px; }
  .sv-checklist-progress > :global(:first-child) { flex: 1; }
  .sv-checklist-count { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .sv-checklist-tasks { display: flex; flex-direction: column; gap: 8px; }
  .sv-checklist-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .sv-checklist-title { min-width: 0; overflow-wrap: anywhere; }
  .sv-checklist-row.sv-checklist-is-done .sv-checklist-title { text-decoration: line-through; color: var(--sg-muted, #64748b); font-weight: 500; }
  .sv-checklist-tick {
    flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
    font-size: 12px; font-weight: 700; border: 1.5px solid var(--sg-border, #cbd5e1);
  }
  .sv-checklist-row.sv-checklist-is-done .sv-checklist-tick, .sv-checklist-tick.sv-checklist-tick-big { border-color: transparent; color: var(--sg-success, #16a34a); background: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent); }
  .sv-checklist-tick.sv-checklist-tick-big { width: 40px; height: 40px; font-size: 18px; }
  .sv-checklist-task-body { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding-left: 30px; }
  .sv-checklist-all-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 12px 0 4px; }
  .sv-checklist-all-done strong { font-size: 16px; }
  .sv-checklist-done-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .sv-checklist-restore { text-align: center; padding-top: 40px; }
  .sv-checklist-link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sv-checklist-link:hover { text-decoration: underline; }
  .sv-checklist-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  @media (max-width: 480px) {
    .sv-checklist { padding: 16px 12px; }
    .sv-checklist-task-body { padding-left: 0; }
  }
</style>
