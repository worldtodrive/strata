

import * as THREE from 'three';

const CELL_M = 400;
const DRAW_M = 900;

const TRUNK_DRAW_M = 300;

const H_JITTER_LO = 0.82;
const H_JITTER_SPAN = 0.36;

function mergeParts(parts) {
	const pos = [];
	const nrm = [];
	for (const { geo, m } of parts) {
		const g = geo.index ? geo.toNonIndexed() : geo.clone();
		g.applyMatrix4(m);
		g.computeVertexNormals();
		const p = g.getAttribute('position');
		const n = g.getAttribute('normal');
		for (let i = 0; i < p.count; i++) {
			pos.push(p.getX(i), p.getY(i), p.getZ(i));
			nrm.push(n.getX(i), n.getY(i), n.getZ(i));
		}
		g.dispose();
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	return out;
}

const mat4 = (t, s, rz = 0, ry = 0) => new THREE.Matrix4().compose(
	t, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), s);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ico = () => new THREE.IcosahedronGeometry(1, 0);

function trunkGeo(rBase, rTop, sides, h) {
	const g = new THREE.CylinderGeometry(rTop, rBase, h, sides, 1, true);
	g.translate(0, h / 2, 0);
	return g;
}

function roundCanopy() {
	return mergeParts([
		{ geo: ico(), m: mat4(v3(0, 0.76, 0), v3(0.25, 0.21, 0.25)) },
		{ geo: ico(), m: mat4(v3(0.08, 0.64, -0.05), v3(0.18, 0.15, 0.18), 0.5) },
	]);
}

function spreadingCanopy() {
	return mergeParts([
		{ geo: ico(), m: mat4(v3(0, 0.72, 0), v3(0.26, 0.15, 0.26)) },
		{ geo: ico(), m: mat4(v3(0.15, 0.68, 0.06), v3(0.19, 0.12, 0.19), 0.4) },
		{ geo: ico(), m: mat4(v3(-0.13, 0.69, -0.08), v3(0.17, 0.11, 0.17), -0.3) },
	]);
}

function columnarCanopy() {
	return mergeParts([
		{ geo: ico(), m: mat4(v3(0, 0.62, 0), v3(0.13, 0.22, 0.13)) },
		{ geo: ico(), m: mat4(v3(0, 0.85, 0), v3(0.11, 0.17, 0.11), 0.6) },
	]);
}

function tieredCanopy() {
	return mergeParts([
		{ geo: ico(), m: mat4(v3(0, 0.6, 0), v3(0.26, 0.07, 0.26)) },
		{ geo: ico(), m: mat4(v3(0, 0.74, 0), v3(0.22, 0.06, 0.22), 0.5) },
		{ geo: ico(), m: mat4(v3(0, 0.87, 0), v3(0.15, 0.055, 0.15), 1.0) },
	]);
}

function weepingCanopy() {
	const parts = [{ geo: ico(), m: mat4(v3(0, 0.82, 0), v3(0.2, 0.13, 0.2)) }];
	const BLADES = 8;
	for (let i = 0; i < BLADES; i++) {
		const a = (i / BLADES) * Math.PI * 2 + (i % 2) * 0.2;
		parts.push({
			geo: frondGeo(4),
			m: new THREE.Matrix4().makeTranslation(0, 0.86, 0)
				.multiply(new THREE.Matrix4().makeRotationY(a))

				.multiply(new THREE.Matrix4().makeRotationZ(-0.55))
				.multiply(new THREE.Matrix4().makeScale(0.34, 0.34, 0.34)),
		});
	}
	return mergeParts(parts);
}

function pyramidalCanopy() {
	return mergeParts([
		{ geo: ico(), m: mat4(v3(0, 0.62, 0), v3(0.24, 0.11, 0.24)) },
		{ geo: ico(), m: mat4(v3(0, 0.76, 0), v3(0.18, 0.1, 0.18), 0.5) },
		{ geo: ico(), m: mat4(v3(0, 0.89, 0), v3(0.11, 0.08, 0.11), 1.0) },
	]);
}

function coniferCanopy() {
	return mergeParts([
		{ geo: new THREE.ConeGeometry(1, 1, 7), m: mat4(v3(0, 0.54, 0), v3(0.21, 0.50, 0.21)) },
		{ geo: new THREE.ConeGeometry(1, 1, 7), m: mat4(v3(0, 0.81, 0), v3(0.14, 0.36, 0.14)) },
	]);
}

