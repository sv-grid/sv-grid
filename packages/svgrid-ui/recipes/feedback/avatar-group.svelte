<script lang="ts">
  // SvAvatarGroup - overlapping avatars with a "+N" overflow pill. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-avatar-group
  import { SvAvatarGroup } from '@svgrid/grid'
</script>

<SvAvatarGroup max={3} avatars={[
  { name: 'Ada Lovelace' },
  { name: 'Alan Turing' },
  { name: 'Grace Hopper' },
  { name: 'Ken Thompson' },
]} />
