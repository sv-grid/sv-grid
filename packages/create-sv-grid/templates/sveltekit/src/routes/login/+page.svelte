<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="login">
  <h1>Sign in</h1>

  <form method="POST" use:enhance>
    <input type="hidden" name="redirectTo" value={data.redirectTo} />

    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />

    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />

    {#if form?.error}
      <!-- Announced, so a screen reader hears the failure rather than only
           seeing the field reset. -->
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <button type="submit">Sign in</button>
  </form>

  <p class="hint">
    Demo users: <code>admin@example.com</code> (admin) and
    <code>viewer@example.com</code> (viewer). Password <code>password</code> for both.
  </p>
</main>

<style>
  .login { max-width: 22rem; margin: 4rem auto; padding: 0 1rem; }
  form { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 1.5rem; }
  label { font-weight: 600; font-size: 0.875rem; }
  input {
    padding: 0.5rem 0.6rem; font: inherit;
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 8px);
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  input + label { margin-top: 0.75rem; }
  button {
    margin-top: 1.25rem; padding: 0.55rem 0.9rem; font: inherit; font-weight: 600;
    color: #fff; background: var(--sg-accent, #2563eb);
    border: 0; border-radius: var(--sg-radius, 8px); cursor: pointer;
  }
  .error { margin: 0.75rem 0 0; color: var(--sg-danger, #dc2626); font-size: 0.875rem; }
  .hint { margin-top: 2rem; font-size: 0.8125rem; color: var(--sg-muted, #64748b); line-height: 1.6; }
  code { font-size: 0.9em; }
</style>
