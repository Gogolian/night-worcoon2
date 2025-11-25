<script>
  export let children = null;
  import logo from '../../assets/nwcm.png';
</script>

<main class="main-content">
  <div class="content-wrapper">
    <img src={logo} alt="Night Worcoon" class="floating-logo" />
    <slot />
  </div>
</main>

<style>
  .main-content {
    flex: 1;
    overflow-y: auto;
    height: calc(100vh - 44px);
    background-color: #0a0e27;
    z-index: 0;
  }

  .content-wrapper {
    margin: 0 auto;
    padding: 12px 16px;
    z-index: 0;
  }
  
  .floating-logo {
    position: fixed;
    bottom: 5vh;
    right: 5vw;
    height: 40%;
    width: auto;
    z-index: 0;
    object-fit: contain;
    opacity: 0.1;
    transition: opacity 10s ease-in-out;
    -webkit-filter: drop-shadow(0 0 10px  rgba(217,46,255,0.8));
         filter: drop-shadow(0 0 10px  rgba(217,46,255,0.8));
  }

  .floating-logo:hover {
    opacity: 1;
  }
</style>
