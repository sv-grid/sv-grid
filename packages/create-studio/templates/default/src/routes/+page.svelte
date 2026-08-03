<script lang="ts">
  const entities = [
    { href: '/customers', label: 'Customers', desc: 'Tiers, MRR, and status. Sort, filter, edit inline in a modal.' },
    { href: '/orders', label: 'Orders', desc: 'Linked to a customer via a searchable lookup field.' },
    { href: '/products', label: 'Products', desc: 'SKU, category, price, and stock. A standalone catalog screen.' },
  ]
</script>

<h1 class="st__title">Welcome to your data app</h1>
<p class="st__sub">
  Built with SvGrid Studio. Each screen is driven by one <code>EntitySchema</code>.
  It runs on seeded in-memory data - point an entity at a real database, or add one with
  <code>npx @svgrid/studio add &lt;table&gt; --db postgres --url ...</code>
</p>

<div class="home">
  {#each entities as e (e.href)}
    <a class="home__card" href={e.href}>
      <strong>{e.label}</strong>
      <span>{e.desc}</span>
    </a>
  {/each}
</div>
