

const VH = (typeof window !== 'undefined' && window.CSS && window.CSS.supports
	&& window.CSS.supports('height', '1dvh')) ? 'dvh' : 'vh';

export const TOUCH = {

	ZONE_W: 'min(46vw, 360px)',
	ZONE_H: `min(46${VH}, 340px)`,

	RING: 'min(34vw, 148px)',
	KNOB: 'min(15vw, 64px)',

	DEADZONE: 0.07,

	PEDAL_W: `max(min(23vw, 108px, (100vw - 2 * var(--tc-edge-x)`
		+ ` - 2 * var(--tc-pedal-gap) - var(--tc-mid-gap)) / 4), 62px)`,
	PEDAL_H: `max(min(23vw, 108px, (100vw - 2 * var(--tc-edge-x)`
		+ ` - 2 * var(--tc-pedal-gap) - var(--tc-mid-gap)) / 4), 62px)`,
	PEDAL_GAP: 'min(3vw, 14px)',

	MID_GAP: 'max(min(6vw, 28px), 20px)',

	EDGE_X: 'max(2vw, 10px)',
	EDGE_Y: `max(4.5${VH}, 26px)`,

	STACK_GAP: `max(min(3${VH}, 18px), 12px)`,

	RESET_SIZE: 'max(min(12vw, 52px), 44px)',

	RESCUE_SIZE: 'max(min(18vw, 84px), 60px)',

	RESET_SLOP_PX: 12,
	RESET_MS: 700,

	MENU_SIZE: 'max(min(11vw, 48px), 44px)',
	MENU_EDGE: 'max(1vw, 6px)',

	PINCH_GAIN: 1.0,

	STEER_DEFAULT: 'buttons',

	CLEAN_BAND_H: `min(38${VH}, 320px)`,

	CLEAN_RESET_W: 'min(30vw, 180px)',
	CLEAN_RESET_H: `min(22${VH}, 190px)`,
};

