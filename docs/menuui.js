

const el = (tag, className, text) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
};

function keyChips(key) {
	const wrap = el('span', 'ctl-key');
	if (!key) return wrap;
	for (const part of String(key).split('-')) {
		wrap.appendChild(el('kbd', null, part));
	}
	return wrap;
}

export function panel(mount) {
	if (!mount) return null;
	mount.textContent = '';
	const readers = [];

	function row(spec) {
		const wrap = el('div', 'ctl');
		const head = el('div', 'ctl-head');
		const label = el('div', 'ctl-label');
		label.appendChild(el('b', null, spec.label));
		if (spec.key) label.appendChild(keyChips(spec.key));
		head.appendChild(label);
		wrap.appendChild(head);
		if (spec.hint) {
			const hint = el('p', 'ctl-hint');
			hint.innerHTML = spec.hint;
			wrap.appendChild(hint);
		}
		mount.appendChild(wrap);
		return { wrap, head };
	}

	return {

		group(title) {
			mount.appendChild(el('h3', null, title));
			return this;
		},

		note(html) {
			const p = el('p', 'ctl-note');
			p.innerHTML = html;
			mount.appendChild(p);
			return this;
		},

		toggle(spec) {
			const { head } = row(spec);
			const btn = el('button', 'sw');
			btn.appendChild(el('span', 'sw-dot'));
			btn.appendChild(el('span', 'sw-txt'));
			head.appendChild(btn);
			const write = () => {
				const on = !!spec.get();
				btn.classList.toggle('on', on);
				btn.lastChild.textContent = on
					? (spec.onText || 'on') : (spec.offText || 'off');
				btn.setAttribute('aria-pressed', on ? 'true' : 'false');
			};

			btn.addEventListener('click', () => {
				const r = spec.set(!spec.get());
				write();
				if (r && typeof r.then === 'function') r.then(write, write);
				if (spec.after) spec.after();
			});
			readers.push(write);
			write();
			return this;
		},

		slider(spec) {
			const { head } = row(spec);
			const box = el('div', 'ctl-slide');
			const input = el('input');
			input.type = 'range';
			input.min = spec.min;
			input.max = spec.max;
			input.step = spec.step || 1;
			const out = el('span', 'ctl-val');
			box.appendChild(input);
			box.appendChild(out);
			head.appendChild(box);
			const fmt = spec.format || ((v) => String(v));
			const write = () => {
				const v = spec.get();
				input.value = String(v);
				out.textContent = fmt(v);
			};
			input.addEventListener('input', () => {
				spec.set(Number(input.value));
				out.textContent = fmt(spec.get());
			});
			readers.push(write);
			write();
			return this;
		},

		select(spec) {
			const { head } = row(spec);
			const sel = el('select', 'ctl-sel');
			let listed = null;
			const fill = () => {
				const opts = typeof spec.options === 'function' ? spec.options() : spec.options;

				const sig = opts
					.map((o) => (o.value !== undefined ? o.value : o)).join(',');
				if (sig === listed) return;
				listed = sig;
				sel.textContent = '';
				for (const o of opts) {
					const opt = el('option');
					opt.value = o.value !== undefined ? o.value : o;
					opt.textContent = o.label !== undefined ? o.label : o;
					sel.appendChild(opt);
				}
			};
			fill();
			head.appendChild(sel);
			const write = () => { fill(); sel.value = String(spec.get()); };
			sel.addEventListener('change', () => { spec.set(sel.value); write(); });
			readers.push(write);
			write();
			return this;
		},

		button(spec) {
			const { head } = row(spec);
			const btn = el('button', 'ctl-btn', spec.text || 'run');
			btn.addEventListener('click', () => spec.click());
			head.appendChild(btn);
			return this;
		},

		refresh() {
			for (const write of readers) {

				try { write(); } catch (err) { console.warn('[menu] control failed to refresh', err); }
			}
		},
	};
}
