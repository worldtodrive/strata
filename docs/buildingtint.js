

import * as THREE from 'three';

export const WELD_M = 0.25;

export const TINT_LEVELS = {
	upstream: {
		label: 'standard (42% tinted)',
		blurb: 'Their palette exactly: a white city with a coloured minority.',
		share: 0.42, satCap: 0.30, neutralSat: 1.0, lightDrop: 0.00,
	},
	noticeable: {
		label: 'noticeable',
		blurb: 'More blocks take a hue, the greys become creams and bones, and the whole '
			+ 'band comes down enough for any of it to survive the fill light.',
		share: 0.58, satCap: 0.42, neutralSat: 2.4, lightDrop: 0.07,
	},
	bold: {
		label: 'bold',
		blurb: 'A coloured city rather than a white one. Furthest from their brief and the '
			+ 'easiest to judge — if this still reads white, the defect is not the palette.',
		share: 0.76, satCap: 0.58, neutralSat: 3.6, lightDrop: 0.13,
	},
	white: {
		label: 'white city',
		blurb: 'Value only, no hue anywhere. The control — what the massing looks like with '
			+ 'the colour argument removed entirely.',
		share: 0.0, satCap: 0.30, neutralSat: 0.35, lightDrop: 0.00,
	},

	neon: {
		label: 'neon (near-black)',
		blurb: 'The dark city the neon outlines are drawn against. Keeps the per-building '
			+ 'variety and takes it down to where a tube can out-shine it.',
		share: 0.76, satCap: 0.58, neutralSat: 3.6, lightDrop: 0.002,
		lightGain: 0.024, floorScale: 0.012,
	},
};

export const DEFAULT_TINT_LEVEL = 'bold';

let LEVEL = TINT_LEVELS[DEFAULT_TINT_LEVEL];

export function setLevel(id) { LEVEL = TINT_LEVELS[id] || TINT_LEVELS[DEFAULT_TINT_LEVEL]; }

export const SHADE_LEVELS = {
	off: {
		label: 'off (flat albedo)',
		blurb: 'Every face at full colour. The record of what the page looked like before '
			+ 'facade shading, and the control this is judged against.',
		roof: 1.0, top: 1.0, base: 1.0,
	},
	gentle: {
		label: 'gentle',
		blurb: 'Half of upstream. For if their contrast reads too heavy under OUR fill light, '
			+ 'which carries about three times theirs.',
		roof: 0.97, top: 0.83, base: 0.68,
	},
	upstream: {
		label: 'standard (0.42 → 0.66)',
		blurb: 'Their numbers exactly: walls 0.42 at the ground and 0.66 at the roofline, '
			+ 'roofs 0.94. A pale roof over a distinctly darker wall.',
		roof: 0.94, top: 0.66, base: 0.42,
	},
	deep: {
		label: 'deep',
		blurb: 'Past upstream — a harder contact darkening at the foot. The far end of the '
			+ 'axis, so if the truth is beyond their numbers it is reachable without an edit.',
		roof: 0.94, top: 0.58, base: 0.26,
	},
};

export const DEFAULT_SHADE_LEVEL = 'deep';

const ROOF_NY = 0.5;

let SHADE = SHADE_LEVELS[DEFAULT_SHADE_LEVEL];

export function setShade(id) { SHADE = SHADE_LEVELS[id] || SHADE_LEVELS[DEFAULT_SHADE_LEVEL]; }

function facadeShade(pos, idx, n) {
	if (SHADE.roof === 1 && SHADE.top === 1 && SHADE.base === 1) return null;
	const shade = new Float32Array(n);
	shade.fill(SHADE.roof);
	const tris = idx ? idx.count / 3 : n / 3;
	for (let t = 0; t < tris; t++) {
		const a = idx ? idx.getX(t * 3) : t * 3;
		const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
		const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
		const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
		const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
		const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);

		const ux = bx - ax, uy = by - ay, uz = bz - az;
		const vx = cx - ax, vy = cy - ay, vz = cz - az;
		const ny = uz * vx - ux * vz;
		const len = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
		if (len > 0 && Math.abs(ny / len) >= ROOF_NY) continue;
		const lo = Math.min(ay, by, cy);
		const hi = Math.max(ay, by, cy);

		const mid = hi - lo < 1e-4 ? -Infinity : (lo + hi) * 0.5;
		shade[a] = ay >= mid ? SHADE.top : SHADE.base;
		shade[b] = by >= mid ? SHADE.top : SHADE.base;
		shade[c] = cy >= mid ? SHADE.top : SHADE.base;
	}
	return shade;
}

const CITY_HUES = [
	[0.09, 0.20, 0.80],
	[0.05, 0.26, 0.68],
	[0.11, 0.24, 0.76],
	[0.28, 0.12, 0.72],
	[0.58, 0.10, 0.70],
	[0.02, 0.14, 0.74],
	[0.14, 0.16, 0.82],
];

