
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function to_number(value) {
		return value === '' ? undefined : +value;
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];

		if (callbacks) {
			callbacks.slice().forEach(fn => fn(event));
		}
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = blank_object();
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	/* src/Button.svelte generated by Svelte v3.4.1 */

	const file = "src/Button.svelte";

	function create_fragment(ctx) {
		var button, current, dispose;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				button = element("button");

				if (default_slot) default_slot.c();

				button.className = "svelte-14c2swk";
				add_location(button, file, 16, 0, 264);
				dispose = listen(button, "click", ctx.click_handler);
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(button_nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);

				if (default_slot) {
					default_slot.m(button, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(button);
				}

				if (default_slot) default_slot.d(detaching);
				dispose();
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let { $$slots = {}, $$scope } = $$props;

		function click_handler(event) {
			bubble($$self, event);
		}

		$$self.$set = $$props => {
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { click_handler, $$slots, $$scope };
	}

	class Button extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, []);
		}
	}

	/* src/Product.svelte generated by Svelte v3.4.1 */

	const file$1 = "src/Product.svelte";

	// (45:2) <Button on:click={addToCart}>
	function create_default_slot(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Add To Cart");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$1(ctx) {
		var div, h1, t0, t1, h2, t2, t3, p, t4, t5, current;

		var button = new Button({
			props: {
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});
		button.$on("click", ctx.addToCart);

		return {
			c: function create() {
				div = element("div");
				h1 = element("h1");
				t0 = text(ctx.productTitle);
				t1 = space();
				h2 = element("h2");
				t2 = text(ctx.productPrice);
				t3 = space();
				p = element("p");
				t4 = text(ctx.productDescription);
				t5 = space();
				button.$$.fragment.c();
				h1.className = "svelte-etinwd";
				add_location(h1, file$1, 41, 2, 652);
				h2.className = "svelte-etinwd";
				add_location(h2, file$1, 42, 2, 678);
				p.className = "svelte-etinwd";
				add_location(p, file$1, 43, 2, 704);
				div.className = "svelte-etinwd";
				add_location(div, file$1, 40, 0, 644);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, h1);
				append(h1, t0);
				append(div, t1);
				append(div, h2);
				append(h2, t2);
				append(div, t3);
				append(div, p);
				append(p, t4);
				append(div, t5);
				mount_component(button, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (!current || changed.productTitle) {
					set_data(t0, ctx.productTitle);
				}

				if (!current || changed.productPrice) {
					set_data(t2, ctx.productPrice);
				}

				if (!current || changed.productDescription) {
					set_data(t4, ctx.productDescription);
				}

				var button_changes = {};
				if (changed.$$scope) button_changes.$$scope = { changed, ctx };
				button.$set(button_changes);
			},

			i: function intro(local) {
				if (current) return;
				button.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				button.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				button.$destroy();
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		

	  let { productTitle, productDescription, productPrice } = $$props;

	  const dispatch = createEventDispatcher();

	  function addToCart() {
	    dispatch("addtocart", productTitle);
	  }

		$$self.$set = $$props => {
			if ('productTitle' in $$props) $$invalidate('productTitle', productTitle = $$props.productTitle);
			if ('productDescription' in $$props) $$invalidate('productDescription', productDescription = $$props.productDescription);
			if ('productPrice' in $$props) $$invalidate('productPrice', productPrice = $$props.productPrice);
		};

		return {
			productTitle,
			productDescription,
			productPrice,
			addToCart
		};
	}

	class Product extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["productTitle", "productDescription", "productPrice"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.productTitle === undefined && !('productTitle' in props)) {
				console.warn("<Product> was created without expected prop 'productTitle'");
			}
			if (ctx.productDescription === undefined && !('productDescription' in props)) {
				console.warn("<Product> was created without expected prop 'productDescription'");
			}
			if (ctx.productPrice === undefined && !('productPrice' in props)) {
				console.warn("<Product> was created without expected prop 'productPrice'");
			}
		}

		get productTitle() {
			throw new Error("<Product>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set productTitle(value) {
			throw new Error("<Product>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get productDescription() {
			throw new Error("<Product>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set productDescription(value) {
			throw new Error("<Product>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get productPrice() {
			throw new Error("<Product>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set productPrice(value) {
			throw new Error("<Product>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/Cart.svelte generated by Svelte v3.4.1 */

	const file$2 = "src/Cart.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.item = list[i];
		return child_ctx;
	}

	// (30:0) {:else}
	function create_else_block(ctx) {
		var ul;

		var each_value = ctx.items;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		return {
			c: function create() {
				ul = element("ul");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				ul.className = "svelte-3qa7u7";
				add_location(ul, file$2, 30, 2, 421);
			},

			m: function mount(target, anchor) {
				insert(target, ul, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(ul, null);
				}
			},

			p: function update(changed, ctx) {
				if (changed.items) {
					each_value = ctx.items;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(ul, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(ul);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (28:0) {#if items.length === 0}
	function create_if_block(ctx) {
		var p;

		return {
			c: function create() {
				p = element("p");
				p.textContent = "No items in cart yet.";
				add_location(p, file$2, 28, 2, 382);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
			},

			p: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (32:4) {#each items as item}
	function create_each_block(ctx) {
		var li, t0_value = ctx.item.title, t0, t1, t2_value = ctx.item.price, t2;

		return {
			c: function create() {
				li = element("li");
				t0 = text(t0_value);
				t1 = text(" - ");
				t2 = text(t2_value);
				li.className = "svelte-3qa7u7";
				add_location(li, file$2, 32, 6, 458);
			},

			m: function mount(target, anchor) {
				insert(target, li, anchor);
				append(li, t0);
				append(li, t1);
				append(li, t2);
			},

			p: function update(changed, ctx) {
				if ((changed.items) && t0_value !== (t0_value = ctx.item.title)) {
					set_data(t0, t0_value);
				}

				if ((changed.items) && t2_value !== (t2_value = ctx.item.price)) {
					set_data(t2, t2_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	function create_fragment$2(ctx) {
		var t0, h1, t1, t2;

		function select_block_type(ctx) {
			if (ctx.items.length === 0) return create_if_block;
			return create_else_block;
		}

		var current_block_type = select_block_type(ctx);
		var if_block = current_block_type(ctx);

		return {
			c: function create() {
				if_block.c();
				t0 = space();
				h1 = element("h1");
				t1 = text("Total: $");
				t2 = text(ctx.cartTotal);
				h1.className = "svelte-3qa7u7";
				add_location(h1, file$2, 37, 0, 522);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				if_block.m(target, anchor);
				insert(target, t0, anchor);
				insert(target, h1, anchor);
				append(h1, t1);
				append(h1, t2);
			},

			p: function update(changed, ctx) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);
					if (if_block) {
						if_block.c();
						if_block.m(t0.parentNode, t0);
					}
				}

				if (changed.cartTotal) {
					set_data(t2, ctx.cartTotal);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if_block.d(detaching);

				if (detaching) {
					detach(t0);
					detach(h1);
				}
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let { items } = $$props;

		$$self.$set = $$props => {
			if ('items' in $$props) $$invalidate('items', items = $$props.items);
		};

		let cartTotal;

		$$self.$$.update = ($$dirty = { items: 1 }) => {
			if ($$dirty.items) { $$invalidate('cartTotal', cartTotal = items.reduce((sum, curValue) => {
	        return sum + curValue.price;
	      }, 0)); }
		};

		return { items, cartTotal };
	}

	class Cart extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["items"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.items === undefined && !('items' in props)) {
				console.warn("<Cart> was created without expected prop 'items'");
			}
		}

		get items() {
			throw new Error("<Cart>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set items(value) {
			throw new Error("<Cart>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.4.1 */

	const file$3 = "src/App.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.product = list[i];
		return child_ctx;
	}

	// (68:2) <Button on:click={createProduct}>
	function create_default_slot$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Create Product");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (74:2) {:else}
	function create_else_block$1(ctx) {
		var each_1_anchor, current;

		var each_value = ctx.products;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		function outro_block(i, detaching, local) {
			if (each_blocks[i]) {
				if (detaching) {
					on_outro(() => {
						each_blocks[i].d(detaching);
						each_blocks[i] = null;
					});
				}

				each_blocks[i].o(local);
			}
		}

		return {
			c: function create() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},

			m: function mount(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.products || changed.addToCart) {
					each_value = ctx.products;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
							each_blocks[i].i(1);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].i(1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();
					for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				current = true;
			},

			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				current = false;
			},

			d: function destroy(detaching) {
				destroy_each(each_blocks, detaching);

				if (detaching) {
					detach(each_1_anchor);
				}
			}
		};
	}

	// (72:2) {#if products.length === 0}
	function create_if_block$1(ctx) {
		var p;

		return {
			c: function create() {
				p = element("p");
				p.textContent = "No products were added yet!";
				add_location(p, file$3, 72, 4, 1336);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (75:4) {#each products as product}
	function create_each_block$1(ctx) {
		var current;

		var product = new Product({
			props: {
			productPrice: ctx.product.price,
			productTitle: ctx.product.title,
			productDescription: ctx.product.description
		},
			$$inline: true
		});
		product.$on("addtocart", ctx.addToCart);

		return {
			c: function create() {
				product.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(product, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var product_changes = {};
				if (changed.products) product_changes.productPrice = ctx.product.price;
				if (changed.products) product_changes.productTitle = ctx.product.title;
				if (changed.products) product_changes.productDescription = ctx.product.description;
				product.$set(product_changes);
			},

			i: function intro(local) {
				if (current) return;
				product.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				product.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				product.$destroy(detaching);
			}
		};
	}

	function create_fragment$3(ctx) {
		var section0, t0, hr, t1, section1, div0, label0, t3, input0, t4, div1, label1, t6, input1, t7, div2, label2, t9, textarea, t10, t11, section2, current_block_type_index, if_block, current, dispose;

		var cart = new Cart({
			props: { items: ctx.cartItems },
			$$inline: true
		});

		var button = new Button({
			props: {
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});
		button.$on("click", ctx.createProduct);

		var if_block_creators = [
			create_if_block$1,
			create_else_block$1
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.products.length === 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				section0 = element("section");
				cart.$$.fragment.c();
				t0 = space();
				hr = element("hr");
				t1 = space();
				section1 = element("section");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Title";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div1 = element("div");
				label1 = element("label");
				label1.textContent = "Price";
				t6 = space();
				input1 = element("input");
				t7 = space();
				div2 = element("div");
				label2 = element("label");
				label2.textContent = "Description";
				t9 = space();
				textarea = element("textarea");
				t10 = space();
				button.$$.fragment.c();
				t11 = space();
				section2 = element("section");
				if_block.c();
				section0.className = "svelte-7gbwjl";
				add_location(section0, file$3, 45, 0, 778);
				add_location(hr, file$3, 49, 0, 829);
				label0.htmlFor = "title";
				label0.className = "svelte-7gbwjl";
				add_location(label0, file$3, 53, 4, 859);
				input0.id = "title";
				attr(input0, "type", "text");
				input0.value = ctx.title;
				input0.className = "svelte-7gbwjl";
				add_location(input0, file$3, 54, 4, 896);
				add_location(div0, file$3, 52, 2, 849);
				label1.htmlFor = "price";
				label1.className = "svelte-7gbwjl";
				add_location(label1, file$3, 58, 4, 985);
				input1.id = "price";
				attr(input1, "type", "number");
				input1.className = "svelte-7gbwjl";
				add_location(input1, file$3, 59, 4, 1022);
				add_location(div1, file$3, 57, 2, 975);
				label2.htmlFor = "description";
				label2.className = "svelte-7gbwjl";
				add_location(label2, file$3, 63, 4, 1098);
				textarea.id = "description";
				textarea.rows = "3";
				add_location(textarea, file$3, 64, 4, 1147);
				add_location(div2, file$3, 62, 2, 1088);
				section1.className = "svelte-7gbwjl";
				add_location(section1, file$3, 51, 0, 837);
				section2.className = "svelte-7gbwjl";
				add_location(section2, file$3, 70, 0, 1292);

				dispose = [
					listen(input0, "input", ctx.setTitle),
					listen(input1, "input", ctx.input1_input_handler),
					listen(textarea, "input", ctx.textarea_input_handler)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, section0, anchor);
				mount_component(cart, section0, null);
				insert(target, t0, anchor);
				insert(target, hr, anchor);
				insert(target, t1, anchor);
				insert(target, section1, anchor);
				append(section1, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);
				append(section1, t4);
				append(section1, div1);
				append(div1, label1);
				append(div1, t6);
				append(div1, input1);

				input1.value = ctx.price;

				append(section1, t7);
				append(section1, div2);
				append(div2, label2);
				append(div2, t9);
				append(div2, textarea);

				textarea.value = ctx.description;

				append(section1, t10);
				mount_component(button, section1, null);
				insert(target, t11, anchor);
				insert(target, section2, anchor);
				if_blocks[current_block_type_index].m(section2, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var cart_changes = {};
				if (changed.cartItems) cart_changes.items = ctx.cartItems;
				cart.$set(cart_changes);

				if (!current || changed.title) {
					input0.value = ctx.title;
				}

				if (changed.price) input1.value = ctx.price;
				if (changed.description) textarea.value = ctx.description;

				var button_changes = {};
				if (changed.$$scope) button_changes.$$scope = { changed, ctx };
				button.$set(button_changes);

				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(section2, null);
				}
			},

			i: function intro(local) {
				if (current) return;
				cart.$$.fragment.i(local);

				button.$$.fragment.i(local);

				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				cart.$$.fragment.o(local);
				button.$$.fragment.o(local);
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(section0);
				}

				cart.$destroy();

				if (detaching) {
					detach(t0);
					detach(hr);
					detach(t1);
					detach(section1);
				}

				button.$destroy();

				if (detaching) {
					detach(t11);
					detach(section2);
				}

				if_blocks[current_block_type_index].d();
				run_all(dispose);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		

	  let title = "";
	  let price = 0;
	  let description = "";

	  let products = [];
	  let cartItems = [];

	  function setTitle(event) {
	    $$invalidate('title', title = event.target.value);
	  }

	  function createProduct() {
	    const newProduct = {
	      title: title,
	      price: price,
	      description: description
	    };
	    $$invalidate('products', products = products.concat(newProduct));
	  }

	  function addToCart(event) {
	    const selectedTitle = event.detail;
	    $$invalidate('cartItems', cartItems = cartItems.concat({
	      ...products.find(prod => prod.title === selectedTitle)
	    }));
	  }

		function input1_input_handler() {
			price = to_number(this.value);
			$$invalidate('price', price);
		}

		function textarea_input_handler() {
			description = this.value;
			$$invalidate('description', description);
		}

		return {
			title,
			price,
			description,
			products,
			cartItems,
			setTitle,
			createProduct,
			addToCart,
			input1_input_handler,
			textarea_input_handler
		};
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, []);
		}
	}

	const app = new App({
		target: document.body,
		props: {
			name: 'world'
		}
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
