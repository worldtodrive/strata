

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import { WELD_M } from './buildingtint.js';

const CORE_PX = 0.9;
const GLOW_PX = 3.2;

const GLOW_PEAK = 0.16;

const CORE_PEAK = 0.55;

export const NEON_MIN_HEIGHT_M = 4;

export const NEON_SHARE = 0.62;

const NEON_PALETTE = [
	[0.0, 0.88, 1.0],
	[1.0, 0.04, 0.62],
	[0.05, 1.0, 0.35],
	[0.05, 0.35, 1.0],
];

const NEON_WEIGHTS = [0.44, 0.27, 0.15, 0.14];

const ROOF_EPS = 0.25;

const ROOF_NY = 0.5;

const VERT_MIN_DY = 0.5;

function neonHash(id, salt) {
	return ((((id ^ Math.imul(salt, 0x9e3779b9)) >>> 0) * 2654435761) >>> 0) / 4294967296;
}

export function idAt(x, z) {
	let h = (Math.imul(Math.round(x * 4) | 0, 0x9e3779b1)
		^ Math.imul(Math.round(z * 4) | 0, 0x85ebca6b)) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x27d4eb2d);
	h ^= h >>> 15;
	return h >>> 0;
}

function neonLit(id) { return neonHash(id, 17) < NEON_SHARE; }

function neonColourFor(id) {
	const h = neonHash(id, 3);
	let acc = 0;
	for (let i = 0; i < NEON_WEIGHTS.length; i++) {
		acc += NEON_WEIGHTS[i];
		if (h < acc) return NEON_PALETTE[i];
	}
	return NEON_PALETTE[0];
}

function collect(root, opts) {
	const gate = opts.minHeight;
	const sink = { pos: [], col: [], lit: 0, tooShort: 0, undressed: 0, buildings: 0 };

	root.traverse((o) => {
		if (!o.isMesh || !o.geometry) return;
		const g = o.geometry;

		if (g.userData && (g.userData.windows || g.userData.neon)) return;
		const pos = g.getAttribute('position');
		if (!pos) return;
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
		const keyOf = (i) => `${Math.round(pos.getX(i) / WELD_M)},`
			+ `${Math.round(pos.getY(i) / WELD_M)},`
			+ `${Math.round(pos.getZ(i) / WELD_M)}`;
		for (let i = 0; i < n; i++) {
			const k = keyOf(i);
			const prev = cell.get(k);
			if (prev === undefined) cell.set(k, i); else union(i, prev);
		}
		const idx = g.index;
		const tris = idx ? idx.count / 3 : n / 3;
		for (let t = 0; t < tris; t++) {
			const a = idx ? idx.getX(t * 3) : t * 3;
			const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
			const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
			union(a, b); union(b, c);
		}

		const stats = new Map();
		for (let i = 0; i < n; i++) {
			const r = find(i);
			const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
			let s = stats.get(r);
			if (!s) stats.set(r, { minX: x, maxX: x, minY: y, maxY: y, minZ: z, maxZ: z });
			else {
				if (x < s.minX) s.minX = x; else if (x > s.maxX) s.maxX = x;
				if (y < s.minY) s.minY = y; else if (y > s.maxY) s.maxY = y;
				if (z < s.minZ) s.minZ = z; else if (z > s.maxZ) s.maxZ = z;
			}
		}
		sink.buildings += stats.size;

		const dressed = new Map();
		for (const [r, s] of stats) {
			if ((s.maxY - s.minY) < gate) { sink.tooShort++; continue; }
			const id = idAt((s.minX + s.maxX) / 2, (s.minZ + s.maxZ) / 2);
			if (!neonLit(id)) { sink.undressed++; continue; }
			sink.lit++;
			dressed.set(r, { col: neonColourFor(id), roofY: s.maxY });
		}
		if (dressed.size === 0) return;

		const seen = new Set();
		const keys = new Array(n);
		for (let t = 0; t < tris; t++) {
			const v = [
				idx ? idx.getX(t * 3) : t * 3,
				idx ? idx.getX(t * 3 + 1) : t * 3 + 1,
				idx ? idx.getX(t * 3 + 2) : t * 3 + 2,
			];
			const d = dressed.get(find(v[0]));
			if (!d) continue;

			const ax0 = pos.getX(v[0]); const ay0 = pos.getY(v[0]); const az0 = pos.getZ(v[0]);
			const ux = pos.getX(v[1]) - ax0; const uy = pos.getY(v[1]) - ay0;
			const uz = pos.getZ(v[1]) - az0;
			const wx = pos.getX(v[2]) - ax0; const wy = pos.getY(v[2]) - ay0;
			const wz = pos.getZ(v[2]) - az0;
			const ny = uz * wx - ux * wz;
			const flen = Math.hypot(uy * wz - uz * wy, ny, ux * wy - uy * wx);
			if (flen > 0 && Math.abs(ny / flen) >= ROOF_NY) continue;
			for (let e = 0; e < 3; e++) {
				const a = v[e]; const b = v[(e + 1) % 3];
				if (keys[a] === undefined) keys[a] = keyOf(a);
				if (keys[b] === undefined) keys[b] = keyOf(b);
				const k = keys[a] < keys[b] ? `${keys[a]}|${keys[b]}` : `${keys[b]}|${keys[a]}`;
				if (seen.has(k)) continue;
				const ax = pos.getX(a); const ay = pos.getY(a); const az = pos.getZ(a);
				const bx = pos.getX(b); const by = pos.getY(b); const bz = pos.getZ(b);
				const vertical = Math.abs(ax - bx) < WELD_M && Math.abs(az - bz) < WELD_M
					&& Math.abs(ay - by) > VERT_MIN_DY;
				const roofline = !vertical
					&& Math.abs(ay - d.roofY) < ROOF_EPS && Math.abs(by - d.roofY) < ROOF_EPS;
				if (!vertical && !roofline) continue;
				seen.add(k);
				sink.pos.push(ax, ay, az, bx, by, bz);
				sink.col.push(d.col[0], d.col[1], d.col[2], d.col[0], d.col[1], d.col[2]);
			}
		}
	});
	return sink;
}

