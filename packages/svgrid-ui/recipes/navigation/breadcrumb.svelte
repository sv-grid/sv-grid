<script lang="ts">
  // SvBreadcrumb - a navigation trail to the current page. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-breadcrumb
  import { SvBreadcrumb } from '@svgrid/grid'

  const items = [
    { label: 'Home', href: '/' },
    { label: 'Orders', href: '/orders' },
    { label: '#1024' },
  ]
</script>

<SvBreadcrumb {items} separator="›" maxItems={4} />
