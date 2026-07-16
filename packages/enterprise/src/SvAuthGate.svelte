<script lang="ts">
  /**
   * SvAuthGate - require a signed-in user before showing its content. Renders a
   * login / sign-up form when signed out (Supabase Auth via `createSupabaseAuth`)
   * and its children when signed in, with a small "signed in as ... / Sign out"
   * bar. Pair with Row-Level Security so each user sees only their own rows.
   *
   *   <SvAuthGate {client}>
   *     <MyStudioScreen />
   *   </SvAuthGate>
   */
  import type { Snippet } from 'svelte'
  import { createSupabaseAuth, type AuthState, type SupabaseAuthClientLike, type SupabaseAuthController } from './sources/auth-supabase'

  type Props = {
    client: SupabaseAuthClientLike
    children: Snippet
    title?: string
    /** Show the "signed in as ... / Sign out" bar. Default true. */
    showBar?: boolean
  }

  let { client, children, title = 'Sign in', showBar = true }: Props = $props()

  let auth = $state<SupabaseAuthController | undefined>()
  let authState = $state<AuthState>({ user: null, loading: true, error: null })
  let mode = $state<'signin' | 'signup'>('signin')
  let email = $state('')
  let password = $state('')

  $effect(() => {
    const controller = createSupabaseAuth({ client, onChange: (s) => (authState = s) })
    auth = controller
    return () => controller.dispose()
  })

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (mode === 'signin') auth?.signIn(email, password)
    else auth?.signUp(email, password)
  }
</script>

{#if authState.user}
  {#if showBar}
    <div class="sv-auth-bar">
      <span>Signed in as <strong>{authState.user.email ?? authState.user.id}</strong></span>
      <button type="button" onclick={() => auth?.signOut()} disabled={authState.loading}>Sign out</button>
    </div>
  {/if}
  {@render children()}
{:else}
  <div class="sv-auth">
    <form class="sv-auth__form" onsubmit={submit}>
      <h2 class="sv-auth__title">{mode === 'signin' ? title : 'Create account'}</h2>

      <label class="sv-auth__field">
        <span>Email</span>
        <input type="email" autocomplete="email" bind:value={email} required />
      </label>
      <label class="sv-auth__field">
        <span>Password</span>
        <input type="password" autocomplete="current-password" bind:value={password} required />
      </label>

      {#if authState.error}<p class="sv-auth__error">{authState.error}</p>{/if}

      <button class="sv-auth__submit" type="submit" disabled={authState.loading}>
        {authState.loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>

      <button
        type="button"
        class="sv-auth__toggle"
        onclick={() => (mode = mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </form>
  </div>
{/if}

<style>
  .sv-auth { display: flex; justify-content: center; padding: 32px 16px; }
  .sv-auth__form {
    display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px;
    padding: 24px; border: 1px solid var(--sg-border, #e2e2e2); border-radius: 12px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, inherit);
  }
  .sv-auth__title { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  .sv-auth__field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #555); }
  .sv-auth__field input {
    padding: 8px 10px; border: 1px solid var(--sg-border, #ccc); border-radius: 6px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, inherit); font: inherit;
  }
  .sv-auth__error { margin: 0; font-size: 13px; color: #dc2626; }
  .sv-auth__submit {
    padding: 9px 12px; border: 1px solid var(--sg-accent, #2563eb); border-radius: 6px;
    background: var(--sg-accent, #2563eb); color: #fff; cursor: pointer; font: inherit; font-weight: 600;
  }
  .sv-auth__submit:disabled { opacity: 0.6; cursor: default; }
  .sv-auth__toggle { border: none; background: none; color: var(--sg-accent, #2563eb); cursor: pointer; font: inherit; font-size: 13px; }

  .sv-auth-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 8px 12px; margin-bottom: 12px; font-size: 13px;
    border: 1px solid var(--sg-border, #e2e2e2); border-radius: 8px;
    background: var(--sg-header-bg, #f8fafc); color: var(--sg-fg, inherit);
  }
  .sv-auth-bar button {
    padding: 5px 10px; border: 1px solid var(--sg-border, #ccc); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, inherit); cursor: pointer; font: inherit;
  }
  .sv-auth-bar button:disabled { opacity: 0.5; cursor: default; }
</style>
