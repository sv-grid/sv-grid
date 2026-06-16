<script lang="ts">
  const channels = [
    {
      title: 'Sales & Enterprise Support',
      blurb: 'Pricing questions, Enterprise + Support trials, volume / team licensing.',
      cta: 'sales@jqwidgets.com',
      href: 'mailto:sales@jqwidgets.com',
    },
    {
      title: 'Technical support',
      blurb: 'Already a Enterprise + Support customer? Reach the engineering team directly.',
      cta: 'support@jqwidgets.com',
      href: 'mailto:support@jqwidgets.com',
    },
    {
      title: 'Bug reports & feature requests',
      blurb: 'Public tracker for everyone - Community and Enterprise alike.',
      cta: 'github.com/sv-grid/sv-grid/issues',
      href: 'https://github.com/sv-grid/sv-grid/issues',
    },
    {
      title: 'Discussions',
      blurb: 'Questions, design proposals, show-and-tell.',
      cta: 'github.com/sv-grid/sv-grid/discussions',
      href: 'https://github.com/sv-grid/sv-grid/discussions',
    },
  ]
</script>

<section class="mx-auto max-w-4xl px-6 py-12">
  <header class="mb-10 text-center">
    <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--site-accent-2);">
      Contact
    </p>
    <h1 class="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight" style="color: var(--sg-fg);">
      Get in touch
    </h1>
    <p class="mt-4 max-w-2xl mx-auto text-base" style="color: var(--site-muted);">
      Pick the channel that fits your question. We read every message.
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-2">
    {#each channels as c}
      <a
        href={c.href}
        target={c.href.startsWith('http') ? '_blank' : null}
        rel={c.href.startsWith('http') ? 'noopener noreferrer' : null}
        class="rounded-lg border p-5 transition-colors"
        style="border-color: var(--sg-border); background: var(--sg-header-bg); color: var(--sg-fg); text-decoration: none;"
      >
        <h2 class="text-lg font-semibold">{c.title}</h2>
        <p class="mt-2 text-sm" style="color: var(--site-muted);">{c.blurb}</p>
        <p class="mt-3 font-mono text-sm" style="color: var(--site-accent-2);">{c.cta}</p>
      </a>
    {/each}
  </div>

  <div class="mt-10 rounded-lg border p-6" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <h2 class="text-lg font-bold" style="color: var(--sg-fg);">Company</h2>
    <p class="mt-2 text-sm" style="color: var(--site-muted);">
      jQWidgets - the team behind <a class="underline" style="color: var(--site-accent-2);" href="https://www.jqwidgets.com" target="_blank" rel="noopener noreferrer">jqwidgets.com</a>
      and <a class="underline" style="color: var(--site-accent-2);" href="https://www.htmlelements.com" target="_blank" rel="noopener noreferrer">htmlelements.com</a>.
      Press & partnership inquiries: <a class="underline" style="color: var(--site-accent-2);" href="mailto:sales@jqwidgets.com">sales@jqwidgets.com</a>.
    </p>
  </div>
</section>
