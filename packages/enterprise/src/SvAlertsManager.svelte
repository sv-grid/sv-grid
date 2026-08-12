<script lang="ts">
  /**
   * SvAlertsManager - the rule list. Enable/disable, edit, delete, create, and
   * share (export/import JSON) alert rules. Editing opens SvAlertRuleEditor.
   * Operates through an AlertRulesManager (persistence) and emits the updated
   * list so the running engine can re-sync.
   */
  import { SvModal, SvSwitchButton, toast } from '@svgrid/grid'
  import SvAlertRuleEditor from './SvAlertRuleEditor.svelte'
  import { stringifyPredicate } from './expressions/parse'
  import type { ExprColumn } from './expressions/expression-columns'
  import type { AlertRulesManager } from './alerts/alert-storage'
  import type { AlertRule, AlertSeverity } from './alerts/alert-types'

  type Props = {
    open?: boolean
    manager: AlertRulesManager
    columns: ReadonlyArray<ExprColumn>
    rows?: ReadonlyArray<Record<string, unknown>>
    onChange?: (rules: AlertRule[]) => void
    onClose?: () => void
  }

  let { open = $bindable(false), manager, columns, rows = [], onChange, onClose }: Props = $props()

  let rules = $state<AlertRule[]>(manager.list())
  let editing = $state<AlertRule | null>(null)
  let editorOpen = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  // Re-read the persisted list whenever the manager modal opens.
  let wasOpen = $state(false)
  $effect(() => {
    if (open && !wasOpen) rules = manager.list()
    wasOpen = open
  })

  const SEV_COLOR: Record<AlertSeverity, string> = {
    info: '#3b82f6', success: '#16a34a', warning: '#d97706', error: '#dc2626',
  }
  const SEV_LABEL: Record<AlertSeverity, string> = {
    info: 'Info', success: 'Success', warning: 'Warning', error: 'Critical',
  }

  function sync() {
    rules = manager.list()
    onChange?.(rules)
  }

  function newRule() {
    editing = null
    editorOpen = true
  }
  function editRule(rule: AlertRule) {
    editing = rule
    editorOpen = true
  }
  function onSaved(rule: AlertRule) {
    manager.save(rule)
    sync()
  }
  function toggle(rule: AlertRule) {
    manager.toggle(rule.id)
    sync()
  }
  function remove(rule: AlertRule) {
    manager.remove(rule.id)
    sync()
  }

  function exportRules() {
    const json = manager.export()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'alert-rules.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported alert rules')
  }
  function importRules(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        manager.import(String(reader.result))
        sync()
        toast.success('Imported alert rules')
      } catch {
        toast.error('Could not import - invalid file')
      }
    }
    reader.readAsText(file)
  }

  function triggerText(rule: AlertRule): string {
    switch (rule.trigger.type) {
      case 'relativeChange': return 'on movement'
      case 'validation': return 'on edit'
      case 'scheduled': return 'scheduled'
      default: return 'on match'
    }
  }
</script>

