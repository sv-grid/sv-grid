<script lang="ts">
  const entities = [{"href":"/customers","label":"Customer"}]
</script>

<h1 class="st__title">Welcome to your data app</h1>
<p class="st__sub">
  Generated from your schema with SvGrid Studio. Each screen is driven by one
  <code>EntitySchema</code>. It runs on empty in-memory data - add rows, or point
  an entity at a real database in <code>src/lib/data.ts</code>.
</p>

<div class="home">
  {#each entities as e (e.href)}
    <a class="home__card" href={e.href}>
      <strong>{e.label}</strong>
      <span>Browse and edit {e.label} records.</span>
    </a>
  {/each}
</div>
