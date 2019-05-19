<script>
  import Product from "./Product.svelte";
  import Button from "./Button.svelte";
  import Cart from "./Cart.svelte";

  let title = "";
  let price = 0;
  let description = "";

  let products = [];
  let cartItems = [];

  function setTitle(event) {
    title = event.target.value;
  }

  function createProduct() {
    const newProduct = {
      title: title,
      price: price,
      description: description
    };
    products = products.concat(newProduct);
  }

  function addToCart(event) {
    const selectedTitle = event.detail;
    cartItems = cartItems.concat({
      ...products.find(prod => prod.title === selectedTitle)
    })
  }
</script>

<style>
  section {
    width: 30rem;
    margin: auto;
  }

  label,
  input {
    width: 100%;
  }
</style>

<section>
  <Cart items={cartItems} />
</section>

<hr />

<section>
  <div>
    <label for="title">Title</label>
    <input id="title" type="text" value={title} on:input={setTitle} />
  </div>

  <div>
    <label for="price">Price</label>
    <input id="price" type="number" bind:value={price} />
  </div>

  <div>
    <label for="description">Description</label>
    <textarea id="description" rows="3" bind:value={description} />
  </div>

  <Button on:click={createProduct}>Create Product</Button>
</section>

<section>
  {#if products.length === 0}
    <p>No products were added yet!</p>
  {:else}
    {#each products as product}
      <Product
        productPrice={product.price}
        productTitle={product.title}
        productDescription={product.description}
        on:addtocart={addToCart} />
    {/each}
  {/if}
</section>
