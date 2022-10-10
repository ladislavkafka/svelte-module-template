var main = (function () {
    'use strict';

    function noop() { }
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
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
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated main will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty main. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated main will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update main
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once main are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte main. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\HelloComponent\index.svelte generated by Svelte v3.50.1 */

    function add_css$1(target) {
    	append_styles(target, "svelte-1tb9iu1", "h1.svelte-1tb9iu1{color:red}");
    }

    function create_fragment$2(ctx) {
    	let fieldset;
    	let legend;
    	let t1;
    	let h1;
    	let t2;
    	let t3;
    	let t4;

    	return {
    		c() {
    			fieldset = element("fieldset");
    			legend = element("legend");
    			legend.textContent = "component1";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text("Hello ");
    			t3 = text(/*name*/ ctx[0]);
    			t4 = text("!");
    			attr(h1, "class", "svelte-1tb9iu1");
    		},
    		m(target, anchor) {
    			insert(target, fieldset, anchor);
    			append(fieldset, legend);
    			append(fieldset, t1);
    			append(fieldset, h1);
    			append(h1, t2);
    			append(h1, t3);
    			append(h1, t4);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t3, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(fieldset);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class HelloComponent extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { name: 0 }, add_css$1);
    	}
    }

    /* src\ByeByeComponent\index.svelte generated by Svelte v3.50.1 */

    function add_css(target) {
    	append_styles(target, "svelte-1ueu1rl", "h2.svelte-1ueu1rl{color:purple}");
    }

    function create_fragment$1(ctx) {
    	let fieldset;
    	let legend;
    	let t1;
    	let h2;
    	let t2;
    	let t3;
    	let t4;

    	return {
    		c() {
    			fieldset = element("fieldset");
    			legend = element("legend");
    			legend.textContent = "component2";
    			t1 = space();
    			h2 = element("h2");
    			t2 = text("Bye-bye ");
    			t3 = text(/*name*/ ctx[0]);
    			t4 = text("!");
    			attr(h2, "class", "svelte-1ueu1rl");
    		},
    		m(target, anchor) {
    			insert(target, fieldset, anchor);
    			append(fieldset, legend);
    			append(fieldset, t1);
    			append(fieldset, h2);
    			append(h2, t2);
    			append(h2, t3);
    			append(h2, t4);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t3, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(fieldset);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class ByeByeComponent extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { name: 0 }, add_css);
    	}
    }

    /* src\App.svelte generated by Svelte v3.50.1 */

    function create_fragment(ctx) {
    	let hello;
    	let t;
    	let byebye;
    	let current;
    	hello = new HelloComponent({ props: { name: /*name*/ ctx[0] } });
    	byebye = new ByeByeComponent({ props: { name: /*name*/ ctx[0] } });

    	return {
    		c() {
    			create_component(hello.$$.fragment);
    			t = space();
    			create_component(byebye.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(hello, target, anchor);
    			insert(target, t, anchor);
    			mount_component(byebye, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const hello_changes = {};
    			if (dirty & /*name*/ 1) hello_changes.name = /*name*/ ctx[0];
    			hello.$set(hello_changes);
    			const byebye_changes = {};
    			if (dirty & /*name*/ 1) byebye_changes.name = /*name*/ ctx[0];
    			byebye.$set(byebye_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(hello.$$.fragment, local);
    			transition_in(byebye.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(hello.$$.fragment, local);
    			transition_out(byebye.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(hello, detaching);
    			if (detaching) detach(t);
    			destroy_component(byebye, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });
    	}
    }

    // for testing

    const app = new App({
      target: document.body,
      props: {
        name: 'John'
      }
    });

    return app;

})();
