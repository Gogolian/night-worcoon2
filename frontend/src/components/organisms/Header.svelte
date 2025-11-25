<script>
  export let currentRoute = '';
</script>

<header class="header-organism">
  <div class="header-content">
    <div class="header-left">
      <h2 class="header-title">NWC2</h2>
    </div>
    <div class="header-right">
      <nav class="header-nav">
        <slot />
      </nav>
    </div>
  </div>
</header>


<style>
  .header-organism {
    background-color: #0f1535;
    border-bottom: 1px solid #1a2847;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    margin: 0 auto;
    padding: 0 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 44px;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-title {
    font-size: 16px;
    font-weight: 700;
    color: #64b5f6;
    margin: 0;
    letter-spacing: 1px;
  }

  .header-right {
    display: flex;
    align-items: center;
  }

  .header-nav {
    display: flex;
    gap: 20px;
  }

</style>