function frondGeo(segments = 5) {
	const pos = [];
	const shape = (u) => ({
		x: u,
		y: 0.20 * u - 0.95 * u * u,
		w: 0.22 * Math.sin(Math.PI * Math.pow(u, 0.8)) * (1 - 0.15 * u),
	});
	const RIDGE = 0.055;
	for (let i = 0; i < segments; i++) {
		const a = shape(i / segments);
		const b = shape((i + 1) / segments);
		for (const s of [-1, 1]) {
			pos.push(a.x, a.y + RIDGE * a.w, 0, b.x, b.y + RIDGE * b.w, 0, b.x, b.y, s * b.w);
			pos.push(a.x, a.y + RIDGE * a.w, 0, b.x, b.y, s * b.w, a.x, a.y, s * a.w);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
}

function palmCrown() {
	const parts = [];
	const FRONDS = 11;
	const L = 0.17;
	for (let i = 0; i < FRONDS; i++) {
		const a = (i / FRONDS) * Math.PI * 2 + (i % 2) * 0.16;

		const pitch = 0.30 - 0.25 * (i % 3);
		parts.push({
			geo: frondGeo(),
			m: new THREE.Matrix4().makeTranslation(0, 0.965, 0)
				.multiply(new THREE.Matrix4().makeRotationY(a))
				.multiply(new THREE.Matrix4().makeRotationZ(pitch))
				.multiply(new THREE.Matrix4().makeScale(L, L, L)),
		});
	}

	parts.push({ geo: ico(), m: mat4(v3(0, 0.955, 0), v3(0.028, 0.035, 0.028)) });
	return mergeParts(parts);
}

const CROWN_GAIN_XZ = 1.30;
const CROWN_GAIN_Y = 1.15;
const CROWN_DROP = 0.10;


function proportion(g) {
	g.scale(CROWN_GAIN_XZ, CROWN_GAIN_Y, CROWN_GAIN_XZ);
	g.translate(0, -CROWN_DROP, 0);
	return g;
}

const SHAPES = {
	round: { geo: () => proportion(roundCanopy()), trunkTop: 0.62, trunkR: [0.030, 0.018], side: THREE.FrontSide },
	spreading: { geo: () => proportion(spreadingCanopy()), trunkTop: 0.60, trunkR: [0.036, 0.022], side: THREE.FrontSide },
	columnar: { geo: () => proportion(columnarCanopy()), trunkTop: 0.60, trunkR: [0.026, 0.016], side: THREE.FrontSide },
	tiered: { geo: () => proportion(tieredCanopy()), trunkTop: 0.62, trunkR: [0.030, 0.017], side: THREE.FrontSide },
	weeping: { geo: () => proportion(weepingCanopy()), trunkTop: 0.59, trunkR: [0.028, 0.018], side: THREE.DoubleSide },
	pyramidal: { geo: () => proportion(pyramidalCanopy()), trunkTop: 0.63, trunkR: [0.030, 0.017], side: THREE.FrontSide },
	conifer: { geo: () => proportion(coniferCanopy()), trunkTop: 0.56, trunkR: [0.034, 0.014], side: THREE.FrontSide },

	palm: { geo: palmCrown, trunkTop: 0.97, trunkR: [0.014, 0.011], side: THREE.DoubleSide },
};

const SHAPE_OF = {
	maple: 'tiered', oak: 'spreading', poplar: 'columnar', ginkgo: 'pyramidal',
	sweetgum: 'round', liveoak: 'round', jacaranda: 'weeping',
	conifer: 'conifer', palm: 'palm',
};

const LEAF = {
	maple: 0x5e8f3a,
	oak: 0x496f2e,
	poplar: 0x6d9a44,
	ginkgo: 0x7aa63f,
	sweetgum: 0x44743e,
	liveoak: 0x3d6634,
	jacaranda: 0x5a8440,

	conifer: 0x3f6b46,
	palm: 0x5d8a3c,
};
const BARK = 0x6b5136;

const TINT_SPREAD = 0.18;

function hash01(n) {
	let h = n >>> 0;
	h ^= h >>> 16;
	h = Math.imul(h, 0x7feb352d);
	h ^= h >>> 15;
	h = Math.imul(h, 0x846ca68b);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

const reachCache = new Map();
export function canopyReachFraction(shapeId) {
	let f = reachCache.get(shapeId);
	if (f === undefined) {
		const g = (SHAPES[shapeId] || SHAPES.round).geo();
		g.computeBoundingBox();
		const b = g.boundingBox;
		f = b ? Math.max(Math.abs(b.min.x), b.max.x, Math.abs(b.min.z), b.max.z) : 0;
		g.dispose();
		reachCache.set(shapeId, f);
	}
	return f;
}
export { SHAPE_OF, SHAPES, H_JITTER_LO, H_JITTER_SPAN };

export async function buildTrees(url, opts = {}) {
	const t0 = performance.now();
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = await res.json();
	const rows = data.trees || [];
	if (!rows.length) return null;

	const kinds = data.kinds || null;
	const names = data.archetypes || ['broadleaf', 'conifer', 'palm'];
	const ARCH_KIND = { broadleaf: 'oak', conifer: 'conifer', palm: 'palm' };

	const group = new THREE.Group();
	group.name = 'trees';

	const bark = new THREE.MeshStandardMaterial({
		name: 'tree-bark', color: BARK, roughness: 0.95, metalness: 0,
	});

	const geoOf = {};
	const matOf = {};
	const trunkOf = {};
	const familyOf = (kind) => {
		if (!geoOf[kind]) {
			const shapeId = SHAPE_OF[kind] || 'round';
			const S = SHAPES[shapeId];
			geoOf[kind] = S.geo();
			trunkOf[kind] = trunkGeo(S.trunkR[0], S.trunkR[1], 6, S.trunkTop);

			matOf[kind] = new THREE.MeshStandardMaterial({
				name: `leaf-${kind}`, color: LEAF[kind] || LEAF.oak,
				roughness: 0.88, metalness: 0, flatShading: true, side: S.side,
			});
		}
		return kind;
	};

	const cells = new Map();
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const kind = (kinds && kinds[r[5]]) || ARCH_KIND[names[r[3]]] || 'oak';
		familyOf(kind);
		const key = `${Math.floor(r[0] / CELL_M)},${Math.floor(r[2] / CELL_M)}`;
		let c = cells.get(key);
		if (!c) { c = new Map(); cells.set(key, c); }
		let list = c.get(kind);
		if (!list) { list = []; c.set(kind, list); }
		list.push(i);
	}

	const colour = new THREE.Color();
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const pos = new THREE.Vector3();
	const scl = new THREE.Vector3();
	const up = new THREE.Vector3(0, 1, 0);
	const parts = [];
	let triangles = 0;
	const perKind = {};

	for (const [, byKind] of cells) {
		for (const [kind, idx] of byKind) {

			idx.sort((a, b) => hash01(a * 2654435761) - hash01(b * 2654435761));

			const n = idx.length;
			perKind[kind] = (perKind[kind] || 0) + n;
			const crown = new THREE.InstancedMesh(geoOf[kind], matOf[kind], n);
			const stem = new THREE.InstancedMesh(trunkOf[kind], bark, n);
			crown.name = `trees.${kind}.canopy`;
			stem.name = `trees.${kind}.trunk`;

			for (let k = 0; k < n; k++) {
				const r = rows[idx[k]];
				const seed = idx[k];
				const h = r[4] * (H_JITTER_LO + hash01(seed * 9781) * H_JITTER_SPAN);
				pos.set(r[0], r[1], r[2]);

				q.setFromAxisAngle(up, hash01(seed * 40503) * Math.PI * 2);
				scl.set(h, h, h);
				m.compose(pos, q, scl);
				crown.setMatrixAt(k, m);
				stem.setMatrixAt(k, m);

				const v = 1 + (hash01(seed * 22699) - 0.5) * TINT_SPREAD;
				colour.setRGB(v, v, v);
				crown.setColorAt(k, colour);
			}
			crown.instanceMatrix.needsUpdate = true;
			if (crown.instanceColor) crown.instanceColor.needsUpdate = true;
			stem.instanceMatrix.needsUpdate = true;
			crown.computeBoundingSphere();
			stem.computeBoundingSphere();
			group.add(crown, stem);
			parts.push({ crown, stem, n });
			triangles += n * (geoOf[kind].attributes.position.count / 3);
			triangles += n * (trunkOf[kind].attributes.position.count / 3);
		}
	}

	let density = opts.density === undefined ? 1 : opts.density;
	let drawM = opts.draw === undefined ? DRAW_M : opts.draw;
	const centre = new THREE.Vector3();

	function applyDensity() {
		for (const p of parts) {
			const want = Math.round(p.n * density);
			p.crown.count = want;
			p.stem.count = want;
		}
	}
	applyDensity();

	const mix = Object.entries(perKind).sort((a, b) => b[1] - a[1])
		.map(([k, v]) => `${k} ${v}`).join(', ');
	const report = `${rows.length} trees in ${cells.size} cells, `
		+ `${Math.round(triangles).toLocaleString()} triangles, `
		+ `${group.children.length} draw calls`;
	;

	return {
		group,
		count: rows.length,
		cells: cells.size,
		triangles: Math.round(triangles),
		families: perKind,
		mix,
		report,
		planted: data.report || {},

		setDensity(f) {
			density = Math.max(0, Math.min(1, f));
			applyDensity();
		},
		get density() { return density; },
		setDraw(mtr) { drawM = Math.max(0, mtr); },
		get draw() { return drawM; },

		update(camera) {
			if (!group.visible) return;
			for (const p of parts) {
				const s = p.crown.boundingSphere;
				if (!s) continue;
				centre.copy(s.center);
				const d = centre.distanceTo(camera) - s.radius;
				p.crown.visible = drawM <= 0 || d < drawM;
				p.stem.visible = p.crown.visible && d < TRUNK_DRAW_M;
			}
		},
	};
}
