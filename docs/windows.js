

import * as THREE from 'three';

const WINDOW_PITCH_M = 3.2;
const WINDOW_W_M = 1.35;
const WINDOW_H_M = 1.5;

const STOREY_M = 3.2;

const WINDOW_MARGIN_M = 1.0;

const WINDOW_SINGLE_M = 2.6;

const WINDOW_HEADER_M = 0.85;
const WINDOW_SILL_MIN_M = 0.8;

const WINDOW_ROWS_MAX = 40;

const WINDOW_OUT_M = 0.06;

const GLASS_FLOOR = [0.125, 0.135, 0.165];
const GLASS_WALL_BLEED = 0.035;

const GLASS_MAX_VS_WALL = 0.62;

const GLASS_JITTER = 0.18;

const LIT_SHARE = 0.62;

const LIT_COLOUR = [1.0, 0.86, 0.62];

const LIT_GAIN = 0.55;

const LIT_JITTER = 0.5;

const lum = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;
const frac = (x) => x - Math.floor(x);

export const WINDOW_SIZES = {
	upstream: {
		label: 'standard (2-3 storey)',
		blurb: 'Their numbers exactly: 1.35 x 1.5 m panes at a 3.2 m pitch on a 3.2 m storey.',
		scale: 1.0,
	},
	large: {
		label: 'large panes',
		blurb: 'Half again as big and pitched to match. Fewer, bigger holes — reads at more '
			+ 'distance and aliases less, at the cost of looking less like a house.',
		scale: 1.5,
	},
	tower: {
		label: 'tower (Manhattan)',
		blurb: 'Double. ⚠️ Upstream sized their windows for a 7 m median building and warned '
			+ 'in writing that towers need their own; on nycwhole the small pane is a slit.',
		scale: 2.0,
	},
};
export const DEFAULT_WINDOW_SIZE = 'upstream';

const MAX_WINDOWS = 200000;

const ROOF_NY = 0.5;

const PLAN_M = 0.05;

export function windowSlots(edgeLen, size) {
	const pitch = WINDOW_PITCH_M * size.scale;
	const margin = WINDOW_MARGIN_M * size.scale;
	const single = WINDOW_SINGLE_M * size.scale;
	let n = Math.floor((edgeLen - 2 * margin) / pitch);
	if (n < 1) n = edgeLen >= single ? 1 : 0;
	if (n < 1) return [];
	const span = (n - 1) * pitch;
	const start = (edgeLen - span) / 2;
	const out = [];
	for (let k = 0; k < n; k += 1) out.push(start + k * pitch);
	return out;
}

function seedAt(x, z, row) {
	let h = (Math.imul(Math.round(x * 8) | 0, 0x9e3779b1)
		^ Math.imul(Math.round(z * 8) | 0, 0x85ebca6b)
		^ Math.imul(row + 1, 0xc2b2ae35)) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x27d4eb2d);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

export function groundGrid(root, cellM = 6) {
	if (!root) return null;
	let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity;
	const parts = [];
	const v = new THREE.Vector3();
	root.traverse((o) => {
		if (!o.isMesh || !o.geometry) return;
		const p = o.geometry.getAttribute('position');
		if (!p) return;
		o.updateWorldMatrix(true, false);
		parts.push({ p, m: o.matrixWorld });
		for (let i = 0; i < p.count; i++) {
			v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
			if (v.x < minX) minX = v.x;
			if (v.x > maxX) maxX = v.x;
			if (v.z < minZ) minZ = v.z;
			if (v.z > maxZ) maxZ = v.z;
		}
	});
	if (!parts.length || !isFinite(minX)) return null;
	const nx = Math.max(1, Math.ceil((maxX - minX) / cellM) + 1);
	const nz = Math.max(1, Math.ceil((maxZ - minZ) / cellM) + 1);
	const grid = new Float32Array(nx * nz).fill(-Infinity);
	for (const part of parts) {
		const p = part.p;
		for (let i = 0; i < p.count; i++) {
			v.fromBufferAttribute(p, i).applyMatrix4(part.m);
			const ix = Math.min(nx - 1, Math.max(0, Math.round((v.x - minX) / cellM)));
			const iz = Math.min(nz - 1, Math.max(0, Math.round((v.z - minZ) / cellM)));
			const k = iz * nx + ix;
			if (v.y > grid[k]) grid[k] = v.y;
		}
	}
	return {
		cells: nx * nz,
		at(x, z) {
			const ix = Math.round((x - minX) / cellM);
			const iz = Math.round((z - minZ) / cellM);

			let best = -Infinity;
			for (let dz = -1; dz <= 1; dz++) {
				for (let dx = -1; dx <= 1; dx++) {
					const jx = ix + dx;
					const jz = iz + dz;
					if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
					const y = grid[jz * nx + jx];
					if (y > best) best = y;
				}
			}
			return isFinite(best) ? best : null;
		},
	};
}

