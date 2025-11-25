<script>
  export let id = '';
  export let checked = false;
  export let disabled = false;
</script>

<label class="checkbox-container" class:disabled>
  <input
    {id}
    type="checkbox"
    bind:checked
    {disabled}
    on:change
    class="checkbox-atom"
  />
  <span class="checkmark" class:checked></span>
</label>

<style>
  .checkbox-container {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkbox-container.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .checkbox-atom {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  .checkbox-atom:disabled {
    cursor: not-allowed;
  }

  .checkmark {
    position: relative;
    top: 0;
    left: 0;
    width: 25px;
    height: 25px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .checkbox-container:hover .checkmark {
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }

  .checkmark.checked {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
    transform: scale(1.05);
  }

  .checkmark::after {
    content: '';
    position: absolute;
    display: none;
    left: 8px;
    top: 3px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .checkmark.checked::after {
    display: block;
    animation: checkmark-pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes checkmark-pop {
    0% {
      transform: rotate(45deg) scale(0);
    }
    50% {
      transform: rotate(45deg) scale(1.2);
    }
    100% {
      transform: rotate(45deg) scale(1);
    }
  }
</style>
