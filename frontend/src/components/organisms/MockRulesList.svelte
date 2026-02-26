<script>
  import Button from '../atoms/Button.svelte';
  import RuleCard from '../molecules/RuleCard.svelte';

  export let rules = [];
  export let onAddRule;
  export let onRemoveRule;
  export let onUpdateMethod;
  export let onUpdateUrl;
  export let onUpdateAction;
  export let onUpdateInlineResponse;
</script>

<div class="rules-container">
  {#each rules as rule, index (rule)}
    <RuleCard
      {rule}
      {index}
      onRemove={onRemoveRule}
      onMethodChange={onUpdateMethod}
      onUrlChange={onUpdateUrl}
      onActionChange={onUpdateAction}
      onInlineResponseChange={onUpdateInlineResponse}
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