export function createTouchControls({ root, onZoom, onMenu, onReset, busy }) {
	if (!root) return null;

	for (const [k, v] of Object.entries({
		'--tc-zone-w': TOUCH.ZONE_W, '--tc-zone-h': TOUCH.ZONE_H,
		'--tc-ring': TOUCH.RING, '--tc-knob': TOUCH.KNOB,
		'--tc-pedal-w': TOUCH.PEDAL_W, '--tc-pedal-h': TOUCH.PEDAL_H,
		'--tc-pedal-gap': TOUCH.PEDAL_GAP, '--tc-mid-gap': TOUCH.MID_GAP,
		'--tc-edge-x': TOUCH.EDGE_X, '--tc-edge-y': TOUCH.EDGE_Y,
		'--tc-stack-gap': TOUCH.STACK_GAP,
		'--tc-clean-band-h': TOUCH.CLEAN_BAND_H,
		'--tc-clean-reset-w': TOUCH.CLEAN_RESET_W,
		'--tc-clean-reset-h': TOUCH.CLEAN_RESET_H,
		'--tc-menu-size': TOUCH.MENU_SIZE, '--tc-menu-edge': TOUCH.MENU_EDGE,
		'--tc-reset-size': TOUCH.RESET_SIZE,
		'--tc-rescue-size': TOUCH.RESCUE_SIZE,
	})) root.style.setProperty(k, v);

	root.innerHTML = `
		<div class="tc-czone tc-cz-left" id="tc-cz-left"></div>
		<div class="tc-czone tc-cz-right" id="tc-cz-right"></div>
		<div class="tc-czone tc-cz-brake" id="tc-cz-brake"></div>
		<div class="tc-czone tc-cz-gas" id="tc-cz-gas"></div>
		<div class="tc-czone tc-cz-reset" id="tc-cz-reset"></div>
		<div class="tc-rescue" id="tc-rescue"></div>
		<div class="tc-zone" id="tc-zone"></div>
		<button class="tc-reset" id="tc-reset" aria-label="reset">&#8634;</button>
		<div class="tc-ring" id="tc-ring"><div class="tc-knob" id="tc-knob"></div></div>
		<div class="tc-pedal tc-steer tc-left" id="tc-left"><span>&#9664;</span></div>
		<div class="tc-pedal tc-steer tc-right" id="tc-right"><span>&#9654;</span></div>
		<div class="tc-pedal tc-brake" id="tc-brake"><span>BRAKE</span></div>
		<div class="tc-pedal tc-gas" id="tc-gas"><span>GAS</span></div>
		<button class="tc-menu" id="tc-menu" aria-label="menu">
			<span></span><span></span><span></span>
		</button>`;

	const zone = root.querySelector('#tc-zone');
	const ring = root.querySelector('#tc-ring');
	const knob = root.querySelector('#tc-knob');
	const gasEl = root.querySelector('#tc-gas');
	const brakeEl = root.querySelector('#tc-brake');
	const menuEl = root.querySelector('#tc-menu');
	const resetEl = root.querySelector('#tc-reset');
	const rescueEl = root.querySelector('#tc-rescue');
	const leftEl = root.querySelector('#tc-left');
	const rightEl = root.querySelector('#tc-right');

	const czLeft = root.querySelector('#tc-cz-left');
	const czRight = root.querySelector('#tc-cz-right');
	const czBrake = root.querySelector('#tc-cz-brake');
	const czGas = root.querySelector('#tc-cz-gas');
	const czReset = root.querySelector('#tc-cz-reset');

	let enabled = false;

	let steerMode = TOUCH.STEER_DEFAULT;

	let cleanMode = false;

	const placeFloat = (el, x, y) => {
		el.style.left = `${x}px`;
		el.style.top = `${y}px`;
	};

	const state = { steer: 0, held: false, forward: false, back: false,
		left: false, right: false };

	let stickId = null;
	let cx = 0;
	let cy = 0;
	let radius = 60;

	const clearStick = () => {
		stickId = null;
		state.held = false;
		state.steer = 0;
		ring.classList.remove('on');
		knob.style.transform = 'translate(-50%, -50%)';
	};

	const moveStick = (x, y) => {
		const dx = x - cx;
		const dy = y - cy;

		const len = Math.hypot(dx, dy) || 1;
		const k = Math.min(1, radius / len);
		knob.style.transform =
			`translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;

		const raw = Math.max(-1, Math.min(1, -dx / radius));

		const mag = Math.abs(raw);
		state.steer = mag < TOUCH.DEADZONE ? 0
			: Math.sign(raw) * ((mag - TOUCH.DEADZONE) / (1 - TOUCH.DEADZONE));
	};

	zone.addEventListener('pointerdown', (e) => {

		if (steerMode !== 'stick') return;
		if (!enabled || busy() || stickId !== null) return;
		stickId = e.pointerId;
		cx = e.clientX;
		cy = e.clientY;
		ring.style.left = `${cx}px`;
		ring.style.top = `${cy}px`;
		ring.classList.add('on');

		radius = Math.max(28, ring.offsetWidth / 2);
		state.held = true;
		moveStick(e.clientX, e.clientY);
		zone.setPointerCapture(e.pointerId);
		e.preventDefault();
		e.stopPropagation();
	});
	zone.addEventListener('pointermove', (e) => {
		if (e.pointerId !== stickId) return;
		moveStick(e.clientX, e.clientY);
		e.preventDefault();
	});
	const dropStick = (e) => {
		if (e.pointerId !== stickId) return;
		clearStick();
	};
	zone.addEventListener('pointerup', dropStick);
	zone.addEventListener('pointercancel', dropStick);

	const held = { gas: new Set(), brake: new Set(),
		left: new Set(), right: new Set() };

	const bindPedal = (el, name, face) => {
		const g = face || el;
		el.addEventListener('pointerdown', (e) => {
			if (!enabled || busy()) return;
			if (face ? !cleanMode : cleanMode) return;
			held[name].add(e.pointerId);
			if (face) placeFloat(face, e.clientX, e.clientY);
			g.classList.add('down');

			el.setPointerCapture(e.pointerId);
			e.preventDefault();
			e.stopPropagation();
		});
		const up = (e) => {
			if (!held[name].delete(e.pointerId)) return;
			if (!held[name].size) g.classList.remove('down');
		};
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	};
	bindPedal(gasEl, 'gas');
	bindPedal(brakeEl, 'brake');

	bindPedal(czGas, 'gas', gasEl);
	bindPedal(czBrake, 'brake', brakeEl);
	bindPedal(czLeft, 'left', leftEl);
	bindPedal(czRight, 'right', rightEl);

	bindPedal(leftEl, 'left');
	bindPedal(rightEl, 'right');

	menuEl.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	rescueEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
	rescueEl.addEventListener('pointerup', (e) => {
		if (busy()) return;
		e.preventDefault();
		e.stopPropagation();
		onMenu();
	});

	menuEl.addEventListener('pointerup', (e) => {
		if (!enabled) return;
		e.preventDefault();
		e.stopPropagation();
		onMenu();
	});

	let resetId = null;
	let resetAt = 0;
	let resetX = 0;
	let resetY = 0;
	resetEl.addEventListener('pointerdown', (e) => {
		if (!enabled || busy() || resetId !== null || cleanMode) return;
		resetId = e.pointerId;
		resetAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
		resetX = e.clientX;
		resetY = e.clientY;
		e.preventDefault();
		e.stopPropagation();
	});
	const resetUp = (e) => {
		if (e.pointerId !== resetId) return;
		resetId = null;
		if (e.type !== 'pointerup') return;
		const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
		const travelled = Math.hypot(e.clientX - resetX, e.clientY - resetY);
		if (travelled > TOUCH.RESET_SLOP_PX || now - resetAt > TOUCH.RESET_MS) return;
		e.preventDefault();
		e.stopPropagation();
		onReset();
	};
	resetEl.addEventListener('pointerup', resetUp);
	resetEl.addEventListener('pointercancel', resetUp);

	czReset.addEventListener('pointerdown', (e) => {
		if (!enabled || busy() || resetId !== null || !cleanMode) return;
		resetId = e.pointerId;
		resetAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
		resetX = e.clientX;
		resetY = e.clientY;
		placeFloat(resetEl, e.clientX, e.clientY);
		resetEl.classList.add('down');
		e.preventDefault();
		e.stopPropagation();
	});
	const czResetUp = (e) => {
		if (e.pointerId === resetId) resetEl.classList.remove('down');
		resetUp(e);
	};
	czReset.addEventListener('pointerup', czResetUp);
	czReset.addEventListener('pointercancel', czResetUp);

	const pinch = new Map();
	let pinchDist = 0;
	const pinchSpan = () => {
		const [a, b] = [...pinch.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};
	window.addEventListener('pointerdown', (e) => {
		if (!enabled || busy()) return;
		if (e.pointerType !== 'touch') return;
		if (root.contains(e.target)) return;
		pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
		pinchDist = pinch.size === 2 ? pinchSpan() : 0;
	}, { passive: true });
	window.addEventListener('pointermove', (e) => {
		if (!pinch.has(e.pointerId)) return;
		pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pinch.size !== 2) return;
		const now = pinchSpan();
		if (pinchDist > 0 && now > 0) {

			const r = pinchDist / now;
			onZoom(TOUCH.PINCH_GAIN === 1 ? r : Math.pow(r, TOUCH.PINCH_GAIN));
		}
		pinchDist = now;
	}, { passive: true });
	const dropPinch = (e) => {
		if (!pinch.delete(e.pointerId)) return;
		pinchDist = pinch.size === 2 ? pinchSpan() : 0;
	};
	window.addEventListener('pointerup', dropPinch, { passive: true });
	window.addEventListener('pointercancel', dropPinch, { passive: true });

	const reset = () => {
		clearStick();
		for (const k of Object.keys(held)) held[k].clear();
		for (const el of [gasEl, brakeEl, leftEl, rightEl]) el.classList.remove('down');
		pinch.clear();
		pinchDist = 0;
		resetId = null;
	};

	return {
		root,
		isEnabled: () => enabled,
		setEnabled(on) {
			enabled = !!on;
			root.classList.toggle('on', enabled);

			if (!enabled) reset();
		},
		reset,

		read() {
			if (!enabled) return null;
			state.forward = held.gas.size > 0;
			state.back = held.brake.size > 0;

			const buttons = steerMode === 'buttons';
			state.left = buttons && held.left.size > 0;
			state.right = buttons && held.right.size > 0;
			if (!buttons) {
				if (!state.held && !state.forward && !state.back) return null;
				return state;
			}
			if (!state.left && !state.right && !state.forward && !state.back) {
				return null;
			}

			state.held = false;
			state.steer = 0;
			return state;
		},

		setResetVisible(on) {
			root.classList.toggle('no-reset', !on);

			if (!on) resetId = null;
		},

		setSteerMode(mode) {
			steerMode = mode === 'stick' ? 'stick' : 'buttons';
			root.classList.toggle('steer-buttons', steerMode === 'buttons');

			clearStick();
			held.left.clear();
			held.right.clear();
			leftEl.classList.remove('down');
			rightEl.classList.remove('down');
			return steerMode;
		},

		setCleanMode(on) {
			const floats = [gasEl, brakeEl, leftEl, rightEl, resetEl];

			if (on && !cleanMode) {
				for (const el of floats) {
					const r = el.getBoundingClientRect();
					if (r.width) placeFloat(el, r.x + r.width / 2, r.y + r.height / 2);
				}
			}
			cleanMode = !!on;
			root.classList.toggle('clean', cleanMode);
			clearStick();
			for (const k of Object.keys(held)) held[k].clear();
			for (const el of floats) {
				el.classList.remove('down');

				if (!cleanMode) {
					el.style.left = '';
					el.style.top = '';
				}
			}
			resetId = null;
			return cleanMode;
		},
	};
}
