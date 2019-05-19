<script>
  export let items;

  $: cartTotal = items.reduce((sum, curValue) => {
    return sum + curValue.price;
  }, 0);
</script>

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 1rem;
  }

  li {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border: 1px solid #ccc;
  }

  h1 {
    font-size: 1.5rem;
    margin: 1rem;
  }
</style>

{#if items.length === 0}
  <p>No items in cart yet.</p>
{:else}
  <ul>
    {#each items as item}
      <li>{item.title} - {item.price}</li>
    {/each}
  </ul>
{/if}

<h1>Total: ${cartTotal}</h1>
