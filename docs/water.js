

import * as THREE from 'three';

export const WATER_NUDGE_M = 0.20;

const HORIZON_M = 8000;

const WATER_COLOR = 0x21506e;

const INNER_EPS_M = 0.25;

const SHORE_CLEAR_M = 0.15;

const BUCKETS = 64;

function prepare(ring) {
	let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
	for (const [x, z] of ring) {
		if (x < x0) x0 = x;
		if (x > x1) x1 = x;
		if (z < z0) z0 = z;
		if (z > z1) z1 = z;
	}
	const span = (z1 - z0) || 1;
	const buckets = Array.from({ length: BUCKETS }, () => []);
	const band = (z) => Math.min(BUCKETS - 1,
		Math.max(0, Math.floor((z - z0) / span * BUCKETS)));
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i], b = ring[j];
		const lo = band(Math.min(a[1], b[1]));
		const hi = band(Math.max(a[1], b[1]));
		for (let k = lo; k <= hi; k++) buckets[k].push(a[0], a[1], b[0], b[1]);
	}
	return {
		bounds: [x0, z0, x1, z1],
		buckets: buckets.map((b) => Float64Array.from(b)),
		z0, span,
	};
}

function inPrepared(x, z, prep) {
	const [x0, z0, x1, z1] = prep.bounds;
	if (x < x0 || x > x1 || z < z0 || z > z1) return false;
	const index = Math.min(BUCKETS - 1,
		Math.max(0, Math.floor((z - prep.z0) / prep.span * BUCKETS)));
	const edges = prep.buckets[index];
	let inside = false;
	for (let i = 0; i < edges.length; i += 4) {
		const ax = edges[i], az = edges[i + 1], bx = edges[i + 2], bz = edges[i + 3];
		if ((az > z) !== (bz > z)
			&& x < (bx - ax) * (z - az) / (bz - az + 1e-30) + ax) {
			inside = !inside;
		}
	}
	return inside;
}

export async function loadWaterRings(meta, href) {
	const file = meta && meta.water && meta.water.file;
	if (!file) return null;
	const response = await fetch(href);
	if (!response.ok) return null;
	const document = await response.json();
	for (const polygon of document.polygons || []) {
		polygon.prep = prepare(polygon.outer);
		polygon.holePreps = (polygon.holes || []).map(prepare);
	}
	return document;
}

function isWet(x, z, rings) {
	for (const polygon of rings.polygons) {
		if (!inPrepared(x, z, polygon.prep)) continue;
		let inHole = false;
		for (const hole of polygon.holePreps) {
			if (inPrepared(x, z, hole)) { inHole = true; break; }
		}
		if (!inHole) return true;
	}
	return false;
}

