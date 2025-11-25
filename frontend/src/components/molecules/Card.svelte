<script>
  export let title = '';
  export let noPadding = false;
</script>

<div class="card-molecule">
  {#if title}
    <div class="card-header">
      <h2>{title}</h2>
    </div>
  {/if}
  <div class="card-content" class:no-padding={noPadding}>
    <slot />
  </div>
</div>

<style>
  .card-molecule {
    background: #12192b;
    border: 2px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .card-header {
    background-color: #1a2847;
    border-bottom: 1px solid #0f1535;
  }

  .card-header h2 {
    color: #93c5fd;
    margin: 0;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .card-content {
    padding: 8px;
  }

  .card-content.no-padding {
    padding: 0;
  }
</style>
