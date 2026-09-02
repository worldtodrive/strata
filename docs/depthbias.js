

export const BIAS_SHIPPING = {
	terrain:  { factor: 8, units: 6 },
	water:    { factor: 9, units: 7 },
	deck:     { factor: 0, units: -24 },
	junction: { factor: 0, units: -24 },
	slab:     { factor: 0, units: -12 },
	wall:     { factor: 0, units: -40 },
	paint:    { factor: 0, units: -64 },
};

export const BIAS_LEGACY = {
	terrain:  { factor: 0, units: 0 },
	water:    { factor: 1, units: 1 },
	deck:     { factor: -8, units: -8 },
	junction: { factor: -8, units: -8 },
	slab:     { factor: 0, units: -9 },
	wall:     { factor: -8, units: -9 },
	paint:    { factor: -14, units: -14 },
};

export const BIAS_NONE = {
	terrain:  { factor: 0, units: 0 },
	water:    { factor: 0, units: 0 },
	deck:     { factor: 0, units: 0 },
	junction: { factor: 0, units: 0 },
	slab:     { factor: 0, units: 0 },
	wall:     { factor: 0, units: 0 },
	paint:    { factor: 0, units: 0 },
};

export const BIAS_ARMS = [
	{ id: 'bounded', label: 'Bounded — upstream default', stack: BIAS_SHIPPING },
	{ id: 'legacy',  label: 'Legacy — car sinks when zoomed out', stack: BIAS_LEGACY },
	{ id: 'none',    label: 'None — the probe (z-fights on purpose)', stack: BIAS_NONE },
];

export const DEFAULT_BIAS_ARM = 'bounded';

export function biasStackOf(arm) {
	const found = BIAS_ARMS.find((a) => a.id === arm);
	return found ? found.stack : BIAS_SHIPPING;
}

export function resolveBiasArm() {
	if (typeof location === 'undefined') return DEFAULT_BIAS_ARM;
	const raw = new URLSearchParams(location.search).get('roadbias');
	if (raw === '0') return 'none';
	return BIAS_ARMS.some((a) => a.id === raw) ? raw : DEFAULT_BIAS_ARM;
}

export function biasProps(b) {
	return {
		polygonOffset: b.factor !== 0 || b.units !== 0,
		polygonOffsetFactor: b.factor,
		polygonOffsetUnits: b.units,
	};
}

export class BiasRegistry {
	constructor(arm) {
		this.entries = [];
		this.armId = arm || resolveBiasArm();
	}

	register(mat, role) {
		if (!mat || !role) return mat;
		this.entries.push({ mat, role });
		Object.assign(mat, biasProps(biasStackOf(this.armId)[role]));
		return mat;
	}

	registerTree(root, role) {
		if (!root || !role) return 0;
		let n = 0;
		root.traverse((o) => {
			if (o.isMesh && o.material) { this.register(o.material, role); n++; }
		});
		return n;
	}

	get arm() { return this.armId; }

	setArm(arm) {
		this.armId = arm;
		const stack = biasStackOf(arm);
		for (const e of this.entries) Object.assign(e.mat, biasProps(stack[e.role]));
		return this.entries.length;
	}

	count(role) {
		return role ? this.entries.filter((e) => e.role === role).length
			: this.entries.length;
	}

	get report() {
		const by = {};
		for (const e of this.entries) by[e.role] = (by[e.role] || 0) + 1;
		const parts = Object.keys(by).sort().map((r) => `${r} ${by[r]}`);
		return `arm ${this.armId} · ${this.entries.length} material(s) · `
			+ `${parts.join(', ') || 'none'}`;
	}
}