const frac = (x) => x - Math.floor(x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function muteTo(r, g, b, maxSat) {
	const hi = Math.max(r, g, b);
	const lo = Math.min(r, g, b);
	if (hi <= 0) return [r, g, b];
	const sat = (hi - lo) / hi;
	if (sat <= maxSat) return [r, g, b];
	const k = maxSat / sat;
	return [hi + (r - hi) * k, hi + (g - hi) * k, hi + (b - hi) * k];
}

function hslToRgb(h, s, l) {
	if (s === 0) return [l, l, l];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const f = (t) => {
		let u = frac(t);
		if (u < 1 / 6) return p + (q - p) * 6 * u;
		if (u < 1 / 2) return q;
		if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
		return p;
	};
	return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

export function pick(t, height, area) {
	const massDrop = Math.min(0.09, height / 220 + Math.min(area, 4000) / 60000);

	const gain = LEVEL.lightGain === undefined ? 1 : LEVEL.lightGain;
	const fs = LEVEL.floorScale === undefined ? 1 : LEVEL.floorScale;
	if (frac(t * 13.37) >= LEVEL.share) {

		const hue = 0.08 + t * 0.5;
		const sat = (0.012 + frac(t * 7.13) * 0.022) * LEVEL.neutralSat;
		const light = clamp((0.78 + frac(t * 3.77) * 0.19 - massDrop) * gain - LEVEL.lightDrop,
			0.48 * fs, 0.98);
		return hslToRgb(hue, sat, light);
	}
	const [hue, satBase, lightBase] = CITY_HUES[
		Math.floor(frac(t * 2.71) * CITY_HUES.length) % CITY_HUES.length];

	const sat = clamp(satBase * (0.75 + frac(t * 9.17) * 0.5), 0, LEVEL.satCap + 0.02);
	const light = clamp(
		(lightBase + (frac(t * 3.77) - 0.5) * 0.14 - massDrop) * gain - LEVEL.lightDrop,
		0.36 * fs, 0.93);
	const [r, g, b] = hslToRgb(hue, sat, light);
	return muteTo(r, g, b, LEVEL.satCap);
}

export function seedAt(x, z) {
	let h = (Math.imul(Math.round(x * 4) | 0, 0x9e3779b1)
		^ Math.imul(Math.round(z * 4) | 0, 0x85ebca6b)) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x27d4eb2d);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

export function tintBuildings(root, levelId, shadeId) {

	LEVEL = TINT_LEVELS[levelId] || TINT_LEVELS[DEFAULT_TINT_LEVEL];
	SHADE = SHADE_LEVELS[shadeId] || SHADE_LEVELS[DEFAULT_SHADE_LEVEL];
	let buildings = 0;
	root.traverse((o) => {
		if (!o.isMesh || !o.geometry) return;
		const g = o.geometry;

		if (g.userData && (g.userData.windows || g.userData.neon)) return;
		const pos = g.getAttribute('position');

		const stamp = `${LEVEL.label}|${SHADE.label}`;
		if (!pos || g.userData.tintedAt === stamp) return;

		const n = pos.count;

		const cell = new Map();
		const parent = new Int32Array(n);
		for (let i = 0; i < n; i++) parent[i] = i;
		const find = (a) => {
			let r = a;
			while (parent[r] !== r) r = parent[r];
			while (parent[a] !== r) { const nx = parent[a]; parent[a] = r; a = nx; }
			return r;
		};
		const union = (a, b) => {
			const ra = find(a); const rb = find(b);
			if (ra !== rb) parent[ra] = rb;
		};

		for (let i = 0; i < n; i++) {
			const kx = Math.round(pos.getX(i) / WELD_M);
			const ky = Math.round(pos.getY(i) / WELD_M);
			const kz = Math.round(pos.getZ(i) / WELD_M);
			const key = `${kx},${ky},${kz}`;
			const prev = cell.get(key);
			if (prev === undefined) cell.set(key, i);
			else union(i, prev);
		}

		const idx = g.index;
		const tris = idx ? idx.count / 3 : n / 3;
		for (let t = 0; t < tris; t++) {
			const a = idx ? idx.getX(t * 3) : t * 3;
			const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
			const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
			union(a, b);
			union(b, c);
		}

		const stats = new Map();
		for (let i = 0; i < n; i++) {
			const r = find(i);
			const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
			let s = stats.get(r);
			if (!s) {
				s = { minX: x, maxX: x, minZ: z, maxZ: z, minY: y, maxY: y };
				stats.set(r, s);
			} else {
				if (x < s.minX) s.minX = x; else if (x > s.maxX) s.maxX = x;
				if (z < s.minZ) s.minZ = z; else if (z > s.maxZ) s.maxZ = z;
				if (y < s.minY) s.minY = y; else if (y > s.maxY) s.maxY = y;
			}
		}

		const colour = new Map();
		for (const [r, s] of stats) {
			const cx = (s.minX + s.maxX) / 2;
			const cz = (s.minZ + s.maxZ) / 2;
			const area = Math.max(1, (s.maxX - s.minX) * (s.maxZ - s.minZ));
			colour.set(r, pick(seedAt(cx, cz), Math.max(0, s.maxY - s.minY), area));
		}
		buildings += colour.size;

		const shade = facadeShade(pos, idx, n);

		const col = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			const c = colour.get(find(i));

			const k = shade ? shade[i] : 1;
			col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
		}
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.userData.tintedAt = stamp;
	});
	return buildings;
}
