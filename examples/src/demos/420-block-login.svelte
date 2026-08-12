<script lang="ts">
  /**
   * Login block - a copy-paste authentication page built entirely from the
   * SvGrid UI kit (shadcn "blocks"-style). A two-column split: a branded panel
   * on the left, the sign-in card on the right. SvTextInput + SvPasswordInput
   * (with reveal), SvCheckBox remember-me, SvButton social providers + submit,
   * SvDivider "or" separator. Themed from the --sg-* tokens.
   */
  import {
    SvCard, SvTextInput, SvPasswordInput, SvCheckBox, SvButton, SvDivider,
    SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  let email = $state('ada@northwind.io')
  let password = $state('')
  let remember = $state(true)
  let busy = $state(false)

  function signIn(e: Event) {
    e.preventDefault()
    busy = true
    toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
      loading: 'Signing in...',
      success: () => { busy = false; return 'Welcome back, Ada' },
      error: () => { busy = false; return 'Sign-in failed' },
    })
  }
</script>

<div class="page">
  <!-- Brand panel -->
  <aside class="brand">
    <div class="brand-top">
      <span class="logo">◧</span>
      <strong>Northwind</strong>
    </div>
    <div class="brand-mid">
      <SvBadge variant="accent" pill>Analytics Cloud</SvBadge>
      <h1>Sign in to your workspace.</h1>
      <p>Dashboards, pipelines and reports for the whole team - in one place.</p>
    </div>
    <blockquote class="quote">
      "We replaced three internal tools with Northwind in a weekend."
      <cite>- Grace H., Head of Data</cite>
    </blockquote>
  </aside>

  <!-- Form panel -->
  <main class="form-wrap">
    <SvCard>
      <div class="head">
        <h2>Welcome back</h2>
        <p class="muted">Enter your credentials to access your account.</p>
      </div>

      <div class="social">
        <SvButton variant="outline" block>{@render provider('G', 'Continue with Google')}</SvButton>
        <SvButton variant="outline" block>{@render provider('', 'Continue with GitHub')}</SvButton>
      </div>

      <SvDivider label="or" />

      <form onsubmit={signIn} class="fields">
        <SvTextInput label="Email" type="email" bind:value={email} block required>
          {#snippet leading()}<span class="ic">✉</span>{/snippet}
        </SvTextInput>

        <div>
          <div class="pw-label">
            <span>Password</span>
            <button type="button" class="link" onclick={() => toast('Reset link sent')}>Forgot?</button>
          </div>
          <SvPasswordInput bind:value={password} block required>
            {#snippet leading()}<span class="ic">🔒</span>{/snippet}
          </SvPasswordInput>
        </div>

        <SvCheckBox checked={remember} onChange={(v) => (remember = v)}>Remember me for 30 days</SvCheckBox>

        <SvButton type="submit" variant="primary" block loading={busy}>Sign in</SvButton>
      </form>

      {#snippet footer()}
        <p class="foot">No account? <button class="link" onclick={() => toast('Opening sign-up')}>Create one</button></p>
      {/snippet}
    </SvCard>
    <p class="legal">By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
  </main>
</div>

{#snippet provider(mark: string, label: string)}
  <span class="prov"><span class="prov-mark">{mark || '⌘'}</span>{label}</span>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .page {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    min-height: 560px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #eef2f7);
    border-radius: 14px;
    overflow: hidden;
  }
  .brand {
    display: flex; flex-direction: column; justify-content: space-between;
    gap: 28px; padding: 32px;
    color: #fff;
    background:
      radial-gradient(120% 120% at 0% 0%, #6366f1 0%, #4338ca 45%, #1e1b4b 100%);
  }
  .brand-top { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; }
  .logo { font-size: 22px; }
  .brand-mid h1 { font-size: 30px; line-height: 1.15; margin: 14px 0 10px; letter-spacing: -.02em; }
  .brand-mid p { margin: 0; opacity: .82; max-width: 34ch; line-height: 1.5; }
  .quote { margin: 0; font-size: 14px; line-height: 1.55; opacity: .9; border-left: 3px solid rgba(255,255,255,.4); padding-left: 14px; }
  .quote cite { display: block; margin-top: 8px; font-style: normal; opacity: .7; font-size: 12.5px; }

  .form-wrap { display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 32px; max-width: 420px; margin: 0 auto; width: 100%; }
  .head h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: -.01em; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .social { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .prov { display: inline-flex; align-items: center; gap: 8px; }
  .prov-mark { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; font-weight: 700; }
  .fields { display: flex; flex-direction: column; gap: 14px; }
  .pw-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; font-weight: 500; margin-bottom: 5px; }
  .link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; font-size: 12.5px; }
  .link:hover { text-decoration: underline; }
  .foot { margin: 0; text-align: center; font-size: 13px; color: var(--sg-muted, #64748b); }
  .legal { text-align: center; font-size: 11.5px; color: var(--sg-muted, #94a3b8); margin: 0; }
  .legal a { color: inherit; text-decoration: underline; }
  .ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 720px) {
    .page { grid-template-columns: 1fr; }
    .brand { display: none; }
  }
</style>
