<script>
  import Card from './Card.svelte';

  export let title;
</script>

<div class="plugin-section">
  <h2>{title}</h2>
  <Card>
    <slot />
  </Card>
</div>

<style>
  .plugin-section {
    margin-bottom: 20px;
  }

  .plugin-section h2 {
    font-size: 16px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0 0 12px 0;
  }
</style>
