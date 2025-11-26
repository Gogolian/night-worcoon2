<script>
  import Button from '../atoms/Button.svelte';
  import RuleCard from '../molecules/RuleCard.svelte';

  export let rules = [];
  export let onAddRule;
  export let onRemoveRule;
  export let onUpdateMethod;
  export let onUpdateUrl;
  export let onUpdateAction;
</script>

<div class="rules-container">
  {#each rules as rule, index}
    <RuleCard
      {rule}
      {index}
      onRemove={onRemoveRule}
      onMethodChange={onUpdateMethod}
      onUrlChange={onUpdateUrl}
      onActionChange={onUpdateAction}
    />
  {/each}

  <Button on:click={onAddRule}>+ Add Rule</Button>
</div>

<style>
  .rules-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
