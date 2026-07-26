<script lang="ts">
  import EntityScreen from '$lib/EntityScreen.svelte'
  import { productSchema } from '$lib/schemas'
  import { productsSource, nextId } from '$lib/data'
</script>

<h1 class="st__title">Products</h1>
<EntityScreen schema={productSchema} source={productsSource} newId={() => nextId('p')} />