function wallQuads(geo) {
	const pos = geo.getAttribute('position');
	const col = geo.getAttribute('color');
	if (!pos) return [];
	const idx = geo.index;
	const n = pos.count;
	const tris = idx ? idx.count / 3 : n / 3;
	const byEdge = new Map();
	for (let t = 0; t < tris; t++) {
		const a = idx ? idx.getX(t * 3) : t * 3;
		const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
		const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
		const ax = pos.getX(a); const ay = pos.getY(a); const az = pos.getZ(a);
		const bx = pos.getX(b); const by = pos.getY(b); const bz = pos.getZ(b);
		const cx = pos.getX(c); const cy = pos.getY(c); const cz = pos.getZ(c);
		const ux = bx - ax; const uy = by - ay; const uz = bz - az;
		const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
		let fx = uy * vz - uz * vy;
		const fy = uz * vx - ux * vz;
		let fz = ux * vy - uy * vx;
		const L = Math.hypot(fx, fy, fz);
		if (L <= 0) continue;
		if (Math.abs(fy / L) >= ROOF_NY) continue;
		fx /= L; fz /= L;

		const pts = [[ax, az], [bx, bz], [cx, cz]];
		const p0 = pts[0];
		let p1 = null;
		for (const p of pts) {
			if (Math.hypot(p[0] - p0[0], p[1] - p0[1]) > PLAN_M) { p1 = p; break; }
		}
		if (!p1) continue;
		const k0 = `${Math.round(p0[0] / PLAN_M)},${Math.round(p0[1] / PLAN_M)}`;
		const k1 = `${Math.round(p1[0] / PLAN_M)},${Math.round(p1[1] / PLAN_M)}`;
		const key = k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`;
		let q = byEdge.get(key);
		if (!q) {

			q = {
				ax: p0[0], az: p0[1], bx: p1[0], bz: p1[1],
				top: -Infinity, base: Infinity, nx: fx, nz: fz,
				r: 1, g: 1, b: 1, colY: -Infinity,
			};
			byEdge.set(key, q);
		}
		for (const vi of [a, b, c]) {
			const y = pos.getY(vi);
			if (y > q.top) q.top = y;
			if (y < q.base) q.base = y;

			if (col && y > q.colY) {
				q.colY = y;
				q.r = col.getX(vi); q.g = col.getY(vi); q.b = col.getZ(vi);
			}
		}
	}
	const out = [];
	for (const q of byEdge.values()) {
		q.len = Math.hypot(q.bx - q.ax, q.bz - q.az);
		if (q.len > PLAN_M) out.push(q);
	}
	return out;
}

export function buildWindows(root, opts = {}) {
	const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
	const size = WINDOW_SIZES[opts.size] || WINDOW_SIZES[DEFAULT_WINDOW_SIZE];
	const ground = opts.ground || null;
	const budget = opts.budget || MAX_WINDOWS;
	const sinkM = opts.sinkM !== undefined ? opts.sinkM : 1.0;

	const lit = !!opts.lit;

	const quads = [];
	root.traverse((o) => {
		if (!o.isMesh || !o.geometry) return;
		if (o.geometry.userData && o.geometry.userData.windows) return;

		if (o.geometry.userData && o.geometry.userData.neon) return;
		for (const q of wallQuads(o.geometry)) quads.push(q);
	});

	quads.sort((a, b) => b.len - a.len);
	const w = WINDOW_W_M * size.scale;
	const h = WINDOW_H_M * size.scale;
	const storey = STOREY_M * size.scale;
	const header = WINDOW_HEADER_M * size.scale;
	const sill = WINDOW_SILL_MIN_M * size.scale;

	const pos = [];
	const col = [];

	const glow = [];
	let windowsLit = 0;
	let windows = 0;
	let walls = 0;
	let buried = 0;
	let flipped = 0;

	const ready = [];
	for (const q of quads) {
		const slots = windowSlots(q.len, size);
		if (!slots.length) continue;
		walls++;
		ready.push(q);
		const tx = (q.bx - q.ax) / q.len;
		const tz = (q.bz - q.az) / q.len;

		let gr = GLASS_FLOOR[0] + q.r * GLASS_WALL_BLEED;
		let gg = GLASS_FLOOR[1] + q.g * GLASS_WALL_BLEED;
		let gb = GLASS_FLOOR[2] + q.b * GLASS_WALL_BLEED;
		const wallLum = lum(q.r, q.g, q.b);
		const glassLum = lum(gr, gg, gb);
		if (glassLum > wallLum * GLASS_MAX_VS_WALL) {
			const k = (wallLum * GLASS_MAX_VS_WALL) / Math.max(glassLum, 1e-6);
			gr *= k; gg *= k; gb *= k;
		}

		q.tx = tx; q.tz = tz;
		q.gr = gr; q.gg = gg; q.gb = gb;
		q.slots = slots;
	}

	const rowsOn = (q, floor) => {
		const span = q.top - header - h - floor;
		if (span < 0) return 0;
		return Math.min(WINDOW_ROWS_MAX, Math.floor(span / storey) + 1);
	};

	const floorAt = (q, wx, wz) => {
		const gy = ground ? ground.at(wx, wz) : null;
		const sunk = q.base + sinkM + sill;
		return Math.max(sunk, gy === null ? -Infinity : gy + 0.15);
	};
	const emit = (q, d, row, floor) => {
		const wx = q.ax + q.tx * d;
		const wz = q.az + q.tz * d;
		const top = q.top - header - row * storey;
		const t = seedAt(wx, wz, row);
		const jitter = 1 - GLASS_JITTER / 2 + frac(t * 23.9) * GLASS_JITTER;

		let gv = 0;
		if (lit) {
			const s = frac(t * 51.3);
			if (s < LIT_SHARE) {
				gv = LIT_GAIN * (1 - LIT_JITTER / 2 + frac(t * 97.1) * LIT_JITTER);
				windowsLit++;
			}
		}
		flipped += pushQuad(pos, col, glow, gv, wx, wz, q.tx, q.tz, q.nx, q.nz, top - h, top,
			w / 2, q.gr * jitter, q.gg * jitter, q.gb * jitter);
		windows++;
	};

	let bound = 0;
	for (const q of ready) {
		for (const d of q.slots) {
			const floor = floorAt(q, q.ax + q.tx * d, q.az + q.tz * d);
			const sunk = q.base + sinkM + sill;
			if (floor > sunk + 0.01) buried++;
			const n = rowsOn(q, floor);
			if (n < 1) continue;
			if (windows >= budget) { bound++; continue; }
			emit(q, d, n - 1, floor);
		}
	}

	for (const q of ready) {
		if (windows >= budget) break;
		for (const d of q.slots) {
			const floor = floorAt(q, q.ax + q.tx * d, q.az + q.tz * d);
			const n = rowsOn(q, floor);
			for (let row = 0; row < n - 1; row++) {
				if (windows >= budget) break;
				emit(q, d, row, floor);
			}
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeVertexNormals();
	geo.computeBoundingSphere();

	geo.userData.windows = true;

	const mat = new THREE.MeshStandardMaterial({
		color: 0xffffff, roughness: 0.95, metalness: 0.0, vertexColors: true,
	});
	if (lit) {
		geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));

		mat.userData.nightUniform = { value: 0 };
		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uNight = mat.userData.nightUniform;
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nuniform float uNight;');
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>',
					'#include <common>\nattribute float glow;\nvarying float vGlow;')
				.replace('#include <begin_vertex>',
					'#include <begin_vertex>\nvGlow = glow;');
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>',
					'#include <common>\nvarying float vGlow;')

				.replace('#include <emissivemap_fragment>',
					'#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3('
					+ `${LIT_COLOUR[0]}, ${LIT_COLOUR[1]}, ${LIT_COLOUR[2]}) * vGlow * uNight;`);
		};

		mat.customProgramCacheKey = () => 'windows-lit';
	}
	const mesh = new THREE.Mesh(geo, mat);
	mesh.name = 'window-glass';

	mesh.castShadow = false;
	mesh.receiveShadow = true;

	const group = new THREE.Group();
	group.name = 'windows';
	group.add(mesh);
	return {
		group,

		nightUniform: lit ? mat.userData.nightUniform : null,
		windows,

		windowsLit,
		lit,
		walls,
		buried,
		flipped,
		quads: quads.length,

		dropped: bound,
		clipped: windows >= budget,
		triangles: pos.length / 9,
		ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0,
	};
}

function pushQuad(pos, col, glow, gv, cx, cz, tx, tz, nx, nz, yb, yt, hw, r, g, b) {
	const px = cx + nx * WINDOW_OUT_M;
	const pz = cz + nz * WINDOW_OUT_M;
	const v = [
		[px - tx * hw, yb, pz - tz * hw],
		[px + tx * hw, yb, pz + tz * hw],
		[px + tx * hw, yt, pz + tz * hw],
		[px - tx * hw, yt, pz - tz * hw],
	];
	const ux = v[1][0] - v[0][0]; const uy = v[1][1] - v[0][1]; const uz = v[1][2] - v[0][2];
	const wx = v[2][0] - v[0][0]; const wy = v[2][1] - v[0][1]; const wz = v[2][2] - v[0][2];
	const fx = uy * wz - uz * wy;
	const fz = ux * wy - uy * wx;
	const keep = (fx * nx + fz * nz) >= 0;
	const order = keep ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
	for (const k of order) {
		pos.push(v[k][0], v[k][1], v[k][2]);
		col.push(r, g, b);

		glow.push(gv);
	}

	return keep ? 0 : 1;
}
