<script lang="ts">
  /**
   * SvSwitchButton - a production settings panel: a list of labelled switches
   * with descriptions, on/off track labels and a disabled row. Copy-paste ready.
   */
  import { SvSwitchButton } from '@svgrid/grid'

  let settings = $state({ notifications: true, marketing: false, twoFactor: true, beta: false })
</script>

<div class="wrap">
  <header>
    <h2>Switch</h2>
    <p>An instant on/off control (ARIA <code>switch</code>) - the standard for settings and preferences.</p>
  </header>

  <div class="panel">
    <div class="row">
      <div class="txt"><strong>Push notifications</strong><span>Alerts on your devices</span></div>
      <SvSwitchButton checked={settings.notifications} onChange={(v) => (settings.notifications = v)} />
    </div>
    <div class="row">
      <div class="txt"><strong>Marketing emails</strong><span>Product news and offers</span></div>
      <SvSwitchButton checked={settings.marketing} onChange={(v) => (settings.marketing = v)} />
    </div>
    <div class="row">
      <div class="txt"><strong>Two-factor auth</strong><span>Extra login security</span></div>
      <SvSwitchButton checked={settings.twoFactor} onLabel="ON" offLabel="OFF" onChange={(v) => (settings.twoFactor = v)} />
    </div>
    <div class="row is-disabled">
      <div class="txt"><strong>Beta features</strong><span>Requires an admin invite</span></div>
      <SvSwitchButton checked={settings.beta} disabled onChange={(v) => (settings.beta = v)} />
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 480px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .panel { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; overflow: hidden; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; }
  .row + .row { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .row.is-disabled { opacity: 0.6; }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  .txt strong { font-size: 13.5px; }
  .txt span { font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