export function dropCoverInWater(root, rings) {
	if (!rings || !rings.polygons || !rings.polygons.length) return 0;
	let dropped = 0;

	root.traverse((object) => {
		if (!object.isMesh || !object.geometry) return;
		const geometry = object.geometry;
		const position = geometry.getAttribute('position');
		if (!position) return;
		const array = position.array;
		const index = geometry.index;
		const count = index ? index.count : position.count;
		const read = index ? (i) => index.getX(i) : (i) => i;

		const kept = [];
		let hit = 0;
		for (let t = 0; t < count; t += 3) {
			const a = read(t), b = read(t + 1), c = read(t + 2);
			const cx = (array[a * 3] + array[b * 3] + array[c * 3]) / 3;
			const cz = (array[a * 3 + 2] + array[b * 3 + 2] + array[c * 3 + 2]) / 3;
			if (isWet(cx, cz, rings)) { hit++; continue; }
			kept.push(a, b, c);
		}
		if (hit) {
			dropped += hit;
			geometry.setIndex(kept);
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	});
	return dropped;
}

export function clipGroundToWater(root, rings, { level = null } = {}) {
	if (!rings || !rings.polygons || !rings.polygons.length) {
		return { dropped: 0, clipped: 0, before: 0, after: 0 };
	}

	if (rings.polygons.some((p) => p.floor || p.keep_ground)) {
		rings = { ...rings, polygons: rings.polygons.filter((p) => !(p.floor || p.keep_ground)) };
		if (!rings.polygons.length) return { dropped: 0, clipped: 0, before: 0, after: 0 };
	}
	let dropped = 0;
	let clipped = 0;
	let before = 0;
	let after = 0;

	root.traverse((object) => {
		if (!object.isMesh || !object.geometry) return;
		const geometry = object.geometry;
		const position = geometry.getAttribute('position');
		if (!position) return;

		const names = Object.keys(geometry.attributes);
		const attributes = names.map((n) => geometry.getAttribute(n));
		const positionSlot = names.indexOf('position');
		if (positionSlot < 0) return;
		const out = names.map(() => []);

		const index = geometry.index;
		const count = index ? index.count : position.count;
		const read = index ? (i) => index.getX(i) : (i) => i;
		before += count / 3;

		const vertexAt = (v) => attributes.map((attr) => {
			const items = new Array(attr.itemSize);
			for (let k = 0; k < attr.itemSize; k++) {
				items[k] = attr.array[v * attr.itemSize + k];
			}
			return items;
		});
		const lerp = (p, q, t) => p.map(
			(items, a) => items.map((value, k) => value + (q[a][k] - value) * t));
		const emit = (p) => {
			for (let a = 0; a < out.length; a++) {
				for (let k = 0; k < p[a].length; k++) out[a].push(p[a][k]);
			}
		};

		const cache = new Map();
		const inRing = (v) => {
			let seen = cache.get(v);
			if (seen === undefined) {
				seen = isWet(position.array[v * 3], position.array[v * 3 + 2], rings);
				cache.set(v, seen);
			}
			return seen;
		};

		for (let t = 0; t < count; t += 3) {
			const ia = read(t), ib = read(t + 1), ic = read(t + 2);

			if (!(inRing(ia) || inRing(ib) || inRing(ic))) {
				emit(vertexAt(ia)); emit(vertexAt(ib)); emit(vertexAt(ic));
				continue;
			}
			const A = vertexAt(ia), B = vertexAt(ib), C = vertexAt(ic);
			if (level === null) { dropped++; continue; }
			const verts = [A, B, C];

			const cut = level + SHORE_CLEAR_M;
			const d = [A[positionSlot][1] - cut,
				B[positionSlot][1] - cut,
				C[positionSlot][1] - cut];
			if (d[0] <= 0 && d[1] <= 0 && d[2] <= 0) { dropped++; continue; }

			if (d[0] >= 0 && d[1] >= 0 && d[2] >= 0) {
				emit(A); emit(B); emit(C);
				continue;
			}

			const poly = [];
			for (let i = 0; i < 3; i++) {
				const j = (i + 1) % 3;
				if (d[i] >= 0) poly.push(verts[i]);
				if ((d[i] >= 0) !== (d[j] >= 0)) {
					poly.push(lerp(verts[i], verts[j], d[i] / (d[i] - d[j])));
				}
			}
			for (let i = 1; i + 1 < poly.length; i++) {
				emit(poly[0]); emit(poly[i]); emit(poly[i + 1]);
			}
			clipped++;
		}

		after += out[positionSlot].length / 9;
		geometry.setIndex(null);
		for (let a = 0; a < names.length; a++) {
			const itemSize = attributes[a].itemSize;
			const array = new Float32Array(out[a]);
			if (names[a] === 'normal') {
				for (let v = 0; v < array.length; v += 3) {
					const n = Math.hypot(array[v], array[v + 1], array[v + 2]) || 1;
					array[v] /= n; array[v + 1] /= n; array[v + 2] /= n;
				}
			}
			geometry.setAttribute(names[a],
				new THREE.BufferAttribute(array, itemSize));
		}
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	});
	return { dropped, clipped, before, after };
}

export function waterLevel(meta) {
	if (meta && meta.water && typeof meta.water.y === 'number') {
		return { y: meta.water.y + WATER_NUDGE_M, source: 'sidecar' };
	}
	const zref = (meta && typeof meta.zref === 'number') ? meta.zref : 0;
	return { y: -zref + WATER_NUDGE_M, source: 'zref (assumes surface_z 0)' };
}

function buildRingGeometry(rings, {
	base = 0, filter = null, holesFor = null, reach = true, unflattened = false,
} = {}) {
	const pos = [];
	let polys = 0;
	let holes = 0;
	let tris = 0;

	const toV2 = (ring) => {
		const pts = ring.map(([x, z]) => new THREE.Vector2(x, z));

		if (pts.length > 1) {
			const a = pts[0];
			const b = pts[pts.length - 1];
			if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
		}
		return pts;
	};

	for (const polygon of rings.polygons || []) {
		if (filter && !filter(polygon)) continue;

		if (polygon.sheet === false && !unflattened) continue;

		const grown = reach && Array.isArray(polygon.sheet_outer);
		const outer = toV2((grown ? polygon.sheet_outer : polygon.outer) || []);
		if (outer.length < 3) continue;

		const dy = (typeof polygon.y === 'number') ? polygon.y - base : 0;

		if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
		const inner = [];
		const honourHoles = holesFor ? !!holesFor(polygon) : false;
		if (honourHoles) {
			for (const hole of (grown ? polygon.sheet_holes : polygon.holes) || []) {
				const h = toV2(hole);
				if (h.length < 3) continue;
				if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
				inner.push(h);
			}
		}
		let faces;
		try {
			faces = THREE.ShapeUtils.triangulateShape(outer, inner);
		} catch (err) {

			console.warn('[water] ring failed to triangulate, skipped:', err);
			continue;
		}
		const verts = outer.concat(...inner);
		for (const face of faces) {
			for (const index of face) {
				const v = verts[index];
				if (!v) continue;

				pos.push(v.x, dy, v.y);
			}
			tris++;
		}
		polys++;
		holes += inner.length;
	}

	if (!pos.length) return null;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.computeVertexNormals();
	geo.computeBoundingBox();
	geo.computeBoundingSphere();
	geo.userData.stats = { polys, holes, tris };
	return geo;
}

export function nearShore(rings, metres) {
	const floored = (rings && rings.polygons || []).filter((p) => p.floor);
	if (!floored.length) return null;
	const grid = new Map();
	const cellOf = (v) => Math.floor(v / metres);
	let segments = 0;
	for (const p of floored) {
		const loops = [p.shore_outer || p.outer, ...((p.shore_outer ? p.shore_holes : p.holes) || [])];
		for (const ring of loops) {
			if (!ring || ring.length < 2) continue;
			for (let i = 0; i + 1 < ring.length; i++) {
				const [ax, az] = ring[i];
				const [bx, bz] = ring[i + 1];
				for (let cx = cellOf(Math.min(ax, bx)); cx <= cellOf(Math.max(ax, bx)); cx++) {
					for (let cz = cellOf(Math.min(az, bz)); cz <= cellOf(Math.max(az, bz)); cz++) {
						const key = `${cx},${cz}`;
						let list = grid.get(key);
						if (!list) { list = []; grid.set(key, list); }
						list.push(ax, az, bx, bz);
					}
				}
				segments++;
			}
		}
	}
	const r2 = metres * metres;
	return {
		segments,
		test(x, z) {
			const cx = cellOf(x);
			const cz = cellOf(z);
			for (let i = cx - 1; i <= cx + 1; i++) {
				for (let j = cz - 1; j <= cz + 1; j++) {
					const list = grid.get(`${i},${j}`);
					if (!list) continue;
					for (let k = 0; k < list.length; k += 4) {
						const ax = list[k], az = list[k + 1];
						const dx = list[k + 2] - ax, dz = list[k + 3] - az;
						const len2 = dx * dx + dz * dz;
						const t = len2 > 0
							? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
						const ex = ax + t * dx - x, ez = az + t * dz - z;
						if (ex * ex + ez * ez <= r2) return true;
					}
				}
			}
			return false;
		},
	};
}

const CREEK_CATEGORIES = new Set(['fountain+water', 'water']);

function creekWaterLook(shared) {
	const material = new THREE.MeshStandardMaterial({
		color: shared.color.clone(), roughness: shared.roughness, metalness: shared.metalness,
		side: THREE.DoubleSide,
	});
	const sync = () => {
		material.color.copy(shared.color);
		material.roughness = shared.roughness;
		material.metalness = shared.metalness;
		material.envMapIntensity = shared.envMapIntensity;
		material.polygonOffset = shared.polygonOffset;
		material.polygonOffsetFactor = shared.polygonOffsetFactor;
		material.polygonOffsetUnits = shared.polygonOffsetUnits;
	};
	return function dress(root) {
		let meshes = 0;
		root.traverse((o) => {
			if (!o.isMesh || !o.userData || !CREEK_CATEGORIES.has(o.userData.category)) return;
			if (o.material === material) return;
			o.material = material;
			o.onBeforeRender = sync;
			meshes++;
		});
		if (meshes) ;
		return meshes;
	};
}

export function createWater(scene, meta, rings) {
	const level = waterLevel(meta);

	const geometry = new THREE.PlaneGeometry(1, 1);
	const material = new THREE.MeshStandardMaterial({
		color: WATER_COLOR, roughness: 0.25, metalness: 0.1,

		side: THREE.DoubleSide,

	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.rotation.x = -Math.PI / 2;
	mesh.position.y = level.y;
	mesh.name = 'water';

	setSheetOpacity(material, mesh, 1.0);

	mesh.userData.drivable = false;
	scene.add(mesh);

	let holeMode = 'smart';
	const holesFor = (polygon) => {
		if (holeMode === 'all') return true;
		if (holeMode === 'none') return false;
		return !polygon.river;
	};

	const servedByPlane = (polygon) =>
		typeof polygon.y !== 'number' || Math.abs(polygon.y - level.y) <= INNER_EPS_M;

	let ringGeo = null;
	let ringMesh = null;
	let innerMesh = null;
	let innerCount = 0;

	let reach = true;
	let unflattened = false;

	function buildRings() {
		for (const old of [ringMesh, innerMesh]) {
			if (!old) continue;
			scene.remove(old);
			old.geometry.dispose();
		}
		ringMesh = null;
		innerMesh = null;
		ringGeo = null;
		innerCount = 0;
		if (!rings) return;

		ringGeo = buildRingGeometry(rings, { base: level.y, holesFor, reach, unflattened });
		if (ringGeo) {
			ringMesh = new THREE.Mesh(ringGeo, material);
			ringMesh.position.y = level.y;
			ringMesh.name = 'water-rings';
			ringMesh.userData.drivable = false;
			scene.add(ringMesh);
		}

		const inner = (rings.polygons || []).filter((p) => !servedByPlane(p));
		innerCount = inner.length;
		if (inner.length) {
			const geo = buildRingGeometry(rings, {
				base: level.y, holesFor, reach, unflattened, filter: (p) => !servedByPlane(p),
			});
			if (geo) {
				innerMesh = new THREE.Mesh(geo, material);
				innerMesh.position.y = level.y;
				innerMesh.name = 'water-inner';

				innerMesh.userData.drivable = false;
				scene.add(innerMesh);
			}
			;
		}
	}
	buildRings();

	const dressCreeks = creekWaterLook(material);
	dressCreeks(scene);

	let kind = (rings && rings.polygons && rings.polygons.length) ? 'rings' : 'plane';
	let visible = true;

	function applyKind() {
		mesh.visible = visible && kind === 'plane';
		if (ringMesh) ringMesh.visible = visible && kind === 'rings';

		if (innerMesh) innerMesh.visible = visible && kind === 'plane';
	}

	let report = `sheet at y=${level.y.toFixed(2)} from ${level.source}`;

	function fit() {

		const box = new THREE.Box3();
		for (const child of scene.children) {

			if (child === mesh || child === ringMesh || child === innerMesh) continue;
			const b = new THREE.Box3().setFromObject(child);
			if (b.isEmpty()) continue;
			box.union(b);
		}
		if (box.isEmpty()) return;
		const sx = box.max.x - box.min.x + 2 * HORIZON_M;
		const sz = box.max.z - box.min.z + 2 * HORIZON_M;

		mesh.scale.set(sx, sz, 1);
		mesh.position.x = (box.min.x + box.max.x) / 2;
		mesh.position.z = (box.min.z + box.max.z) / 2;
		const s = ringGeo && ringGeo.userData.stats;
		const inner = innerCount
			? ` + ${innerCount} inner body(ies) at their own height`
			: '';
		report = kind === 'rings'
			? `${s.polys} mapped polygon(s), ${s.holes} hole(s), `
				+ `${s.tris.toLocaleString()} triangles at y=${level.y.toFixed(2)}, `
				+ `placed from ${level.source} — edge is the RING, not the terrain grid`
			: `${Math.round(sx)} x ${Math.round(sz)} m plane at y=`
				+ `${mesh.position.y.toFixed(2)}, placed from ${level.source}`
				+ ' — edge is wherever the terrain crosses it, at 10 m' + inner;
		applyKind();
		;
	}

	applyKind();

	return {
		mesh,
		fit,

		dressCreeks,
		get report() { return report; },
		get visible() { return visible; },
		setVisible(on) { visible = !!on; applyKind(); },
		setOpacity(x) {
			setSheetOpacity(material, mesh, x);
			if (ringMesh) ringMesh.renderOrder = mesh.renderOrder;
			if (innerMesh) innerMesh.renderOrder = mesh.renderOrder;
		},
		get opacity() { return material.opacity; },
		get material() { return material; },

		get kind() { return kind; },
		get hasRings() { return !!ringMesh; },
		setKind(k) { kind = (k === 'rings' && ringMesh) ? 'rings' : 'plane'; fit(); },

		get innerCount() { return innerCount; },

		get holeMode() { return holeMode; },
		setHoles(m) {
			holeMode = (m === 'all' || m === 'none') ? m : 'smart';
			buildRings();

			applyKind();
			fit();
		},

		get reach() { return reach; },
		get hasReach() { return !!(rings && (rings.polygons || []).some((p) => p.sheet_outer)); },
		setReach(on) { reach = !!on; buildRings(); applyKind(); fit(); },

		get unflattened() { return unflattened; },
		get unflattenedCount() {
			return rings ? (rings.polygons || []).filter((p) => p.sheet === false).length : 0;
		},
		setUnflattened(on) { unflattened = !!on; buildRings(); applyKind(); fit(); },
	};
}

function setSheetOpacity(material, mesh, x) {
	const o = Math.max(0, Math.min(1, Number(x)));
	const clear = o < 1;
	material.opacity = o;
	material.transparent = clear;
	material.depthWrite = !clear;

	mesh.renderOrder = clear ? 1 : 0;
	material.needsUpdate = true;
	return o;
}
