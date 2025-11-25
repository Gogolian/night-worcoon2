<script>
  export let children = null;
</script>

<main class="main-content">
  <div class="content-wrapper">
    <slot />
  </div>
</main>

<style>
  .main-content {
    flex: 1;
    overflow-y: auto;
    height: calc(100vh - 44px);
    background-color: #0a0e27;
  }

  .content-wrapper {
    max-width: 1400px;
    margin: 0 auto;
    padding: 12px 16px;
  }
</style>