<SvModal bind:open size="lg" title="Alert rules" onClose={() => onClose?.()}>
  <div class="am-body">
    {#if rules.length === 0}
      <div class="am-empty">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <p class="am-empty-title">No alert rules yet</p>
        <p class="am-empty-sub">Create one to get a toast, a highlight, or a flash the moment your data crosses a line.</p>
        <button type="button" class="am-btn am-primary" onclick={newRule}>+ New alert</button>
      </div>
    {:else}
      <ul class="am-list">
        {#each rules as rule (rule.id)}
          <li class="am-item" class:am-off={!rule.enabled} style={`--sev: ${SEV_COLOR[rule.severity]}`}>
            <span class="am-strip" aria-hidden="true"></span>
            <SvSwitchButton checked={rule.enabled} onChange={() => toggle(rule)} ariaLabel={`Enable ${rule.name}`} />
            <button type="button" class="am-main" onclick={() => editRule(rule)}>
              <div class="am-title">
                <span class="am-name">{rule.name}</span>
                <span class="am-sev">{SEV_LABEL[rule.severity]}</span>
                <span class="am-trigger">{triggerText(rule)}</span>
              </div>
              <code class="am-expr">{stringifyPredicate(rule.predicate, columns)}</code>
            </button>
            <div class="am-tools">
              <button type="button" class="am-icon" onclick={() => editRule(rule)} aria-label={`Edit ${rule.name}`} title="Edit">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button type="button" class="am-icon am-danger" onclick={() => remove(rule)} aria-label={`Delete ${rule.name}`} title="Delete">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#snippet footer()}
    <div class="am-footer">
      <div class="am-share">
        <button type="button" class="am-btn am-ghost" onclick={exportRules}>Export</button>
        <button type="button" class="am-btn am-ghost" onclick={() => fileInput?.click()}>Import</button>
        <input bind:this={fileInput} type="file" accept="application/json" hidden onchange={importRules} />
      </div>
      <button type="button" class="am-btn am-primary" onclick={newRule}>+ New alert</button>
    </div>
  {/snippet}
</SvModal>

<SvAlertRuleEditor bind:open={editorOpen} {columns} rule={editing} {rows} onSave={onSaved} />

<style>
  /* Theme-agnostic surfaces: currentColor + inherit (readable in any theme). */
  .am-body { min-width: 540px; max-width: 640px; max-height: 60vh; overflow: auto; font-family: var(--sg-font, inherit); color: inherit; }

  .am-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 24px; text-align: center; }
  .am-empty svg { color: var(--sg-accent, #4f46e5); opacity: 0.75; margin-bottom: 4px; }
  .am-empty-title { margin: 0; font-size: 15px; font-weight: 600; }
  .am-empty-sub { margin: 0 0 8px; font-size: 13px; max-width: 34ch; line-height: 1.5; opacity: 0.65; }

  .am-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .am-item {
    position: relative; display: grid; grid-template-columns: auto auto 1fr auto; gap: 12px; align-items: center;
    padding: 11px 12px 11px 16px;
    background: color-mix(in srgb, currentColor 3%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 11px; overflow: hidden;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .am-item:hover { border-color: color-mix(in srgb, var(--sev) 55%, transparent); box-shadow: 0 4px 14px -8px color-mix(in srgb, var(--sev) 60%, transparent); }
  .am-item.am-off { opacity: 0.55; }
  .am-strip { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--sev); }

  .am-main { flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; color: inherit; }
  .am-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .am-name { font-weight: 600; font-size: 14px; }
  .am-sev {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
    color: var(--sev); background: color-mix(in srgb, var(--sev) 16%, transparent);
    padding: 2px 7px; border-radius: 999px;
  }
  .am-trigger { font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.04em; }
  .am-expr { display: block; font-size: 12px; opacity: 0.7; margin-top: 4px; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

  .am-tools { display: flex; gap: 4px; }
  .am-icon {
    display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
    border: 1px solid transparent; background: transparent; border-radius: 8px; cursor: pointer;
    color: inherit; opacity: 0.6; transition: background 0.13s ease, opacity 0.13s ease, border-color 0.13s ease, color 0.13s ease;
  }
  .am-icon:hover { background: color-mix(in srgb, currentColor 10%, transparent); opacity: 1; border-color: color-mix(in srgb, currentColor 15%, transparent); }
  .am-icon.am-danger:hover { color: var(--sg-danger, #dc2626); opacity: 1; background: color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent); border-color: color-mix(in srgb, var(--sg-danger, #dc2626) 35%, transparent); }

  .am-footer { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .am-share { display: flex; gap: 6px; }
  .am-btn { border-radius: 8px; padding: 7px 15px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: background 0.14s ease, border-color 0.14s ease, filter 0.14s ease; }
  .am-ghost { background: color-mix(in srgb, currentColor 5%, transparent); border-color: color-mix(in srgb, currentColor 22%, transparent); color: inherit; }
  .am-ghost:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
  .am-primary { background: var(--sg-accent, #4f46e5); color: #fff; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
  .am-primary:hover { filter: brightness(1.08); }
</style>