export function buildNeonEdges(root, opts = {}) {
	const minHeight = opts.minHeight === undefined ? NEON_MIN_HEIGHT_M : opts.minHeight;
	const sink = collect(root, { minHeight });
	const stats = {
		buildings: sink.buildings,
		lit: sink.lit,
		tooShort: sink.tooShort,
		undressed: sink.undressed,
		segments: sink.pos.length / 6,
		minHeight,
	};
	if (sink.pos.length === 0) return { group: null, stats, setResolution: () => {} };

	const geo = new LineSegmentsGeometry();
	geo.setPositions(sink.pos);
	geo.setColors(sink.col);

	const group = new THREE.Group();
	group.name = 'neon-edges';
	const mats = [];

	for (const [name, px, peak] of [['glow', GLOW_PX, GLOW_PEAK], ['core', CORE_PX, CORE_PEAK]]) {
		const mat = new LineMaterial({

			color: new THREE.Color(peak, peak, peak),
			linewidth: px,
			vertexColors: true,

			worldUnits: false,
			blending: THREE.AdditiveBlending,

			depthWrite: false,
			transparent: true,
			dashed: false,

			fog: true,
			toneMapped: true,
		});

		mat.resolution.set(1920, 1080);
		mats.push(mat);

		const lines = new LineSegments2(geo, mat);
		lines.name = `neon-edges-${name}`;
		lines.castShadow = false;
		lines.receiveShadow = false;

		lines.geometry.userData.neon = true;

		lines.computeLineDistances();
		group.add(lines);
	}

	root.add(group);
	stats.triangles = stats.segments * 2 * mats.length;
	stats.drawCalls = mats.length;
	return {
		group,
		stats,

		setResolution(w, h) { for (const m of mats) m.resolution.set(w, h); },
		dispose() {
			for (const m of mats) m.dispose();
			geo.dispose();
			if (group.parent) group.parent.remove(group);
		},
	};
}
